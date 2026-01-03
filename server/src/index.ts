import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { rewriteText, rewriteTextForTemplate } from "./services/rewriteEngine.js";
import { runSafetyCheck } from "./services/safety.js";
import presetsRouter from "./routes/presets.js";
import { init as initQuotaStore, getUsage, addUsage, getPlan, getNextResetTime } from "./services/quotaStore.js";
import { quotaGuard } from "./middlewares/quotaGuard.js";
import billingRouter from "./routes/billing.js";
import { synthesizeSpeech, listVoices } from "./services/ttsGoogleChirpHd.js";
import ttsPreviewRouter from "./routes/ttsPreview.js";

dotenv.config();

// Quota Store 초기화
let quotaStoreInitialized = false;
try {
  initQuotaStore();
  quotaStoreInitialized = true;
  console.log('[server] Quota store initialized');
} catch (error: any) {
  console.error('[server] Failed to initialize quota store:', error);
  console.warn('[server] Continuing without quota store (requests will not be limited)');
}

const app = express();

app.use(cors());
app.options("*", cors()); // 사전요청(OPTIONS) 처리
app.use(express.json({ limit: "2mb" }));

const PORT: number = (() => {
  const n = Number(process.env.PORT ?? 5000);
  return Number.isFinite(n) ? n : 5000;
})();

// 어떤 요청이 들어오는지 콘솔에 찍기
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// 기본/상태 확인
app.get("/", (_req, res) => res.json({ ok: true, service: "makeyourtext-server" }));
app.get("/health", (_req, res) => res.json({ ok: true, port: PORT }));
app.get("/api/health", (_req, res) => res.json({ ok: true, port: PORT }));

// Quota 조회 엔드포인트
app.get("/api/quota", (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'USER_ID_REQUIRED',
        message: 'x-user-id header is required'
      });
    }

    let plan: 'FREE' | 'PRO' = 'FREE';
    let usage = { requests: 0, chars: 0 };

    try {
      const planResult = getPlan(userId);
      plan = planResult.plan;
      usage = getUsage(userId);
    } catch (error: any) {
      console.error('[quota] Failed to get quota:', error);
      // 에러 발생 시 기본값 반환
    }
    
    const FREE_DAILY_REQUESTS = parseInt(process.env.FREE_DAILY_REQUESTS || '20', 10);
    const FREE_DAILY_CHARS = parseInt(process.env.FREE_DAILY_CHARS || '20000', 10);

    if (plan === 'PRO') {
      return res.json({
        ok: true,
        plan: 'PRO',
        quota: {
          limitRequests: -1,
          usedRequests: usage.requests,
          limitChars: -1,
          usedChars: usage.chars,
          resetAt: getNextResetTime()
        }
      });
    }

    return res.json({
      ok: true,
      plan: 'FREE',
      quota: {
        limitRequests: FREE_DAILY_REQUESTS,
        usedRequests: usage.requests,
        limitChars: FREE_DAILY_CHARS,
        usedChars: usage.chars,
        resetAt: getNextResetTime()
      }
    });
  } catch (error: any) {
    console.error('[quota] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

app.get("/quota", (req, res) => {
  // /api/quota로 리다이렉트
  return res.redirect('/api/quota');
});

app.get("/api/voices", (_req, res) =>
  res.json({
    ok: true,
    voices: [], // 필요하면 나중에 실제 목록으로 채우면 됩니다.
  })
);

app.get("/api/templates", (_req, res) =>
  res.json({
    ok: true,
    templates: [], // 필요하면 나중에 실제 템플릿 목록으로 채우면 됩니다.
  })
);

// 프리셋 라우터 등록
app.use("/api/presets", presetsRouter);

// 결제 라우터 등록
app.use("/api/billing", billingRouter);

// TTS Preview 라우터 등록 (우선순위 높게)
app.use("/tts", ttsPreviewRouter);
app.use("/api/tts", ttsPreviewRouter);

// TTS API
app.get("/api/tts/voices", async (_req, res) => {
  try {
    const voices = await listVoices();
    return res.json({
      ok: true,
      voices
    });
  } catch (error: any) {
    console.error('[TTS] List voices error:', error);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// TTS Preview는 ttsPreviewRouter에서 처리

// 리라이트 처리
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

    // 사용량 추가 (성공 시에만)
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      try {
        addUsage(userId, 1, text.length);
      } catch (error: any) {
        console.error('[handleRewrite] Failed to add usage:', error);
        // 사용량 추가 실패해도 응답은 반환
      }
    }

    return res.json({ ok: true, ...resultObj });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "server error" });
  }
}

// 프론트가 흔히 부르는 경로들 (quotaGuard 적용)
app.post("/api/rewrite", quotaGuard, handleRewrite);
app.post("/rewrite", quotaGuard, handleRewrite);
app.post("/api/rewrite/template", quotaGuard, handleRewrite);
app.post("/rewrite/template", quotaGuard, handleRewrite);

// 혹시 모르는 /api 하위 요청은 404 대신 200으로 응답(프론트가 404로 죽는 것 방지 + 경로 추적)
// 주의: /api/tts/preview는 위에서 이미 처리되므로 여기서는 제외
app.all("/api/*", (req, res) => {
  // /api/tts/preview는 이미 위에서 처리되므로 제외
  if (req.url === '/api/tts/preview' || req.url.startsWith('/api/tts/')) {
    return res.status(404).json({
      ok: false,
      error: 'NOT_FOUND',
      path: req.url
    });
  }
  
  // text가 있으면 rewrite로 처리(경로가 달라도 동작하게)
  if (req.method === "POST" && typeof (req.body as any)?.text === "string") {
    return handleRewrite(req, res);
  }

  return res.status(200).json({
    ok: false,
    note: "아직 구현되지 않은 경로입니다. path를 확인해서 필요한 엔드포인트를 추가하세요.",
    method: req.method,
    path: req.url,
  });
});

// 최종 404 (여기까지 왔다는 건 /api도 아니고, 위에서 처리되지 않은 요청)
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.url });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[makeyourtext-server] listening on ${PORT}`);
});
