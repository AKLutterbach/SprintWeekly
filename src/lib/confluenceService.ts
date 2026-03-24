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

  // Format dates nicely if available
  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const dateRange = startDate && endDate
    ? `${fmtDate(startDate)} &ndash; ${fmtDate(endDate)}`
    : '';

  // Helper to render a breakdown string like "(5 planned, 2 added, 1 carry-over)"
  const breakdownStr = (b: StatusCategory['breakdown']) => {
    const parts: string[] = [];
    if (b.plannedAtStart > 0) parts.push(`${b.plannedAtStart} planned`);
    if (b.addedMidSprint > 0) parts.push(`${b.addedMidSprint} added`);
    if (b.fromLastSprint > 0) parts.push(`${b.fromLastSprint} carry-over`);
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  };

  // Helper to render an issue detail table
  const issueTable = (title: string, items: IssueDetail[], accentColor: string) => {
    if (items.length === 0) {
      return `<h3>${escapeXml(title)}</h3><p><em>No issues</em></p>`;
    }
    const rows = items.map(i =>
      `<tr><td><strong>${escapeXml(i.key)}</strong></td><td>${escapeXml(i.summary)}</td><td>${escapeXml(i.status)}</td></tr>`
    ).join('\n');

    return `
<h3><span style="color: ${accentColor};">${escapeXml(title)}</span></h3>
<table>
<tbody>
<tr><th>Key</th><th>Summary</th><th>Status</th></tr>
${rows}
</tbody>
</table>`;
  };

  // Compose the full page body
  return `
<p><strong>${escapeXml(projectName || sprintName)}</strong>${dateRange ? ` &middot; ${dateRange}` : ''}</p>

<h2>Sprint Overview</h2>
<table>
<tbody>
<tr>
<th style="text-align: center;">Complete</th>
<th style="text-align: center;">In Progress</th>
<th style="text-align: center;">To Do</th>
</tr>
<tr>
<td style="text-align: center;"><strong>${byStatus.complete.total}</strong> ${breakdownStr(byStatus.complete.breakdown)}</td>
<td style="text-align: center;"><strong>${byStatus.inProgress.total}</strong> ${breakdownStr(byStatus.inProgress.breakdown)}</td>
<td style="text-align: center;"><strong>${byStatus.toDo.total}</strong> ${breakdownStr(byStatus.toDo.breakdown)}</td>
</tr>
</tbody>
</table>

<hr />

${issueTable('Completed Issues', issues.completed, '#36B37E')}
${issueTable('In Progress Issues', issues.inProgress, '#0065FF')}
${issueTable('To Do Issues', issues.toDo, '#6B778C')}

<hr />
<p><em>Generated ${new Date().toLocaleString()} by Smart Sprints for Jira</em></p>
`.trim();
}

// ─── Confluence REST Helpers ─────────────────────────────────────────────────

/**
 * List all Confluence spaces the current user can access.
 * Returns an array of { id, key, name } objects.
 */
export async function listSpaces(): Promise<{ id: string; key: string; name: string }[]> {
  const spaces: { id: string; key: string; name: string }[] = [];
  let cursor: string | null = null;

  // Paginate through all spaces (max 250 per page)
  do {
    const url = cursor
      ? `/wiki/api/v2/spaces?limit=250&cursor=${cursor}`
      : '/wiki/api/v2/spaces?limit=250';

    const response = await api.asUser().requestConfluence(route`${url}`);
    if (!response.ok) {
      console.error('Failed to list Confluence spaces:', response.status, await response.text());
      break;
    }
    const data = await response.json();
    for (const s of (data.results || [])) {
      spaces.push({ id: s.id, key: s.key, name: s.name });
    }
    // Extract cursor from _links.next if present
    cursor = data._links?.next ? new URL(data._links.next, 'https://x').searchParams.get('cursor') : null;
  } while (cursor);

  return spaces;
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
  const payload: any = {
    spaceId,
    status: 'current',
    title,
    body: { representation: 'storage', value: body },
  };
  if (parentId) payload.parentId = parentId;

  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
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
