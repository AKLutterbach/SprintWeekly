/**
 * emailService.ts — Resend API wrapper for sending emails with PDF attachments.
 *
 * Uses a simple fetch call to the Resend REST API rather than the npm SDK,
 * because Forge functions have fetch available globally via @forge/api and
 * we want to keep the bundle small.
 *
 * The Resend API key is stored as a Forge environment variable
 * (set via `forge variables set RESEND_API_KEY <key>`).
 */

// The sender address — verified domain owned by the app developer.
// All emails come from this address; recipients never need to configure anything.
const SENDER_EMAIL = 'reports@datainsightlab.co';
const SENDER_NAME = 'Smart Sprints';
const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Shape of the email payload we send to Resend.
 */
interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64-encoded
  }>;
}

/**
 * Result returned from sendEmail — either success with the Resend message ID,
 * or failure with an error message.
 */
interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via the Resend API.
 *
 * @param apiKey    - Resend API key (from Forge environment variable)
 * @param to        - Array of recipient email addresses (max 8)
 * @param subject   - Email subject line
 * @param html      - HTML body content
 * @param pdfBuffer - Optional PDF file as a Buffer to attach
 * @param pdfFilename - Optional filename for the PDF attachment
 * @returns         - Result indicating success or failure
 */
export async function sendEmail(
  apiKey: string,
  to: string[],
  subject: string,
  html: string,
  pdfBuffer?: Buffer,
  pdfFilename?: string
): Promise<SendEmailResult> {
  // Validate inputs
  if (!apiKey) {
    return { success: false, error: 'Resend API key is not configured.' };
  }

  if (!to || to.length === 0) {
    return { success: false, error: 'No recipients specified.' };
  }

  if (to.length > 8) {
    return { success: false, error: 'Maximum 8 recipients allowed per project.' };
  }

  // Build the Resend API payload
  const payload: ResendEmailPayload = {
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to,
    subject,
    html,
  };

  // Attach the PDF if provided
  if (pdfBuffer && pdfFilename) {
    payload.attachments = [
      {
        filename: pdfFilename,
        content: pdfBuffer.toString('base64'),
      },
    ];
  }

  try {
    // POST to Resend API — Forge runtime provides global fetch via @forge/api
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      // Resend returns { statusCode, message, name } on errors
      const errorMessage = responseBody.message || `Resend API error: ${response.status}`;
      return { success: false, error: errorMessage };
    }

    // Success — Resend returns { id: "message-id-here" }
    return { success: true, messageId: responseBody.id };
  } catch (err: any) {
    return { success: false, error: `Email send failed: ${err.message || 'Unknown error'}` };
  }
}
