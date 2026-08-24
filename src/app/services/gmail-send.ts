import { Injectable } from '@angular/core';
import { blobToBase64 } from '../util/base64.util';
import { buildRawEmail } from '../util/mime-message.util';

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface GmailAttachmentInput {
  filename: string;
  mimeType: string;
  blob: Blob;
}

export interface SendEmailParams {
  to: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments: GmailAttachmentInput[];
}

@Injectable({
  providedIn: 'root',
})
export class GmailSendService {
  /** Sends an email as the account behind `accessToken`, via the Gmail REST API. */
  async sendEmail(accessToken: string, params: SendEmailParams): Promise<void> {
    const attachments = await Promise.all(
      params.attachments.map(async (attachment) => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        base64: await blobToBase64(attachment.blob),
      }))
    );

    const raw = buildRawEmail({
      to: params.to,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      attachments,
    });

    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message || `Gmail API request failed (${response.status}).`;
  } catch {
    return `Gmail API request failed (${response.status}).`;
  }
}
