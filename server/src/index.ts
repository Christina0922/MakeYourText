import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rewriteText, rewriteTextForTemplate } from "./services/rewriteEngine.js";
import { runSafetyCheck } from "./services/safety.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT: number = (() => {
  const n = Number(process.env.PORT ?? 5000);
  return Number.isFinite(n) ? n : 5000;
})();

/**
 * ✅ health 엔드포인트는 여러 형태로 다 열어둡니다.
 * 클라이언트/프록시/테스트 코드가 어느 경로로 오든 404를 피하게 합니다.
 */
app.get("/", (_req, res) => res.json({ ok: true, service: "makeyourtext-server" }));
app.get("/health", (_req, res) => res.json({ ok: true, port: PORT }));
app.get("/api/health", (_req, res) => res.json({ ok: true, port: PORT }));

/**
 * ✅ 클라이언트가 가장 자주 부르는 패턴들을 모두 수용:
 * - POST /rewrite
 * - POST /api/rewrite
 * - POST /rewrite/template
 * - POST /api/rewrite/template
 *
 * 404를 없애는 목적이므로, 실제로 어떤 경로를 호출하든 같은 로직으로 처리합니다.
 */
type RewriteBody = {
  text?: string;
  tonePresetId?: string;
  strength?: number;
  variantType?: "KOREAN" | "MIXED" | "ENGLISH";
  purposeId?: string;
  templateId?: string;
};

function handleRewrite(req: express.Request, res: express.Response) {
  try {
    const body: RewriteBody = req.body ?? {};
    const text = String(body.text ?? "").trim();

    if (!text) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    const safety = runSafetyCheck(text);
    if (!safety.isSafe) {
      return res.status(400).json({
        ok: false,
        error: safety.reason ?? "blocked",
        suggestedAlternative: safety.suggestedAlternative ?? null,
      });
    }

    // 템플릿이 있으면 템플릿용 함수로 처리, 없으면 일반 처리
    const resultObj = body.templateId
      ? rewriteTextForTemplate(String(body.templateId), {
          text,
          tonePresetId: body.tonePresetId,
          strength: body.strength,
          variantType: body.variantType,
          purposeId: body.purposeId,
        })
      : rewriteText({
          text,
          tonePresetId: body.tonePresetId,
          strength: body.strength,
          variantType: body.variantType,
          purposeId: body.purposeId,
        });

    // ✅ 클라이언트가 {...result} 형태를 기대해도 깨지지 않게 객체 그대로 반환
    return res.json({ ok: true, ...resultObj });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "server error" });
  }
}

app.post("/rewrite", handleRewrite);
app.post("/api/rewrite", handleRewrite);
app.post("/rewrite/template", handleRewrite);
app.post("/api/rewrite/template", handleRewrite);

/**
 * ✅ 일부 프론트는 quota 같은 엔드포인트를 먼저 치는 경우가 있습니다.
 * 없어서 404가 나면 "서버 연결 실패"로 오해하는 UI가 흔해서,
 * 기본 응답을 제공해 404를 없앱니다.
 */
app.get("/quota", (_req, res) => res.json({ ok: true, remaining: null }));
app.get("/api/quota", (_req, res) => res.json({ ok: true, remaining: null }));

/**
 * ✅ 디버깅용: 404가 계속 뜰 때 "어떤 경로로 왔는지" 서버 콘솔에 찍히게 합니다.
 * (원하면 나중에 제거하셔도 됩니다.)
 */
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.url });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[makeyourtext-server] listening on ${PORT}`);
});
