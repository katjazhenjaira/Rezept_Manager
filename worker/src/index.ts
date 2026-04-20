import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateImage } from "./routes/generateImage";
import { calculateKbzhu } from "./routes/calculateKbzhu";
import { importFromUrl } from "./routes/importFromUrl";
import { importFromPdf } from "./routes/importFromPdf";
import { importFromPhoto } from "./routes/importFromPhoto";
import { fillRemaining } from "./routes/fillRemaining";

type Bindings = {
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) => c.text("Rezept Manager AI proxy"));

app.onError((err, c) => {
  console.error("AI proxy error:", err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

app.post("/api/ai/generate-image", generateImage);
app.post("/api/ai/calculate-kbzhu", calculateKbzhu);
app.post("/api/ai/import-from-url", importFromUrl);
app.post("/api/ai/import-from-pdf", importFromPdf);
app.post("/api/ai/import-from-photo", importFromPhoto);
app.post("/api/ai/fill-remaining", fillRemaining);

export default app;
