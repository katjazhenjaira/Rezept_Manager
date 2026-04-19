import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateImage } from "./routes/generateImage";
import { calculateKbzhu } from "./routes/calculateKbzhu";
import { importFromUrl } from "./routes/importFromUrl";
import { importFromPdf } from "./routes/importFromPdf";

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

// Остальные 2 ещё не портированы — stubs.
const NOT_IMPLEMENTED = { error: "Not implemented yet (Phase 0b)" };
app.post("/api/ai/import-from-photo", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/fill-remaining", (c) => c.json(NOT_IMPLEMENTED, 501));

export default app;
