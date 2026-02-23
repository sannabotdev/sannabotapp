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
    return 'SMS direkt senden ohne die SMS-App zu öffnen. Sendet die Nachricht sofort im Hintergrund.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description:
            'Telefonnummer des Empfängers (z.B. "+4366012345678", "06601234567")',
        },
        message: {
          type: 'string',
          description: 'Der SMS-Text der gesendet werden soll',
        },
      },
      required: ['phone_number', 'message'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const phoneNumber = args.phone_number as string;
    const message = args.message as string;

    if (!phoneNumber) {
      return errorResult('phone_number Parameter fehlt');
    }
    if (!message) {
      return errorResult('message Parameter fehlt');
    }

    try {
      await SmsModule.sendSms(phoneNumber, message);
      return successResult(
        `SMS an ${phoneNumber} gesendet: "${message}"`,
        `SMS wurde gesendet`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`SMS senden fehlgeschlagen: ${errMsg}`);
    }
  }
}
