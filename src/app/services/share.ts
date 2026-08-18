import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';

export interface ShareableFile {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export type ShareOutcome = 'shared' | 'downloaded';

@Injectable({
  providedIn: 'root',
})
export class ShareService {
  /**
   * Hands the files to the OS share sheet (so the user can pick Gmail/Mail and
   * send to the recipient shown in the UI). Falls back to downloading the
   * files and opening a mailto: draft when the Web Share API (with files)
   * isn't available, since mailto: can't carry attachments.
   */
  async shareOrDownload(
    files: ShareableFile[],
    subject: string,
    body: string,
    recipientEmail: string
  ): Promise<ShareOutcome> {
    const shareFiles = files.map(
      (f) => new File([f.blob], f.filename, { type: f.mimeType })
    );

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    const mailBody = toCrlf(body);

    if (nav.canShare && nav.share && nav.canShare({ files: shareFiles })) {
      await nav.share({
        files: shareFiles,
        title: subject,
        text: mailBody,
      });
      return 'shared';
    }

    for (const file of shareFiles) {
      saveAs(file, file.name);
    }
    const mailto = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(mailBody)}`;
    window.open(mailto, '_self');
    return 'downloaded';
  }
}

/** Mail clients expect CRLF line breaks; a bare LF is often collapsed to a space. */
function toCrlf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}
