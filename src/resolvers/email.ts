/**
 * email.ts — Backend resolvers for email delivery of sprint reports.
 *
 * Handles:
 *  - Saving / loading per-project recipient lists (Forge Key-Value Storage)
 *  - Manual "Send Report Now" from the UI
 *  - "Send Test Email" to verify delivery
 *  - Sprint-close trigger handler (auto-send)
 *
 * All emails use the Resend API via emailService.ts.
 * The Resend API key is read from the RESEND_API_KEY Forge environment variable.
 */

import api, { route, storage } from '@forge/api';
import { sendEmail } from '../lib/emailService';
import { buildEmailTemplate } from '../lib/emailTemplate';
import { buildReport } from './report';
import { generatePDF } from './export';

// ─── Forge Environment Variable ──────────────────────────────────────────────
// Set via: forge variables set RESEND_API_KEY <your-key>
// The variable is injected at runtime as process.env.RESEND_API_KEY
const getApiKey = (): string => process.env.RESEND_API_KEY || '';

// ─── Storage Keys ────────────────────────────────────────────────────────────
// Per-project email config stored in Forge Key-Value Storage keyed by project.
const recipientStorageKey = (projectKey: string) => `email:recipients:${projectKey}`;

/**
 * Shape of the per-project email configuration persisted in Forge Storage.
 */
interface EmailConfig {
  emails: string[];          // Recipient addresses (max 8)
  autoSendOnClose: boolean;  // Whether to auto-send when a sprint closes
  companyName: string;       // Company/org name shown in the email header
  updatedAt: string;         // ISO timestamp of last update
}

/**
 * Get the Forge Storage client. Uses the top-level storage export from
 * @forge/api which operates at app-level scope.
 */
function getStorage() {
  return storage;
}

// ─── Resolver: Get Recipients ────────────────────────────────────────────────

/**
 * Fetch the saved email configuration for a project.
 *
 * @param payload - { projectKey: string }
 * @returns       - The stored EmailConfig or a default empty config
 */
export async function getEmailRecipients(payload: any): Promise<EmailConfig> {
  const { projectKey } = payload || {};
  if (!projectKey) {
    return { emails: [], autoSendOnClose: false, companyName: '', updatedAt: '' };
  }

  try {
    const stored = await getStorage().get(recipientStorageKey(projectKey));
    if (stored) {
      return stored as EmailConfig;
    }
  } catch (err: any) {
    console.error('Error reading email config from storage:', err);
  }

  // Return defaults if nothing stored
  return { emails: [], autoSendOnClose: false, companyName: '', updatedAt: '' };
}

// ─── Resolver: Save Recipients ───────────────────────────────────────────────

/**
 * Save the email configuration for a project.
 *
 * @param payload - { projectKey: string, emails: string[], autoSendOnClose: boolean }
 * @returns       - { success: boolean, error?: string }
 */
