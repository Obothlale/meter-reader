import { Injectable } from '@angular/core';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const TEMPLATE_URL = 'assets/templates/Meter Readings Template.docx';

export interface MeterReadingReplacements {
  DATE: string;
  READING: string;
  PORTION: string;
  ACCOUNT_NUMBER: string;
  CONTACT_NUMBER: string;
  EMAIL: string;
  ACCOUNT_HOLDER: string;
  ADDRESS: string;
}

@Injectable({
  providedIn: 'root',
})
export class DocxTemplateService {
  private templateBuffer?: ArrayBuffer;

  async fillTemplate(replacements: MeterReadingReplacements): Promise<Blob> {
    const buffer = await this.getTemplateBuffer();
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });

    doc.render(replacements);

    const out: ArrayBuffer = doc.getZip().generate({
      type: 'arraybuffer',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  private async getTemplateBuffer(): Promise<ArrayBuffer> {
    if (this.templateBuffer) {
      return this.templateBuffer;
    }
    const response = await fetch(TEMPLATE_URL);
    if (!response.ok) {
      throw new Error(`Failed to load meter readings template (${response.status}).`);
    }
    this.templateBuffer = await response.arrayBuffer();
    return this.templateBuffer;
  }
}
