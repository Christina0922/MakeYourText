import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rewriteText } from "./services/rewriteEngine.js";
import { runSafetyCheck } from "./services/safety.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT: number = (() => {
  const n = Number(process.env.PORT ?? 5000);
  return Number.isFinite(n) ? n : 5000;
})();

app.get("/health", (_req, res) => {
  res.json({ ok: true, port: PORT });
});

app.post("/api/rewrite", (req, res) => {
  try {
    const text = String(req?.body?.text ?? "");
    if (!text.trim()) return res.status(400).json({ ok: false, error: "text is required" });

    const safety = runSafetyCheck(text);
    if (!safety.isSafe) {
      return res.status(400).json({
        ok: false,
        error: safety.reason ?? "blocked",
        suggestedAlternative: safety.suggestedAlternative ?? null,
      });
    }

    // ✅ rewriteText가 이제 "객체"를 반환합니다.
    const resultObj = rewriteText({
      text,
      tonePresetId: req?.body?.tonePresetId,
      strength: req?.body?.strength,
      variantType: req?.body?.variantType,
      purposeId: req?.body?.purposeId,
      templateId: req?.body?.templateId,
    });

    return res.json({ ok: true, ...resultObj });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[makeyourtext-server] listening on ${PORT}`);
});
