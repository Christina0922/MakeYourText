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

// 영어 도우미 모드
export enum EnglishHelperMode {
  OFF = 'off',          // 영어 금지
  PAREN = 'paren',      // 한국어 문장 뒤에 괄호로 영어 1줄 추가
  TWOLINES = 'twoLines' // 한국어 1줄 + 영어 1줄 병기
}

// 보이스 프리셋
export interface VoicePreset {
  id: string;
  label: string;
  gender: string;
  age: string;
  style: string;
}

// 음성 컨트롤
export interface VoiceControls {
  rate: number;
  pitch: number;
  emotion: number;
}

// 결과 옵션
export interface ResultOptions {
  format: 'bullet' | 'paragraph'; // 핵심 bullet / 문단형
  ambiguityWarning: boolean; // 오해 가능 표현 경고
  autoIncludeDetails: boolean; // 기한/요청사항/근거/다음 단계 자동 포함
}

// 템플릿 정의 (상황/연령/채널/관계 조합)
export interface Template {
  id: string;
  name: string;
  purposeId: string;      // 상황: 요청/안내공지/사과/후기감사/항의시정요구
  audienceId: string;     // 연령: 어린이/청소년/성인/시니어
  format: FormatOption;   // 채널: 문자/이메일
  relationshipId?: string; // 관계 (선택)
  toneId: string;         // 톤
  tags: string[];         // 태그 (연령·채널·관계)
  group: string;          // 그룹 (상황)
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
  language?: string;       // 언어 (ko, en, ja)
  englishHelperMode?: EnglishHelperMode; // 영어 도우미 모드
  plan: Plan;
  selectedTemplates?: string[]; // ✅ 템플릿 ID 배열 (일괄 생성용)
}

// 리라이트 결과 변형
export interface RewriteVariant {
  type: 'short' | 'standard' | 'long';
  text: string;
}

// 템플릿별 결과
export interface TemplateResult {
  templateId: string;
  templateName: string;
  tags: string[];
  text: string;
  error?: string;
}

// 리라이트 결과
export interface RewriteResult {
  variants: RewriteVariant[];
  safety: {
    blocked: boolean;
    reason?: string;
  };
  templateResults?: TemplateResult[]; // ✅ 템플릿별 결과 (일괄 생성용)
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

// 안전 검사 결과
export interface SafetyCheck {
  blocked: boolean;
  reason?: string;
}
