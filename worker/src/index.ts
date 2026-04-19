import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) => c.text("Rezept Manager AI proxy"));

// 6 stub routes — реализация в слайсе 2 (порт вызовов из App.tsx).
const NOT_IMPLEMENTED = { error: "Not implemented yet (Phase 0b slice 2)" };

app.post("/api/ai/import-from-url", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/import-from-pdf", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/import-from-photo", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/generate-image", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/calculate-kbzhu", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/fill-remaining", (c) => c.json(NOT_IMPLEMENTED, 501));

export default app;
