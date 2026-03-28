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

    // Numeric metric fields — default to 0 if missing
    const completedSP    = Number(metrics.completedStoryPoints) || 0;
    const totalSP        = Number(metrics.totalStoryPoints)     || 0;
    const carryoverCount = Number(metrics.carryoverIssues)      || 0;
    const blockedCount   = Number(metrics.blockedIssues ?? metrics.blockers) || 0;
    const defects        = Number(metrics.defects)              || 0;
    const completionRate = totalSP > 0 ? Math.round((completedSP / totalSP) * 100) : 0;

    // Issue counts — prefer byStatus totals, fall back to array length
    const completeCount   = Number(byStatus?.complete?.total)    || (issues.completed?.length   ?? 0);
    const inProgressCount = Number(byStatus?.inProgress?.total)  || (issues.inProgress?.length  ?? 0);
    const toDoCount       = Number(byStatus?.toDo?.total)        || (issues.toDo?.length        ?? 0);

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

    // ── Metric card helper ──────────────────────────────────────────────────
    // Renders one coloured card.  border-radius is ignored by classic Outlook
    // but still shows with a flat coloured background there.
    const card = (
      val: string, label: string, sub: string,
      bg: string, color: string, subColor: string,
    ) =>
      `<td valign="top" style="width:32%; padding:3px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:${bg}; padding:16px 10px 14px 10px; text-align:center; border-radius:6px;">
              <div style="font-size:26px; font-weight:700; color:${color}; line-height:1;">${val}</div>
              <div style="font-size:10px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:0.6px; margin-top:5px;">${label}</div>
              <div style="font-size:11px; color:${subColor}; margin-top:3px;">${sub}</div>
            </td>
          </tr>
        </table>
      </td>`;

    // Three metric cards: Velocity | Completion % | Carryover
    const metricCards = `
      <tr>
        <td style="padding: 24px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${card(
                `${completedSP}<span style="font-size:14px;font-weight:400;"> sp</span>`,
                'Velocity',
                `of ${totalSP} committed`,
                '#e3fcef', '#006644', '#57d9a3',
              )}
              ${card(
                `${completionRate}%`,
                'Completion',
                `${completeCount} issues done`,
                '#deebff', '#0747a6', '#4c9aff',
              )}
              ${card(
                String(carryoverCount),
                'Carryover',
                `${blockedCount} blocked`,
                carryoverCount > 0 ? '#fff4e5' : '#f4f5f7',
                carryoverCount > 0 ? '#974f0c' : '#505f79',
                carryoverCount > 0 ? '#ff991f' : '#97a0af',
              )}
            </tr>
          </table>
        </td>
      </tr>`;

    // ── Status summary strip ────────────────────────────────────────────────
    const dot = (c: string) =>
      `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};vertical-align:middle;margin-right:3px;"></span>`;
    const defectChip = defects > 0
      ? ` &nbsp;&middot;&nbsp; ${dot('#de350b')}<strong style="color:#de350b;">${defects}</strong>&nbsp;Defects`
      : '';

    const statusStrip = `
      <tr>
        <td style="padding: 12px 28px 0 28px;">
          <div style="border-top:1px solid #ebecf0; padding-top:12px; font-size:12px; color:#42526e;">
            ${dot('#36b37e')}<strong style="color:#006644;">${completeCount}</strong>&nbsp;Complete
            &nbsp;&middot;&nbsp;
            ${dot('#0065ff')}<strong style="color:#0052cc;">${inProgressCount}</strong>&nbsp;In Progress
            &nbsp;&middot;&nbsp;
            ${dot('#97a0af')}<strong style="color:#505f79;">${toDoCount}</strong>&nbsp;To Do
            ${defectChip}
          </div>
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

    const completedRow   = issueTable(issues.completed        || [], `✅ Completed (${completeCount})`,                                          '#36b37e', 12);
    const inProgressRow  = issueTable(issues.inProgress       || [], `🔄 In Progress (${inProgressCount})`,                                      '#0065ff',  6);
    const carryoverRow   = issueTable(issues.carryoverBlockers || [], `⚠️ Carryover / Blockers (${(issues.carryoverBlockers || []).length})`,    '#ff8b00',  6);

    // Compact notice reminding recipients that the full PDF is attached
    const pdfNotice = `
      <tr>
        <td style="padding: 20px 28px 24px 28px;">
          <div style="background:#f4f5f7; border-radius:6px; padding:12px 16px; font-size:12px; color:#505f79;">
            📎 &nbsp;Full report attached as PDF — includes all issue details, labels, and sprint health breakdown.
          </div>
        </td>
      </tr>`;

    reportBodyRows = metricCards + statusStrip + completedRow + inProgressRow + carryoverRow + pdfNotice;

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
              <div style="font-size: 12px; color: #97a0af; line-height: 1.5;">
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
