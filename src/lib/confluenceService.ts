/**
 * confluenceService.ts — Confluence page creation and PDF attachment helpers.
 *
 * Provides two capabilities:
 *  1. Build rich Confluence "storage format" XHTML from sprint report data
 *     so the report is a native, searchable, first-class Confluence page.
 *  2. Attach the generated PDF to the same page for download.
 *
 * Uses the Confluence REST API v2 for page CRUD and the v1 attachment endpoint
 * (v2 does not expose a create-attachment route).
 */

import api, { route } from '@forge/api';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal issue shape used in the detail tables. */
interface IssueDetail {
  key: string;
  summary: string;
  status: string;
}

/** The subset of report data we need to render a Confluence page. */
export interface ConfluenceReportData {
  byStatus: {
    complete: StatusCategory;
    inProgress: StatusCategory;
    toDo: StatusCategory;
  };
  issues: {
    completed: IssueDetail[];
    inProgress: IssueDetail[];
    toDo: IssueDetail[];
  };
}

interface StatusCategory {
  total: number;
  breakdown: {
    fromLastSprint: number;
    plannedAtStart: number;
    addedMidSprint: number;
  };
}

// ─── Confluence Storage-Format Builder ───────────────────────────────────────

/**
 * Build a rich Confluence storage-format XHTML string from sprint report data.
 *
 * The page contains:
 *  - An overview panel with three metric columns (Complete / In Progress / To Do)
 *  - Three detail tables listing every issue with key, summary, and status
 *  - A footer noting the generation timestamp
 *
 * @param data        - The report byStatus + issues structure
 * @param sprintName  - e.g. "Sprint 42"
 * @param projectName - e.g. "My Project"
 * @param startDate   - ISO date string (optional)
 * @param endDate     - ISO date string (optional)
 * @returns           - XHTML markup in Confluence storage format
 */
