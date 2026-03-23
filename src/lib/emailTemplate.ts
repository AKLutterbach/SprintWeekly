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

  // Build the body message, incorporating the company name when available
  const companyPhrase = companyName ? ` from ${escapeHtml(companyName)}` : '';
  const bodyMessage = `See the ${escapeHtml(sprintName)} sprint report${companyPhrase} attached. Open the attachment for the full breakdown including issue details, status metrics, and sprint health indicators.`;

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

          <!-- Main message -->
          <tr>
            <td style="padding: 28px 32px;">
              <div style="font-size: 15px; color: #42526e; line-height: 1.6;">
                ${bodyMessage}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid #ebecf0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px 32px;">
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
