import { TonePreset, ToneCategory, AudienceLevel, PurposeType, VoicePreset, Relationship } from '../types/index.js';

// 톤 프리셋 데이터 - 기본6 + 특수3
export const TONE_PRESETS: TonePreset[] = [
  // 기본 6개
  {
    id: 'cultured',
    label: '교양 있게',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 30, softToFirm: 40 }
  },
  {
    id: 'friendly',
    label: '친근하게',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 20, softToFirm: 20 }
  },
  {
    id: 'firm',
    label: '단호하게',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 60, softToFirm: 70 }
  },
  {
    id: 'warm',
    label: '따뜻하게 (배려)',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 25, softToFirm: 25 }
  },
  {
    id: 'apology',
    label: '사과',
    category: ToneCategory.APOLOGY,
    defaultStrength: { calmToStrong: 15, softToFirm: 20 }
  },
  {
    id: 'humorous',
    label: '유머 있게',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 25, softToFirm: 15 }
  },
  // 특수 3개
  {
    id: 'warning',
    label: '경고/시정요구 (기한 명시)',
    category: ToneCategory.STRONG,
    defaultStrength: { calmToStrong: 75, softToFirm: 80 }
  },
  {
    id: 'protest',
    label: '단호한 항의문',
    category: ToneCategory.STRONG,
    defaultStrength: { calmToStrong: 85, softToFirm: 90 }
  },
  {
    id: 'notice-formal',
    label: '공지/안내 (공식 포맷)',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 40, softToFirm: 50 }
  }
];

// 독자/연령 레벨
export const AUDIENCE_LEVELS: AudienceLevel[] = [
  { id: 'elementary1', label: '초등 저학년' },
  { id: 'elementary', label: '초등 고학년' },
  { id: 'middle', label: '중학생' },
  { id: 'high', label: '고등학생' },
  { id: 'adult', label: '성인' },
  { id: 'senior', label: '시니어' }
];

// 관계 선택
export const RELATIONSHIPS: Relationship[] = [
  { id: 'friend', label: '친구' },
  { id: 'teacher', label: '선생님' },
  { id: 'parent', label: '학부모' },
  { id: 'boss', label: '상사' },
  { id: 'customer', label: '고객' },
  { id: 'client', label: '거래처' }
];

// 목적 버튼 5개
export const PURPOSE_TYPES: PurposeType[] = [
  { id: 'request', label: '요청' },
  { id: 'notice', label: '안내/공지' },
  { id: 'apology', label: '사과' },
  { id: 'review', label: '후기/감사' },
  { id: 'complaint', label: '항의/시정요구' }
];

// 보이스 프리셋
export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'cultured-voice',
    label: '교양/격식',
    gender: 'neutral',
    age: 'mid',
    style: 'formal'
  },
  {
    id: 'friendly-voice',
    label: '친근',
    gender: 'neutral',
    age: 'young',
    style: 'friendly'
  },
  {
    id: 'work-voice',
    label: '단호/업무',
    gender: 'neutral',
    age: 'mid',
    style: 'work'
  },
  {
    id: 'apology-voice',
    label: '사과',
    gender: 'neutral',
    age: 'mid',
    style: 'apology'
  },
  {
    id: 'kids-voice',
    label: '초1',
    gender: 'neutral',
    age: 'young',
    style: 'kids'
  }
];
