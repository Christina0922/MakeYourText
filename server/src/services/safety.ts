export type SafetyCheck = {
  isSafe: boolean;
  reason?: string;
  suggestedAlternative?: string;
};

const BLOCK_PATTERNS: RegExp[] = [
  /불법\s*절차/iu,
  /위조/iu,
  /해킹/iu,
];

export function runSafetyCheck(text: string): SafetyCheck {
  const t = String(text ?? "");

  for (const re of BLOCK_PATTERNS) {
    if (re.test(t)) {
      return {
        isSafe: false,
        reason: "요청 내용을 안전/정책 사유로 처리할 수 없습니다.",
        suggestedAlternative: "합법적인 범위에서 가능한 요청으로 내용을 바꿔 주시면 도와드리겠습니다.",
      };
    }
  }

  return { isSafe: true };
}