export async function saveEmailRecipients(payload: any): Promise<any> {
  const { projectKey, emails, autoSendOnClose, companyName } = payload || {};
  if (!projectKey) {
    return { success: false, error: 'No project key provided.' };
  }

  // Validate email list
  if (!Array.isArray(emails)) {
    return { success: false, error: 'emails must be an array.' };
  }

  if (emails.length > 8) {
    return { success: false, error: 'Maximum 8 recipients allowed.' };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Invalid email address: ${email}` };
    }
  }

  const config: EmailConfig = {
    emails,
    autoSendOnClose: !!autoSendOnClose,
    companyName: typeof companyName === 'string' ? companyName.trim().slice(0, 100) : '',
    updatedAt: new Date().toISOString(),
  };

  try {
    await getStorage().set(recipientStorageKey(projectKey), config);
    return { success: true };
  } catch (err: any) {
    console.error('Error saving email config:', err);
    return { success: false, error: 'Failed to save email settings.' };
  }
}

// ─── Resolver: Send Report Now ───────────────────────────────────────────────

/**
 * Generate and email the sprint report for the given sprint.
 * Called manually from the UI via the "Send Report Now" button.
 *
 * @param payload - { projectKey, sprintId, sprintName, reportData, startDate, endDate }
 * @returns       - { success, messageId?, error? }
 */
export async function sendReportEmail(payload: any): Promise<any> {
  const { projectKey, sprintId, sprintName, reportData, startDate, endDate } = payload || {};

  if (!projectKey) {
    return { success: false, error: 'No project key provided.' };
  }

  // Load recipient list from storage
  const config = await getEmailRecipients({ projectKey });
  if (!config.emails || config.emails.length === 0) {
    return { success: false, error: 'No recipients configured for this project.' };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'Email service is not configured. Contact your administrator.' };
  }

  try {
    // If reportData was passed from the frontend, use it directly.
    // Otherwise, generate the report from scratch using the sprint ID.
    let data = reportData;
    if (!data && sprintId && projectKey) {
      const reportResult = await buildReport({
        requestId: `email-${Date.now()}`,
        scope: { type: 'project', id: projectKey, ref: projectKey },
        sprintId: sprintId,
        useSprintMode: true,
        metrics: ['status'],
      });
      data = (reportResult as any).payload || reportResult;
    }

    if (!data) {
      return { success: false, error: 'Could not generate report data.' };
    }

    // Generate the PDF — use the project name as the report title so it matches
    // the PDF produced by the Generate PDF button in the UI
    const projectName = await getProjectName(projectKey);
    const pdfBuffer = await generatePDF(
      data,
      sprintName || 'Sprint Report',
      projectName || 'Sprint Report',
      startDate,
      endDate
    );

    // Build the email HTML (projectName already fetched above for the PDF title)

    // Pass the full report data so the email body renders an inline visual
    // summary — stakeholders see metrics + issues without opening the PDF
    const html = buildEmailTemplate(
      sprintName || 'Sprint Report',
      config.companyName,
      projectName,
      startDate,
      endDate,
      data,
    );

    // Build a clean filename for the PDF attachment
    const safeSprintName = (sprintName || 'report').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
    const filename = `Sprint-Report-${safeSprintName}.pdf`;

    // Send the email
    const result = await sendEmail(
      apiKey,
      config.emails,
      `Sprint Report: ${sprintName || 'Sprint Report'}`,
      html,
      pdfBuffer,
      filename
    );

    if (result.success) {
      // Store the last-sent timestamp for this project
      try {
        await getStorage().set(`email:lastSent:${projectKey}`, {
          sentAt: new Date().toISOString(),
          sprintName: sprintName || 'Sprint Report',
          recipientCount: config.emails.length,
          messageId: result.messageId,
        });
      } catch {
        // Non-critical — don't fail the whole send for a metadata write error
      }
    }

    return result;
  } catch (err: any) {
    console.error('Error sending report email:', err);
    return { success: false, error: `Failed to send email: ${err.message || 'Unknown error'}` };
  }
}

// ─── Resolver: Send Test Email ───────────────────────────────────────────────

/**
 * Send a test email to verify the email configuration is working.
 * Sends to all configured recipients with a [TEST] subject prefix
 * and a sample PDF attachment so the recipient sees the full experience.
 *
 * @param payload - { projectKey }
 * @returns       - { success, messageId?, error? }
 */
export async function sendTestEmail(payload: any): Promise<any> {
  const { projectKey } = payload || {};

  if (!projectKey) {
    return { success: false, error: 'No project key provided.' };
  }

  const config = await getEmailRecipients({ projectKey });
  if (!config.emails || config.emails.length === 0) {
    return { success: false, error: 'No recipients configured for this project.' };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'Email service is not configured. Contact your administrator.' };
  }

  const projectName = await getProjectName(projectKey);

  // Build sample report data so we can generate a real PDF attachment
  const sampleData = {
    requestId: `test-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    scope: { type: 'project', id: projectKey },
    metrics: {
      totalStoryPoints: 40,
      completedStoryPoints: 28,
    },
    byStatus: {
      complete: { total: 7, issues: [] },
      inProgress: { total: 2, issues: [] },
      toDo: { total: 1, issues: [] },
    },
    issues: {
      completed: [],
      uncompleted: [],
      inProgress: [],
      toDo: [],
      carryoverBlockers: [],
    },
  };

  // Generate a sample PDF so the recipient sees a realistic test
  const pdfBuffer = await generatePDF(
    sampleData,
    'Test Sprint',
    'Smart Sprints Test Report',
    undefined,
    undefined
  );

  // Pass the sample data so test emails also render the inline report layout
  const html = buildEmailTemplate(
    'Test Sprint',
    config.companyName,
    projectName,
    undefined,
    undefined,
    sampleData,
  );

  return await sendEmail(
    apiKey,
    config.emails,
    '[TEST] Sprint Report: Test Sprint',
    html,
    pdfBuffer,
    'Sprint-Report-Test.pdf'
  );
}

