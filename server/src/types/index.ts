// 요금제 타입
export enum Plan {
  FREE = 'free',
  PRO = 'pro',
  BUSINESS = 'business'
}

// 톤 프리셋 카테고리
export enum ToneCategory {
  BASE = 'base',
  STRONG = 'strong',
  APOLOGY = 'apology',
  KIDS = 'kids'
}

// 톤 프리셋
export interface TonePreset {
  id: string;
  label: string;
  category: ToneCategory;
  defaultStrength: {
    calmToStrong: number;
    softToFirm: number;
  };
}

// 독자/연령 레벨
export interface AudienceLevel {
  id: string;
  label: string;
}

// 관계 선택
export interface Relationship {
  id: string;
  label: string;
}

// 목적/형식
export interface PurposeType {
  id: string;
  label: string;
}

// 강도 설정 (부드러움 ↔ 단호함만)
export interface Strength {
  softToFirm: number;   // 0-100 (부드러움 ↔ 단호함)
}

// 길이 옵션
export enum LengthOption {
  SHORT = 'short',      // 짧게 (1~2문장)
  STANDARD = 'standard', // 표준
  LONG = 'long'        // 자세히 (근거/단계 포함)
}

// 형식 옵션
export enum FormatOption {
  MESSAGE = 'message',  // 문자/카톡용
  EMAIL = 'email'       // 이메일/공문용
}

// 결과 옵션
export interface ResultOptions {
  format: 'bullet' | 'paragraph'; // 핵심 bullet / 문단형
  ambiguityWarning: boolean; // 오해 가능 표현 경고
  autoIncludeDetails: boolean; // 기한/요청사항/근거/다음 단계 자동 포함
}

// 리라이트 요청
export interface RewriteRequest {
  text: string;
  tonePresetId: string;
  purposeTypeId: string;  // 목적 버튼
  audienceLevelId: string;
  relationshipId?: string; // 관계 선택 (선택적)
  length: LengthOption;    // 길이 옵션
  format: FormatOption;    // 형식 옵션
  strength: Strength;      // 강도 (부드러움 ↔ 단호함)
  resultOptions?: ResultOptions;
  plan: Plan;
}

// 리라이트 결과 변형
export interface RewriteVariant {
  type: 'short' | 'standard' | 'long';
  text: string;
}

// 안전 검사 결과
export interface SafetyCheck {
  blocked: boolean;
  reason?: string;
  suggestedAlternative?: string;
}

// 리라이트 결과
export interface RewriteResult {
  variants: RewriteVariant[];
  safety: SafetyCheck;
}

// 사용량 제한
export interface UsageLimits {
  dailyRewrites: number;
  weeklyRewrites: number;
  maxVariants: number;
  maxVoices: number;
  voicePlayLimit: number;
  historyLimit: number;
}
