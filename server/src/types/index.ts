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

// 강도 설정
export interface Strength {
  calmToStrong: number; // 0-100
  softToFirm: number;   // 0-100
}

// 보이스 프리셋
export interface VoicePreset {
  id: string;
  label: string;
  gender: 'neutral' | 'm' | 'f';
  age: 'young' | 'mid' | 'senior';
  style: 'formal' | 'friendly' | 'work' | 'apology' | 'kids';
}

// 음성 컨트롤
export interface VoiceControls {
  rate: number;      // 0.8-1.2
  pitch: number;     // 낮게~높게 (0-100)
  emotion: number;   // 담백~감정 있음 (0-100)
}

// 결과 옵션
export interface ResultOptions {
  format: 'bullet' | 'paragraph'; // 핵심 bullet / 문단형
  ambiguityWarning: boolean; // 오해 가능 표현 경고
}

// 리라이트 요청
export interface RewriteRequest {
  text: string;
  tonePresetId: string;
  audienceLevelId: string;
  relationshipId?: string; // 관계 선택 (선택적)
  purposeTypeId: string;
  strength: Strength;
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

