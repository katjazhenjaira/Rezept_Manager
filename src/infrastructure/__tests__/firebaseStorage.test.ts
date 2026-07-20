import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/firebaseApp', () => ({ storage: {} }));

const uploadString = vi.fn();
const getDownloadURL = vi.fn();
const ref = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => ref(...args),
  uploadString: (...args: unknown[]) => uploadString(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
}));

import { isDataUri, uploadDataUriToStorage, resolveImageField } from '../firebaseStorage';

describe('isDataUri', () => {
  it('recognizes base64 data URIs', () => {
    expect(isDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects regular URLs', () => {
    expect(isDataUri('https://example.com/image.png')).toBe(false);
  });

  it('rejects undefined and null', () => {
    expect(isDataUri(undefined)).toBe(false);
    expect(isDataUri(null)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isDataUri('')).toBe(false);
  });
});

describe('uploadDataUriToStorage', () => {
  beforeEach(() => {
    uploadString.mockReset();
    getDownloadURL.mockReset();
    ref.mockReset();
    ref.mockReturnValue({ fullPath: 'mock-ref' });
    uploadString.mockResolvedValue(undefined);
    getDownloadURL.mockResolvedValue('https://storage.example.com/uploaded.png');
  });

  it('uploads under a uid-scoped path and returns the download URL', async () => {
    const url = await uploadDataUriToStorage(
      'user-123',
      'recipeImages',
      'data:image/png;base64,iVBORw0KGgo=',
    );

    expect(ref).toHaveBeenCalledWith({}, expect.stringMatching(/^users\/user-123\/recipeImages\//));
    expect(uploadString).toHaveBeenCalledWith(
      { fullPath: 'mock-ref' },
      'data:image/png;base64,iVBORw0KGgo=',
      'data_url',
      { contentType: 'image/png' },
    );
    expect(url).toBe('https://storage.example.com/uploaded.png');
  });

  it('falls back to image/jpeg when the data URI has no explicit content type', async () => {
    await uploadDataUriToStorage('user-123', 'recipeImages', 'data:;base64,iVBORw0KGgo=');
    expect(uploadString).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'data_url', {
      contentType: 'image/jpeg',
    });
  });
});

describe('resolveImageField', () => {
  beforeEach(() => {
    uploadString.mockReset();
    getDownloadURL.mockReset();
    ref.mockReset();
    ref.mockReturnValue({ fullPath: 'mock-ref' });
    uploadString.mockResolvedValue(undefined);
    getDownloadURL.mockResolvedValue('https://storage.example.com/uploaded.png');
  });

  it('uploads and replaces a data URI with a Storage URL', async () => {
    const result = await resolveImageField(
      'user-123',
      'recipeImages',
      'data:image/png;base64,abc=',
    );
    expect(result).toBe('https://storage.example.com/uploaded.png');
  });

  it('passes through an already-hosted URL unchanged', async () => {
    const result = await resolveImageField('user-123', 'recipeImages', 'https://example.com/a.png');
    expect(result).toBe('https://example.com/a.png');
    expect(uploadString).not.toHaveBeenCalled();
  });

  it('passes through undefined unchanged', async () => {
    const result = await resolveImageField('user-123', 'recipeImages', undefined);
    expect(result).toBeUndefined();
    expect(uploadString).not.toHaveBeenCalled();
  });
});
