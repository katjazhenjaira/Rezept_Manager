import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '@/infrastructure/firebaseApp';

export function isDataUri(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export async function uploadDataUriToStorage(
  uid: string,
  folder: string,
  dataUri: string
): Promise<string> {
  const contentType = dataUri.match(/^data:([^;,]+)/)?.[1] || 'image/jpeg';
  const storageRef = ref(storage, `users/${uid}/${folder}/${crypto.randomUUID()}`);
  await uploadString(storageRef, dataUri, 'data_url', { contentType });
  return getDownloadURL(storageRef);
}

// CRIT-1 (docs/audits/2026-07-19-project-audit-report.md): base64-картинки не должны
// попадать в Firestore (лимит документа ~1MB). Репозитории прогоняют image-поля через
// эту функцию перед записью — data: URI заменяется на Storage URL, обычные значения
// (уже URL, undefined) проходят без изменений.
export async function resolveImageField(
  uid: string,
  folder: string,
  value: string | undefined
): Promise<string | undefined> {
  if (!isDataUri(value)) return value;
  return uploadDataUriToStorage(uid, folder, value);
}
