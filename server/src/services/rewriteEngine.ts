export type VariantType = "KOREAN" | "MIXED" | "ENGLISH";

export type RewriteRequest = {
  text: string;
  tonePresetId?: string;
  strength?: number; // 0~1 권장
  variantType?: VariantType;
  purposeId?: string;
  templateId?: string;
};

export type RewriteResult = {
  text: string; // 최종 결과(라우트에서 ...result 가능하도록 "객체"로 반환)
  tonePresetId: string;
  strength: number;
  variantType: VariantType;
  purposeId: string;
  templateId?: string;
};

type TonePreset = {
  id: string;
  name: string;
};

const TONE_PRESETS: TonePreset[] = [
  { id: "DEFAULT", name: "기본" },
  { id: "WARM", name: "따뜻함" },
  { id: "FORMAL", name: "정중함" },
  { id: "CLEAR", name: "명확함" },
];

/**
 * ✅ 라우트에서 import 하던 rewriteTextForTemplate를 실제로 export 합니다.
 * ✅ 호출 방식이 프로젝트마다 달라서 2가지 형태를 동시에 지원합니다.
 *    1) rewriteTextForTemplate(rewriteRequest)
 *    2) rewriteTextForTemplate(templateId, rewriteRequest)
 */
export function rewriteTextForTemplate(arg1: any, arg2?: any): RewriteResult {
  if (typeof arg1 === "string") {
    const templateId = arg1;
    const req: RewriteRequest = (arg2 ?? {}) as RewriteRequest;
    return rewriteText({ ...req, templateId });
  }

  const req: RewriteRequest = (arg1 ?? {}) as RewriteRequest;
  if (!req.templateId) {
    // template 전용인데 templateId가 없으면 기본값
    return rewriteText({ ...req, templateId: "DEFAULT_TEMPLATE" });
  }
  return rewriteText(req);
}

/**
 * ✅ 라우트가 넘기는 RewriteRequest 형태를 그대로 받습니다.
 * ✅ 반환값은 string이 아니라 object(RewriteResult)라서 ...result가 가능합니다.
 */
export function rewriteText(req: RewriteRequest): RewriteResult {
  const originalText = String(req?.text ?? "");
  const tonePresetId = (req?.tonePresetId ?? "DEFAULT").toString();
  const strength = normalizeStrength(req?.strength);
  const variantType: VariantType = (req?.variantType ?? "KOREAN") as VariantType;
  const purposeId = (req?.purposeId ?? "general").toString();
  const templateId = req?.templateId ? String(req.templateId) : undefined;

  let out = originalText.trim();

  // purpose 기반 처리(기존 코드에서 purposeId 에러 나던 부분을 안전하게 흡수)
  if (purposeId.toLowerCase() === "request") {
    out = softenEnding(out);
  }

  out = applyTone(out, tonePresetId, strength, variantType, originalText, purposeId);

  out = cleanupSpacing(out);

  return {
    text: out,
    tonePresetId,
    strength,
    variantType,
    purposeId,
    templateId,
  };
}

function applyTone(
  text: string,
  tonePresetId: string,
  strength: number,
  variantType: VariantType,
  originalText: string,
  purposeId?: string
): string {
  const preset = TONE_PRESETS.find((p) => p.id === tonePresetId) ?? TONE_PRESETS[0];
  const s = clamp01(strength);

  let out = (text ?? "").trim();

  // 필요하면 variantType에 따라 규칙을 확장하시면 됩니다(현재는 빌드/실행 안정 우선)
  if (preset.id === "WARM") out = warmify(out, s);
  else if (preset.id === "FORMAL") out = formalize(out, s);
  else if (preset.id === "CLEAR") out = clarify(out, s);
  else out = neutralize(out, s);

  // originalText, purposeId는 향후 로직 확장용으로 유지
  void originalText;
  void purposeId;

  if (variantType === "ENGLISH") return out;
  if (variantType === "MIXED") return out;
  return out;
}

function normalizeStrength(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0.6;
  return clamp01(n);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function cleanupSpacing(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function softenEnding(s: string): string {
  if (/[요]\s*$/u.test(s)) return s;

  if (/다\s*$/u.test(s)) return s.replace(/다\s*$/u, "드립니다.");
  if (/함\s*$/u.test(s)) return s.replace(/함\s*$/u, "하겠습니다.");

  return s + " 부탁드립니다.";
}

function warmify(s: string, strength: number): string {
  if (strength < 0.3) return s;
  if (!/[요]\s*$/u.test(s)) return softenEnding(s);
  return s;
}

function formalize(s: string, strength: number): string {
  if (strength < 0.3) return s;
  return s
    .replace(/해줘/gu, "부탁드립니다")
    .replace(/해라/gu, "해 주시기 바랍니다")
    .trim();
}

function clarify(s: string, strength: number): string {
  if (strength < 0.3) return s;
  return s.replace(/그리고\s+/gu, "또한 ").trim();
}

function neutralize(s: string, _strength: number): string {
  return s.trim();
}
