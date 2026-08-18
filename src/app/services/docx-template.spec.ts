import { TestBed } from '@angular/core/testing';

import { DocxTemplateService } from './docx-template';

describe('DocxTemplateService', () => {
  let service: DocxTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocxTemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
