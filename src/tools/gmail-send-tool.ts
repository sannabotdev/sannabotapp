/**
 * GmailSendTool – Send emails via Gmail API
 *
 * Takes email parameters and automatically handles RFC 2822 formatting
 * and base64url encoding. Only available when Gmail skill is enabled
 * and Google credentials are configured.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import type { CredentialManager } from '../permissions/credential-manager';

export class GmailSendTool implements Tool {
  private credentialManager: CredentialManager;

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  name(): string {
    return 'gmail_send';
  }

  description(): string {
    return 'Send emails via Gmail API. Takes email parameters (to, subject, body, etc.) and automatically handles formatting and encoding. Only available when Gmail is enabled and configured.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address(es). Multiple addresses can be separated by commas.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body text',
        },
        cc: {
          type: 'string',
          description: 'CC recipient email address(es). Multiple addresses can be separated by commas.',
        },
        bcc: {
          type: 'string',
          description: 'BCC recipient email address(es). Multiple addresses can be separated by commas.',
        },
        threadId: {
          type: 'string',
          description: 'Thread ID for replying to an existing email thread',
        },
        inReplyTo: {
          type: 'string',
          description: 'Message-ID for In-Reply-To header (for replies). Should include angle brackets, e.g. "<message-id@mail.gmail.com>"',
        },
        references: {
          type: 'string',
          description: 'Message-ID for References header (for replies). Should include angle brackets, e.g. "<message-id@mail.gmail.com>"',
        },
      },
      required: ['to', 'subject', 'body'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const to = args.to as string;
    const subject = args.subject as string;
    const body = args.body as string;
    const cc = args.cc as string | undefined;
    const bcc = args.bcc as string | undefined;
    const threadId = args.threadId as string | undefined;
    const inReplyTo = args.inReplyTo as string | undefined;
    const references = args.references as string | undefined;

    // Validate required parameters
    if (!to || typeof to !== 'string') {
      return errorResult('Missing or invalid "to" parameter');
    }
    if (!subject || typeof subject !== 'string') {
      return errorResult('Missing or invalid "subject" parameter');
    }
    if (!body || typeof body !== 'string') {
      return errorResult('Missing or invalid "body" parameter');
    }

    // Check if Google credentials are available
    const token = await this.credentialManager.getToken('google');
    if (!token) {
      return errorResult(
        'Google credentials not configured. Please configure Gmail in settings.',
      );
    }

    try {
      // Build RFC 2822 email format
      const emailLines: string[] = [];

      // Required headers
      emailLines.push(`To: ${to}`);
      emailLines.push(`Subject: ${subject}`);

      // Optional headers
      if (cc) {
        emailLines.push(`Cc: ${cc}`);
      }
      if (bcc) {
        emailLines.push(`Bcc: ${bcc}`);
      }
      if (inReplyTo) {
        emailLines.push(`In-Reply-To: ${inReplyTo}`);
      }
      if (references) {
        emailLines.push(`References: ${references}`);
      }

      // Blank line before body
      emailLines.push('');
      emailLines.push(body);

      const emailText = emailLines.join('\n');

      // Encode to base64url (React Native/Hermes-safe UTF-8 to base64)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const utf8Bytes = unescape(encodeURIComponent(emailText));
      const base64 = btoa(utf8Bytes);
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Prepare request body
      const requestBody: { raw: string; threadId?: string } = {
        raw: base64url,
      };
      if (threadId) {
        requestBody.threadId = threadId;
      }

      // Send to Gmail API
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error message available');
        return errorResult(
          `Gmail API error: HTTP ${response.status} ${response.statusText}: ${errorText.slice(0, 300)}`,
        );
      }

      const responseData = await response.json().catch(() => null);
      const messageId = responseData?.id || 'unknown';

      return successResult(
        `Email sent successfully. Message ID: ${messageId}`,
        'Email sent',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to send email: ${message}`);
    }
  }
}
