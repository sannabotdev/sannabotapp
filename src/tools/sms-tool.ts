/**
 * SmsTool – Send SMS directly without opening the SMS app
 *
 * Uses Android's SmsManager via native module to send text messages
 * directly in the background. No user interaction needed after sending.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import SmsModule from '../native/SmsModule';

export class SmsTool implements Tool {
  name(): string {
    return 'send_sms';
  }

  description(): string {
    return 'Send SMS directly without opening the SMS app. Sends the message immediately in the background.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description:
            'Recipient phone number (e.g. "+4366012345678", "06601234567")',
        },
        message: {
          type: 'string',
          description: 'The SMS text to send',
        },
      },
      required: ['phone_number', 'message'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const phoneNumber = args.phone_number as string;
    const message = args.message as string;

    if (!phoneNumber) {
      return errorResult('Missing phone_number parameter');
    }
    if (!message) {
      return errorResult('Missing message parameter');
    }

    try {
      await SmsModule.sendSms(phoneNumber, message);
      return successResult(
        `SMS sent to ${phoneNumber}: "${message}"`,
        `SMS sent`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to send SMS: ${errMsg}`);
    }
  }
}
