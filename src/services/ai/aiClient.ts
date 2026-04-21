import type {
  ImportFromUrlRequest,
  ImportFromUrlResponse,
  ImportFromPdfRequest,
  ImportFromPdfResponse,
  ImportFromPhotoRequest,
  ImportFromPhotoResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  CalculateKbzhuRequest,
  CalculateKbzhuResponse,
  FillRemainingRequest,
  FillRemainingResponse,
} from "./contracts";

const API_BASE = `${import.meta.env.VITE_AI_WORKER_URL ?? ""}/api/ai`;

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI proxy ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TRes;
}

export const aiClient = {
  importFromUrl: (req: ImportFromUrlRequest) =>
    post<ImportFromUrlRequest, ImportFromUrlResponse>("/import-from-url", req),
  importFromPdf: (req: ImportFromPdfRequest) =>
    post<ImportFromPdfRequest, ImportFromPdfResponse>("/import-from-pdf", req),
  importFromPhoto: (req: ImportFromPhotoRequest) =>
    post<ImportFromPhotoRequest, ImportFromPhotoResponse>("/import-from-photo", req),
  generateImage: (req: GenerateImageRequest) =>
    post<GenerateImageRequest, GenerateImageResponse>("/generate-image", req),
  calculateKbzhu: (req: CalculateKbzhuRequest) =>
    post<CalculateKbzhuRequest, CalculateKbzhuResponse>("/calculate-kbzhu", req),
  fillRemaining: (req: FillRemainingRequest) =>
    post<FillRemainingRequest, FillRemainingResponse>("/fill-remaining", req),
};