export function buildConfluencePageBody(
  data: ConfluenceReportData,
  sprintName: string,
  projectName?: string,
  startDate?: string,
  endDate?: string,
): string {
  const { byStatus, issues } = data;

  // ── Date formatting ───────────────────────────────────────────────
  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const dateRange = startDate && endDate
    ? `${fmtDate(startDate)} – ${fmtDate(endDate)}`
    : '';

  // ── Breakdown label builder ───────────────────────────────────────
  // Produces a compact breakdown string like "3 planned · 2 added · 1 carry-over"
  const breakdownStr = (b: StatusCategory['breakdown']): string => {
    const parts: string[] = [];
    if (b.plannedAtStart > 0) parts.push(`${b.plannedAtStart} planned`);
    if (b.addedMidSprint > 0)  parts.push(`${b.addedMidSprint} added`);
    if (b.fromLastSprint > 0)  parts.push(`${b.fromLastSprint} carry-over`);
    return parts.join(' · ');
  };

  // ── Confluence panel macro ────────────────────────────────────────
  // Renders a color-accented panel card matching the app's metric card design.
  // titleBGColor sets the header strip color; bgColor lightens the card body.
  const metricPanel = (
    label: string,
    total: number,
    breakdown: StatusCategory['breakdown'],
    borderColor: string,
    titleBGColor: string,
    bgColor: string,
  ): string => {
    const breakStr = breakdownStr(breakdown);
    return `<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="borderColor">${borderColor}</ac:parameter>
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderWidth">2</ac:parameter>
  <ac:parameter ac:name="titleBGColor">${titleBGColor}</ac:parameter>
  <ac:parameter ac:name="titleColor">#ffffff</ac:parameter>
  <ac:parameter ac:name="bgColor">${bgColor}</ac:parameter>
  <ac:parameter ac:name="title">${label}</ac:parameter>
  <ac:rich-text-body>
    <p style="text-align: center; margin: 8px 0 4px 0;"><strong style="font-size: 32px; line-height: 1;">${total}</strong></p>
    <p style="text-align: center; color: #6b778c; font-size: 12px; margin: 0;">${breakStr || 'No issues'}</p>
  </ac:rich-text-body>
</ac:structured-macro>`;
  };

  // ── Status lozenge macro ──────────────────────────────────────────
  // Maps Jira status labels to Confluence's built-in status macro colors.
  const statusLozenge = (statusText: string): string => {
    const s = statusText.toLowerCase();
    let colour = 'Grey';
    if (s.includes('done') || s.includes('complete') || s.includes('closed') || s.includes('resolved')) {
      colour = 'Green';
    } else if (s.includes('progress') || s.includes('review') || s.includes('active')) {
      colour = 'Blue';
    } else if (s.includes('block')) {
      colour = 'Red';
    }
    return `<ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">${colour}</ac:parameter>
  <ac:parameter ac:name="title">${escapeXml(statusText)}</ac:parameter>
</ac:structured-macro>`;
  };

  // ── Issue detail panel ────────────────────────────────────────────
  // Each category gets a panel with a colored border and an issue table inside.
  const issuePanel = (
    label: string,
    items: IssueDetail[],
    borderColor: string,
    titleBGColor: string,
  ): string => {
    const count = items.length;
    const bodyContent = count === 0
      ? `<p style="color: #6b778c; font-style: italic;">No issues in this category.</p>`
      : `<table>
  <tbody>
    <tr>
      <th style="width: 100px;">Key</th>
      <th>Summary</th>
      <th style="width: 130px;">Status</th>
    </tr>
    ${items.map(i => `<tr>
      <td><strong>${escapeXml(i.key)}</strong></td>
      <td>${escapeXml(i.summary)}</td>
      <td>${statusLozenge(i.status)}</td>
    </tr>`).join('\n    ')}
  </tbody>
</table>`;

    return `<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="borderColor">${borderColor}</ac:parameter>
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderWidth">2</ac:parameter>
  <ac:parameter ac:name="titleBGColor">${titleBGColor}</ac:parameter>
  <ac:parameter ac:name="titleColor">#ffffff</ac:parameter>
  <ac:parameter ac:name="title">${label} (${count})</ac:parameter>
  <ac:rich-text-body>
    ${bodyContent}
  </ac:rich-text-body>
</ac:structured-macro>`;
  };

  // ── Page header info panel ────────────────────────────────────────
  // Dark blue branded header with sprint name, project, and date range.
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  // Second line: date range + generated timestamp, slightly smaller/muted
  const headerSubtitle = [
    dateRange ? `📅 ${dateRange}` : '',
    `Generated ${generatedAt} by Smart Sprints for Jira`,
  ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const headerPanel = `<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="borderColor">#0F2744</ac:parameter>
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderWidth">2</ac:parameter>
  <ac:parameter ac:name="titleBGColor">#0F2744</ac:parameter>
  <ac:parameter ac:name="titleColor">#ffffff</ac:parameter>
  <ac:parameter ac:name="bgColor">#f4f7fb</ac:parameter>
  <ac:parameter ac:name="title">📊 ${escapeXml(sprintName)}${projectName ? ` — ${escapeXml(projectName)}` : ''}</ac:parameter>
  <ac:rich-text-body>
    <p style="margin: 0; font-size: 12px; color: #6b778c;">${headerSubtitle}</p>
  </ac:rich-text-body>
</ac:structured-macro>`;

  // ── Three-column metrics layout ───────────────────────────────────
  // Confluence's section + column macros create a multi-column layout.
  const metricsColumns = `<ac:structured-macro ac:name="section" ac:schema-version="1">
  <ac:rich-text-body>
    <ac:structured-macro ac:name="column" ac:schema-version="1">
      <ac:parameter ac:name="width">33%</ac:parameter>
      <ac:rich-text-body>
        ${metricPanel('✓  Complete', byStatus.complete.total, byStatus.complete.breakdown, '#36B37E', '#36B37E', '#f0fcf6')}
      </ac:rich-text-body>
    </ac:structured-macro>
    <ac:structured-macro ac:name="column" ac:schema-version="1">
      <ac:parameter ac:name="width">33%</ac:parameter>
      <ac:rich-text-body>
        ${metricPanel('⟳  In Progress', byStatus.inProgress.total, byStatus.inProgress.breakdown, '#0065FF', '#0065FF', '#f0f5ff')}
      </ac:rich-text-body>
    </ac:structured-macro>
    <ac:structured-macro ac:name="column" ac:schema-version="1">
      <ac:parameter ac:name="width">34%</ac:parameter>
      <ac:rich-text-body>
        ${metricPanel('○  To Do', byStatus.toDo.total, byStatus.toDo.breakdown, '#6B778C', '#6B778C', '#f7f8f9')}
      </ac:rich-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>`;

  // ── Compose full page ─────────────────────────────────────────────
  return `${headerPanel}

<h2>Sprint Overview</h2>
${metricsColumns}

<h2>Sprint Detail</h2>
${issuePanel('✓  Completed Issues', issues.completed, '#36B37E', '#36B37E')}

${issuePanel('⟳  In Progress', issues.inProgress, '#0065FF', '#0065FF')}

${issuePanel('○  To Do', issues.toDo, '#6B778C', '#6B778C')}`.trim();
}

// ─── Confluence REST Helpers ─────────────────────────────────────────────────

/**
 * List all Confluence spaces the current user can access.
 * Returns an array of { id, key, name } objects.
 */
export async function listSpaces(): Promise<{ id: string; key: string; name: string }[]> {
  // A single-customer site won't exceed 250 spaces, so one request is sufficient.
  // NOTE: We must use a fully static route template — Forge's `route` tag escapes any
  // dynamic values inserted via ${}, which would break a dynamically-constructed URL path.
  const response = await api.asUser().requestConfluence(
    route`/wiki/api/v2/spaces?limit=250&status=current`
  );
  if (!response.ok) {
    console.error('Failed to list Confluence spaces:', response.status, await response.text());
    return [];
  }
  const data = await response.json();
  return (data.results || []).map((s: any) => ({ id: s.id, key: s.key, name: s.name }));
}

/**
 * List top-level pages in a space (for picking a parent page).
 *
 * @param spaceId - The Confluence space ID
 * @returns       - Array of { id, title } objects
 */
export async function listPagesInSpace(spaceId: string): Promise<{ id: string; title: string }[]> {
  const response = await api.asUser().requestConfluence(
    route`/wiki/api/v2/spaces/${spaceId}/pages?depth=root&limit=100`
  );
  if (!response.ok) {
    console.error('Failed to list pages in space:', response.status, await response.text());
    return [];
  }
  const data = await response.json();
  return (data.results || []).map((p: any) => ({ id: p.id, title: p.title }));
}

/**
 * Create a new Confluence page in the given space.
 *
 * @param spaceId   - The Confluence space ID
 * @param title     - Page title
 * @param body      - Storage-format XHTML body
 * @param parentId  - Optional parent page ID (nesting)
 * @returns         - The created page's id and webui link
 */
export async function createPage(
  spaceId: string,
  title: string,
  body: string,
  parentId?: string,
): Promise<{ id: string; link: string }> {
  // Inner helper so we can retry with a different title without duplicating logic.
  const attemptCreate = async (pageTitle: string) => {
    const payload: any = {
      spaceId,
      status: 'current',
      title: pageTitle,
      body: { representation: 'storage', value: body },
    };
    if (parentId) payload.parentId = parentId;

    return api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  let response = await attemptCreate(title);

  // If Confluence rejects with 400 due to a duplicate title, append the current
  // date/time to make the title unique and try once more.
  if (!response.ok && response.status === 400) {
    const txt = await response.text();
    if (txt.includes('same TITLE') || txt.includes('title already exists') || txt.includes('BAD_REQUEST')) {
      const timestamp = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      const fallbackTitle = `${title} (${timestamp})`;
      console.warn(`Confluence title conflict — retrying with: "${fallbackTitle}"`);
      response = await attemptCreate(fallbackTitle);
      if (!response.ok) {
        const retryTxt = await response.text();
        throw new Error(`Failed to create Confluence page (${response.status}): ${retryTxt}`);
      }
    } else {
      throw new Error(`Failed to create Confluence page (${response.status}): ${txt}`);
    }
  } else if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Failed to create Confluence page (${response.status}): ${txt}`);
  }

  const data = await response.json();
  return { id: data.id, link: data._links?.webui || '' };
}

/**
 * Update an existing Confluence page with new content.
 * Bumps the version number automatically.
 *
 * @param pageId - The page ID to update
 * @param title  - The page title (required by API)
 * @param body   - New storage-format XHTML body
 */
export async function updatePage(pageId: string, title: string, body: string): Promise<void> {
  // First, fetch current version number
  const getResp = await api.asUser().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}?include-version=true`
  );
  if (!getResp.ok) {
    throw new Error(`Failed to get page ${pageId}: ${getResp.status}`);
  }
  const existing = await getResp.json();
  const nextVersion = (existing.version?.number || 1) + 1;

  const payload = {
    id: pageId,
    status: 'current',
    title,
    body: { representation: 'storage', value: body },
    version: { number: nextVersion, message: 'Updated by Smart Sprints' },
  };

  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Failed to update Confluence page (${response.status}): ${txt}`);
  }
}

/**
 * Attach a PDF file to a Confluence page.
 * Uses the v1 attachment endpoint (v2 does not support creating attachments).
 *
 * @param pageId    - The Confluence page ID
 * @param pdfBuffer - The PDF file as a Buffer
 * @param filename  - The attachment filename
 */
export async function attachPdfToPage(
  pageId: string,
  pdfBuffer: Buffer,
  filename: string,
): Promise<void> {
  // Confluence v1 attachment endpoint expects multipart/form-data.
  // In Forge's serverless runtime we build the multipart body manually.
  const boundary = `----ForgeAttachment${Date.now()}`;
  const crlf = '\r\n';
  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/pdf',
    '',
    '',
  ].join(crlf);

  const footer = `${crlf}--${boundary}--${crlf}`;

  // Build the full body as a single Buffer
  const headerBuf = Buffer.from(header, 'utf-8');
  const footerBuf = Buffer.from(footer, 'utf-8');
  const bodyBuffer = Buffer.concat([headerBuf, pdfBuffer, footerBuf]);

  const response = await api.asApp().requestConfluence(
    route`/wiki/rest/api/content/${pageId}/child/attachment`,
    {
      method: 'PUT', // PUT creates or updates the attachment
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'X-Atlassian-Token': 'nocheck',
      },
      body: bodyBuffer as any,
    },
  );

  if (!response.ok) {
    const txt = await response.text();
    console.error(`Attachment upload failed (${response.status}): ${txt}`);
    // Non-fatal — the page was already created, just log the error
  }
}

// ─── XML Escaping ────────────────────────────────────────────────────────────

/**
 * Escape special XML characters to prevent injection in storage format.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
