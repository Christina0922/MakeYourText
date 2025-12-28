import { TonePreset, ToneCategory, AudienceLevel, PurposeType, VoicePreset, Relationship } from '../types/index.js';

// 톤 프리셋 데이터
export const TONE_PRESETS: TonePreset[] = [
  // 기본 프리셋
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
    id: 'humorous',
    label: '유머 있게',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 25, softToFirm: 15 }
  },
  {
    id: 'apology',
    label: '사과',
    category: ToneCategory.APOLOGY,
    defaultStrength: { calmToStrong: 15, softToFirm: 20 }
  },
  // 새로운 톤 프리셋
  {
    id: 'warm',
    label: '따뜻하게 (배려)',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 25, softToFirm: 25 }
  },
  {
    id: 'casual',
    label: '캐주얼 (친근)',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 20, softToFirm: 15 }
  },
  {
    id: 'formal',
    label: '포멀 (공식)',
    category: ToneCategory.BASE,
    defaultStrength: { calmToStrong: 40, softToFirm: 50 }
  },
  // 강경 프리셋
  {
    id: 'strong',
    label: '강경(시정요구/기한 명시)',
    category: ToneCategory.STRONG,
    defaultStrength: { calmToStrong: 80, softToFirm: 85 }
  },
  {
    id: 'warning',
    label: '경고/시정요구',
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
    id: 'ultimatum',
    label: '최후통첩 톤',
    category: ToneCategory.STRONG,
    defaultStrength: { calmToStrong: 90, softToFirm: 95 }
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

// 목적/형식
export const PURPOSE_TYPES: PurposeType[] = [
  { id: 'kakaotalk', label: '카톡/문자' },
  { id: 'email', label: '이메일' },
  { id: 'notice', label: '공지문(학원/학교/모임)' },
  { id: 'review', label: '후기/추천사' },
  { id: 'request', label: '요청/문의/민원' },
  { id: 'apology', label: '사과문' },
  { id: 'introduction', label: '자기소개/소개글' },
  { id: 'report', label: '보고/요약' },
  // 카테고리별 기본 틀
  { id: 'parent-notice', label: '학부모 공지 (결석/보강/숙제/상담/방학특강)' },
  { id: 'company-email', label: '회사 메일 (요청/확인/리마인드/사과/감사)' },
  { id: 'student-assignment', label: '학생 과제 (요약/소감/발표 대본)' },
  { id: 'customer-service', label: '고객 응대 (문의 답변/환불/지연 안내)' }
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

