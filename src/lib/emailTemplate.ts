/**
 * emailTemplate.ts — Branded HTML email template for sprint report delivery.
 *
 * Generates a clean, professional HTML email that wraps the sprint report
 * metadata.  The actual report data is attached as a PDF — the email body
 * just provides context so the recipient knows what the attachment is.
 *
 * Design goals:
 *  - Renders well across Gmail, Outlook, Apple Mail (uses table-based layout)
 *  - Header shows the company name (configurable per project) and sprint info
 *  - Body copy tells the recipient to open the attached PDF
 */

/**
 * Build the HTML body for the sprint report email.
 *
 * @param sprintName   - Name of the sprint (e.g. "Sprint 42")
 * @param companyName  - Configurable per-project company/org name for the header
 * @param projectName  - Name of the Jira project (e.g. "ACME Platform")
 * @param startDate    - Sprint start date (ISO string or readable format)
 * @param endDate      - Sprint end date (ISO string or readable format)
 * @returns            - Complete HTML string ready for the email body
 */
export function buildEmailTemplate(
  sprintName: string,
  companyName?: string,
  projectName?: string,
  startDate?: string,
  endDate?: string,
  reportData?: any,
): string {
  // Format dates for display — convert ISO strings to readable format
  const formatDate = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso; // If already formatted, pass through
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);
  const dateRange = startFormatted && endFormatted
    ? `${startFormatted} – ${endFormatted}`
    : '';

  // Build the sprint subtitle line: sprint name + optional date range with dot separator
  const subtitleParts = [escapeHtml(sprintName)];
  if (dateRange) subtitleParts.push(escapeHtml(dateRange));
  const subtitleHtml = subtitleParts.join(' &middot; ');

  // Use company name for large header title; always show project name underneath if both exist
  const headerTitle = companyName || projectName || 'Sprint Report';
  // Show project name as a secondary line only when it's different from the title
  const headerSubtitle = companyName && projectName ? escapeHtml(projectName) : '';

  // ─── Build inline report body ─────────────────────────────────────────────
  // When reportData is provided we render metric cards + issue tables directly
  // in the email body.  Falls back to a short plain-text message otherwise.
  let reportBodyRows = '';

  if (reportData) {
    const metrics   = reportData.metrics  || {};
    const issues    = reportData.issues   || {};
    const byStatus  = reportData.byStatus || {};

    // Pull issue counts and breakdown sub-values from byStatus — exactly mirroring
    // how the PDF "Sprint Overview" section reads this data in export.ts.
    const completeTotal    = Number(byStatus?.complete?.total)    || 0;
    const inProgressTotal  = Number(byStatus?.inProgress?.total)  || 0;
    const toDoTotal        = Number(byStatus?.toDo?.total)        || 0;

    // Sub-chip values (from last sprint / planned at start / added mid-sprint)
    const bd = (cat: any) => cat?.breakdown || {};
    const completeBreak   = bd(byStatus?.complete);
    const inProgressBreak = bd(byStatus?.inProgress);
    const toDoBreak       = bd(byStatus?.toDo);

    // Derived values used in status strip and issue tables
    const defects        = Number(metrics.defects) || 0;
    const carryoverCount = Number(metrics.carryoverIssues) || 0;
    const blockedCount   = Number(metrics.blockedIssues ?? metrics.blockers) || 0;

    // Normalize issue fields — issues may arrive in two shapes:
    //   flat:   { key, summary, status, storyPoints }
    //   nested: { key, fields: { summary, status, storyPoints } }
    const getKey     = (i: any) => escapeHtml(i.key || '');
    const getSummary = (i: any) => escapeHtml(i.summary || i.fields?.summary || '(no summary)');
    const getStatus  = (i: any) => escapeHtml(i.status  || i.fields?.status  || '');
    const getSP      = (i: any) => {
      const v = i.storyPoints ?? i.fields?.storyPoints;
      return v != null ? `${v}sp` : '–';
    };

    // ── Sub-metric row helper ────────────────────────────────────────────────
    // Renders the three breakdown values (from last sprint / planned at start /
    // added mid-sprint) as a separate banded row inside the card so they are
    // visually distinct from the large count above them.
    const subRow = (fromLast: number, planned: number, added: number, bandBg: string, textColor: string) =>
      `<tr>
        <td style="background:${bandBg}; padding:8px 6px 10px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="text-align:center; padding:0 2px; width:33%;">
                <div style="font-size:14px; font-weight:700; color:${textColor};">${fromLast}</div>
                <div style="font-size:9px; color:${textColor}; opacity:0.75; line-height:1.3; margin-top:2px;">From last<br/>sprint</div>
              </td>
              <td style="text-align:center; padding:0 2px; width:33%; border-left:1px solid rgba(0,0,0,0.06); border-right:1px solid rgba(0,0,0,0.06);">
                <div style="font-size:14px; font-weight:700; color:${textColor};">${planned}</div>
                <div style="font-size:9px; color:${textColor}; opacity:0.75; line-height:1.3; margin-top:2px;">Planned<br/>at start</div>
              </td>
              <td style="text-align:center; padding:0 2px; width:33%;">
                <div style="font-size:14px; font-weight:700; color:${textColor};">${added}</div>
                <div style="font-size:9px; color:${textColor}; opacity:0.75; line-height:1.3; margin-top:2px;">Added<br/>mid-sprint</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

    // ── Metric card helper ──────────────────────────────────────────────────
    // Each card has two visually distinct zones:
    //   Top  — coloured background with the large count + status label
    //   Band — slightly darker shade with the 3 breakdown sub-metrics
    // The two zones are contained inside a rounded outer wrapper.
    const card = (
      count: number, label: string,
      topBg: string, topColor: string, bandBg: string,
      fromLast: number, planned: number, added: number,
    ) =>
      `<td valign="top" style="width:32%; padding:4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px; overflow:hidden; border:1px solid rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${topBg}; padding:18px 8px 14px 8px; text-align:center;">
              <div style="font-size:30px; font-weight:700; color:${topColor}; line-height:1;">${count}</div>
              <div style="font-size:10px; font-weight:700; color:${topColor}; text-transform:uppercase; letter-spacing:0.7px; margin-top:5px;">${label}</div>
            </td>
          </tr>
          ${subRow(fromLast, planned, added, bandBg, topColor)}
        </table>
      </td>`;

    // Three cards matching the PDF Sprint Overview: Complete | In Progress | To Do
    const metricCards = `
      <tr>
        <td style="padding: 24px 24px 0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${card(
                completeTotal,   'Complete',
                '#e3fcef', '#006644', '#c8f5e0',
                Number(completeBreak.fromLastSprint) || 0,
                Number(completeBreak.plannedAtStart) || 0,
                Number(completeBreak.addedMidSprint) || 0,
              )}
              ${card(
                inProgressTotal, 'In Progress',
                '#deebff', '#0747a6', '#c0d9ff',
                Number(inProgressBreak.fromLastSprint) || 0,
                Number(inProgressBreak.plannedAtStart) || 0,
                Number(inProgressBreak.addedMidSprint) || 0,
              )}
              ${card(
                toDoTotal,       'To Do',
                '#f4f5f7', '#505f79', '#e4e5e9',
                Number(toDoBreak.fromLastSprint) || 0,
                Number(toDoBreak.plannedAtStart) || 0,
                Number(toDoBreak.addedMidSprint) || 0,
              )}
            </tr>
          </table>
        </td>
      </tr>`;

    // ── Issue table builder ─────────────────────────────────────────────────
    // Renders a compact table of issues for one category, limited to `limit`
    // rows.  Shows an overflow note at the bottom if there are more.
    const issueTable = (list: any[], heading: string, headingColor: string, limit: number) => {
      if (!list || list.length === 0) return '';
      const shown    = list.slice(0, limit);
      const overflow = list.length - shown.length;

      const rows = shown.map(issue => {
        const statusText = getStatus(issue);
        return `        <tr style="border-bottom:1px solid #f4f5f7;">
          <td style="padding:6px 8px 6px 0; font-size:11px; font-weight:600; color:#0052cc; white-space:nowrap; width:1%;">${getKey(issue)}</td>
          <td style="padding:6px 8px; font-size:12px; color:#172b4d; line-height:1.4;">${getSummary(issue)}</td>
          <td style="padding:6px 0 6px 4px; font-size:10px; color:#505f79; white-space:nowrap; text-align:right;">${statusText ? `<span style="background:#eff1f3;border-radius:3px;padding:2px 5px;">${statusText}</span>` : ''}</td>
          <td style="padding:6px 4px; font-size:11px; color:#97a0af; white-space:nowrap; text-align:right; width:1%;">${getSP(issue)}</td>
        </tr>`;
      }).join('');

      const overflowRow = overflow > 0
        ? `<tr><td colspan="4" style="padding:6px 0 0 0; font-size:11px; color:#97a0af; font-style:italic;">…and ${overflow} more in the attached PDF</td></tr>`
        : '';

      return `
        <tr>
          <td style="padding: 18px 28px 0 28px;">
            <div style="font-size:11px; font-weight:700; color:${headingColor}; text-transform:uppercase; letter-spacing:0.6px; border-bottom:2px solid ${headingColor}; padding-bottom:6px;">${heading}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows}
              ${overflowRow}
            </table>
          </td>
        </tr>`;
    };

    const completedRow   = issueTable(issues.completed        || [], `✅ Completed (${completeTotal})`,                                        '#36b37e', 12);
    const inProgressRow  = issueTable(issues.inProgress       || [], `🔄 In Progress (${inProgressTotal})`,                                    '#0065ff',  6);
    const toDoRow        = issueTable(issues.toDo             || [], `📋 To Do (${toDoTotal})`,                                               '#97a0af',  6);
    const carryoverRow   = issueTable(issues.carryoverBlockers || [], `⚠️ Carryover / Blockers (${(issues.carryoverBlockers || []).length})`,  '#ff8b00',  6);

    // Compact notice reminding recipients that the full PDF is attached
    const pdfNotice = `
      <tr>
        <td style="padding: 20px 28px 24px 28px;">
          <div style="background:#f4f5f7; border-radius:6px; padding:12px 16px; font-size:12px; color:#505f79;">
            📎 &nbsp;Full report attached as PDF — includes all issue details, labels, and sprint health breakdown.
          </div>
        </td>
      </tr>`;

    reportBodyRows = metricCards + completedRow + inProgressRow + toDoRow + carryoverRow + pdfNotice;

  } else {
    // Fallback when no report data is available — plain instructional text
    const companyPhrase = companyName ? ` from ${escapeHtml(companyName)}` : '';
    const fallbackMsg = `See the ${escapeHtml(sprintName)} sprint report${companyPhrase} attached. Open the attachment for the full breakdown including issue details, status metrics, and sprint health indicators.`;
    reportBodyRows = `
      <tr>
        <td style="padding: 28px 32px;">
          <div style="font-size:15px; color:#42526e; line-height:1.6;">
            ${fallbackMsg}
          </div>
        </td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Sprint Report: ${escapeHtml(sprintName)}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .outlook-fallback { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0f1f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Outer wrapper for background color -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f1f3;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Main content card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header with brand color — shows the company name + sprint info -->
          <tr>
            <td style="background-color: #0052cc; padding: 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                      ${escapeHtml(headerTitle)}
                    </div>
                    ${headerSubtitle ? `<div style="font-size: 13px; color: #b3d4ff; margin-top: 1px;">${headerSubtitle}</div>` : ''}
                    <div style="font-size: 13px; color: #b3d4ff; margin-top: 4px;">
                      ${subtitleHtml}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Inline report body: metric cards + issue tables (or fallback message) -->
          ${reportBodyRows}

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid #ebecf0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 24px 32px;">
              <div style="font-size: 10px; color: #97a0af; line-height: 1.5;">
                This report was generated by Smart Sprints. If you received this email in error, you can safely ignore it.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}


/**
 * Escape HTML special characters to prevent XSS in the email template.
 * Sprint names or project names could contain user-entered content.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
