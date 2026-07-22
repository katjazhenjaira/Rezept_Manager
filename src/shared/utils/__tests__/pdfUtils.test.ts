// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as pdfjs from 'pdfjs-dist';

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'stub-worker-url' }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { extractTextFromPDF, extractImageFromPDF } from '../pdfUtils';

const getDocument = vi.mocked(pdfjs.getDocument);

// Real canvas render/crop path in extractImageFromPDF is NOT exercisable in
// jsdom (no Canvas 2D context) — documented as untestable, per tech doc.

describe('extractTextFromPDF', () => {
  it('joins page text with page markers and a page separator', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async () => ({
          getTextContent: async () => ({ items: [{ str: 'hello' }, { str: 'world' }] }),
        }),
      }),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    const result = await extractTextFromPDF(btoa('fake-pdf-bytes'));

    expect(result).toContain('--- Page 1 ---');
    expect(result).toContain('--- Page 2 ---');
    expect(result).toContain('hello world');
    expect(result.split('\n')).toEqual([
      '--- Page 1 ---',
      'hello world',
      '--- Page 2 ---',
      'hello world',
    ]);
  });

  it('returns "" when getDocument().promise rejects', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('boom')),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    const result = await extractTextFromPDF(btoa('fake-pdf-bytes'));

    expect(result).toBe('');
  });

  it('returns "" when pdfData is invalid base64 (atob throws)', async () => {
    const result = await extractTextFromPDF('!!!not-base64!!!');

    expect(result).toBe('');
  });
});

describe('extractImageFromPDF', () => {
  it('returns "" (no 2d canvas context in jsdom, or mock render throws — both caught)', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 100, height: 100 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    const result = await extractImageFromPDF(btoa('fake-pdf-bytes'), 1, {
      ymin: 0,
      xmin: 0,
      ymax: 500,
      xmax: 500,
    });

    expect(result).toBe('');
  });

  it('returns "" when getDocument().promise rejects', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('boom')),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    const result = await extractImageFromPDF(btoa('fake-pdf-bytes'), 1, {
      ymin: 0,
      xmin: 0,
      ymax: 500,
      xmax: 500,
    });

    expect(result).toBe('');
  });
});