// ─── Resolver: Get Last Sent Info ────────────────────────────────────────────

/**
 * Fetch the last-sent metadata for a project so the UI can display it.
 *
 * @param payload - { projectKey }
 * @returns       - { sentAt, sprintName, recipientCount } or null
 */
export async function getLastSentInfo(payload: any): Promise<any> {
  const { projectKey } = payload || {};
  if (!projectKey) return null;

  try {
    return await getStorage().get(`email:lastSent:${projectKey}`) || null;
  } catch {
    return null;
  }
}

// ─── Trigger: Sprint Closed ──────────────────────────────────────────────────

/**
 * Handler for the avi:jira-software:closed:sprint product event.
 * Fires automatically when any sprint is closed in the Jira site.
 *
 * Flow:
 *  1. Extract sprint info from the event payload
 *  2. Determine which project the sprint belongs to (via board → project lookup)
 *  3. Check if that project has auto-send enabled + recipients configured
 *  4. If yes, generate the report + PDF and email it
 */
export async function onSprintClosed(event: any): Promise<void> {
  console.log('Sprint closed event received:', JSON.stringify(event));

  const sprint = event?.sprint || event?.payload?.sprint;
  if (!sprint || !sprint.id) {
    console.error('Sprint closed event missing sprint data');
    return;
  }

  const sprintId = sprint.id;
  const sprintName = sprint.name || `Sprint ${sprintId}`;
  const originBoardId = sprint.originBoardId;

  // Look up the project key from the board ID.
  // The board configuration endpoint tells us which project it belongs to.
  let projectKey: string | null = null;
  try {
    if (originBoardId) {
      const boardResponse = await api.asApp().requestJira(
        route`/rest/agile/1.0/board/${originBoardId}/configuration`
      );
      const boardData = await boardResponse.json();
      // The board config contains the filter, and the board itself is associated
      // with a project location.
      projectKey = boardData?.location?.projectKey || null;
    }

    // Fallback: search for any issue in this sprint to find its project
    if (!projectKey) {
      const searchResponse = await api.asApp().requestJira(
        route`/rest/api/3/search/jql?jql=${`sprint = ${sprintId}`}&maxResults=1&fields=project`
      );
      const searchData = await searchResponse.json();
      if (searchData?.issues?.length > 0) {
        projectKey = searchData.issues[0].fields?.project?.key || null;
      }
    }
  } catch (err: any) {
    console.error('Error looking up project for sprint:', err);
  }

  if (!projectKey) {
    console.log(`Could not determine project for sprint ${sprintId}, skipping email`);
    return;
  }

  // Check if auto-send is enabled for this project
  const config = await getEmailRecipients({ projectKey });
  if (!config.autoSendOnClose || !config.emails || config.emails.length === 0) {
    console.log(`Auto-send not enabled or no recipients for project ${projectKey}, skipping`);
    return;
  }

  console.log(`Auto-sending sprint report for ${sprintName} (${projectKey}) to ${config.emails.length} recipients`);

  // Delegate to the shared send logic
  const result = await sendReportEmail({
    projectKey,
    sprintId,
    sprintName,
    startDate: sprint.startDate,
    endDate: sprint.completeDate || sprint.endDate,
  });

  if (result.success) {
    console.log(`Sprint report emailed successfully: ${result.messageId}`);
  } else {
    console.error(`Failed to email sprint report: ${result.error}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the human-readable project name for a project key.
 * Used to populate the email template.
 */
async function getProjectName(projectKey: string): Promise<string> {
  try {
    const response = await api.asApp().requestJira(
      route`/rest/api/3/project/${projectKey}`
    );
    const data = await response.json();
    return data?.name || projectKey;
  } catch {
    return projectKey; // Fall back to the key itself
  }
}
