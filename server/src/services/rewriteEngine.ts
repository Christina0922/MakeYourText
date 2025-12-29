import { RewriteRequest, RewriteResult, RewriteVariant, Strength, LengthOption, FormatOption, EnglishHelperMode } from '../types/index.js';
import { TONE_PRESETS, AUDIENCE_LEVELS, PURPOSE_TYPES, RELATIONSHIPS } from '../data/presets.js';
import { getPlanLimits } from './planLimits.js';
import { validateTextSafety } from './safety.js';

// DEV 모드: 환경변수로 제한 우회
const BYPASS_LIMITS = process.env.BYPASS_LIMITS === 'true' || 
                      process.env.NODE_ENV === 'development';

/**
 * 리라이트 엔진 (규칙 기반)
 */
export function rewriteText(request: RewriteRequest): RewriteResult {
  // 안전 검사
  const safety = validateTextSafety(request.text, request.tonePresetId);
  if (safety.blocked) {
    return {
      variants: [],
      safety
    };
  }
  
  const tonePreset = TONE_PRESETS.find(t => t.id === request.tonePresetId);
  const audience = AUDIENCE_LEVELS.find(a => a.id === request.audienceLevelId);
  const purpose = PURPOSE_TYPES.find(p => p.id === request.purposeTypeId);
  const limits = getPlanLimits(request.plan);
  
  if (!tonePreset || !audience || !purpose) {
    return {
      variants: [],
      safety: { blocked: false }
    };
  }
  
  const variants: RewriteVariant[] = [];
  
  // 무료: 1~2버전, 유료: 3버전
  // DEV 모드 또는 요청된 length 옵션에 따라 variantTypes 결정
  const variantTypes: Array<'short' | 'standard' | 'long'> = 
    (BYPASS_LIMITS || limits.maxVariants >= 3)
      ? ['short', 'standard', 'long']
      : request.length === LengthOption.SHORT 
        ? ['short']
        : request.length === LengthOption.LONG
          ? ['long']
          : ['standard', 'short'];
  
  const relationship = request.relationshipId 
    ? RELATIONSHIPS.find(r => r.id === request.relationshipId)
    : null;
  
  // 각 variantType별로 독립적으로 생성
  for (const type of variantTypes) {
    const rewritten = applyRewriteRules(
      request.text,
      tonePreset,
      audience,
      purpose,
      relationship,
      request.strength,
      request.format,
      request.length,
      type,
      request.resultOptions,
      request.language || 'ko',
      request.englishHelperMode || EnglishHelperMode.OFF
    );
    variants.push({ type, text: rewritten });
  }
  
  return {
    variants,
    safety: { blocked: false }
  };
}

/**
 * 리라이트 규칙 적용
 */
function applyRewriteRules(
  text: string,
  tonePreset: any,
  audience: any,
  purpose: any,
  relationship: any,
  strength: Strength,
  format: FormatOption,
  requestedLength: LengthOption,
  variantType: 'short' | 'standard' | 'long',
  resultOptions: any,
  language: string,
  englishHelperMode: EnglishHelperMode
): string {
  let result = text;
  
  // 0. 한국어 모드에서 영어 입력을 한국어로 변환 (템플릿 적용 전에 실행)
  if (language === 'ko') {
    result = convertEnglishToKorean(result);
  }
  
  // 1. 목적/형식 템플릿 적용 (원문이 비어있으면 템플릿 접두어/접미어를 붙이지 않음)
  result = applyPurposeTemplate(result, purpose.id, resultOptions?.autoIncludeDetails);
  
  // 2. 톤 적용 (톤별로 명확히 다른 결과)
  result = applyTone(result, tonePreset.id, strength, variantType);
  
  // 3. 형식 옵션 적용 (문자/카톡 vs 이메일/공문)
  result = applyFormatOption(result, format);
  
  // 4. 관계 적용 (라벨 접두어 없이 자연스럽게)
  if (relationship) {
    result = applyRelationship(result, relationship.id);
  }
  
  // 5. 독자 레벨 적용
  result = applyAudienceLevel(result, audience.id);
  
  // 6. 부드러운 요청형 규칙 적용 (특히 "짧게" 카드) - 마지막에 적용하여 항상 부드럽게
  result = applySoftRequestRule(result, variantType, strength);
  
  // 7. 길이별 강제 규칙 적용 (마지막에 적용하여 문장 수 제어)
  result = applyLengthRule(result, variantType, resultOptions);
  
  // 8. 언어 정책 강제 후처리 (한국어 모드에서 영어 섞임 방지) - 최종 후처리
  result = applyLanguagePolicy(result, language, englishHelperMode);
  
  return result;
}

/**
 * 영어 입력을 한국어로 변환 (템플릿 적용 전에 실행)
 */
function convertEnglishToKorean(text: string): string {
  let result = text;
  
  // 영어 질문 패턴을 한국어로 변환
  const englishPatterns: Array<[RegExp, string]> = [
    [/Why are you smiling\?/gi, '왜 웃고 계신가요'],
    [/Why are you doing this\?/gi, '왜 이렇게 하시는 건가요'],
    [/What are you doing these days\?/gi, '요즘 어떻게 지내세요'],
    [/What are you doing\?/gi, '무엇을 하고 계세요'],
    [/How are you\?/gi, '어떻게 지내세요'],
    [/How is it going\?/gi, '어떻게 지내세요'],
    [/Can you help me\?/gi, '도와주실 수 있을까요'],
    [/Could you help me\?/gi, '도와주실 수 있을까요'],
    [/Please help me/gi, '도와주세요'],
    [/Thank you/gi, '감사합니다'],
    [/Thanks/gi, '고맙습니다'],
    [/Why/gi, '왜'],
    [/What/gi, '무엇을'],
    [/How/gi, '어떻게'],
    [/Can you/gi, '할 수 있을까요'],
    [/Could you/gi, '할 수 있을까요'],
    [/Please/gi, '부탁드립니다'],
    [/smiling/gi, '웃고 계신'],
    [/doing/gi, '하고 계신'],
    [/this/gi, '이것'],
    [/that/gi, '그것'],
  ];
  
  // 영어 문장이 대부분이면 한국어로 변환
  const englishWordCount = (result.match(/\b[A-Za-z]+\b/g) || []).length;
  const totalWordCount = result.split(/\s+/).filter(w => w.trim().length > 0).length;
  
  if (englishWordCount > totalWordCount * 0.5) {
    // 영어 문장이 대부분이면 패턴 매칭으로 변환
    for (const [pattern, replacement] of englishPatterns) {
      result = result.replace(pattern, replacement);
    }
    
    // 남은 영어 단어들을 일반적인 한국어 표현으로 변환
    result = result.replace(/\b[A-Za-z]+\b/g, (match) => {
      // 고유명사나 약어는 보존
      const preserved = ['API', 'URL', 'PDF', 'PPT', 'HTML', 'CSS', 'JS', 'AI', 'IT'];
      if (preserved.includes(match.toUpperCase())) {
        return match;
      }
      // 일반 영어 단어는 제거 (한국어로 이미 변환되었으므로)
      return '';
    }).replace(/\s+/g, ' ').trim();
  }
  
  return result;
}

/**
 * 부드러운 요청형 규칙 적용 (특히 "짧게" 카드)
 */
function applySoftRequestRule(text: string, variantType: 'short' | 'standard' | 'long', strength: Strength): string {
  let result = text;
  
  // 딱딱한 명령형/요청 표현을 부드러운 완화 표현으로 변경
  // 단, 이미 부드러운 표현이 있으면 변경하지 않음
  const softReplacements: Array<[RegExp, string]> = [
    // 직접적 명령형 → 완화 표현 (이미 완화 표현이 없을 때만)
    [/해 주세요(?!.*수 있을까요)/g, '해 주실 수 있을까요'],
    [/해주세요(?!.*수 있을까요)/g, '해 주실 수 있을까요'],
    [/요청해요(?!.*수 있을까요)/g, '요청해 주실 수 있을까요'],
    [/요청드립니다(?!.*수 있을까요)/g, '요청해 주실 수 있을까요'],
    [/부탁해요(?!.*될까요)/g, '부탁드려도 될까요'],
    [/부탁드립니다(?!.*될까요)/g, '부탁드려도 될까요'],
    [/해 주시기 바랍니다(?!.*수 있을까요)/g, '해 주실 수 있을까요'],
    [/해주시기 바랍니다(?!.*수 있을까요)/g, '해 주실 수 있을까요'],
  ];
  
  // "짧게" 카드에서는 더욱 부드럽게
  if (variantType === 'short') {
    // 완화 표현 추가 (요청 맥락이 있을 때만)
    const hasRequestContext = result.includes('부탁') || result.includes('요청') || 
                              result.includes('해 주') || result.includes('해주') ||
                              result.includes('주세요') || result.includes('주시');
    
    if (hasRequestContext && !result.includes('괜찮으시면') && !result.includes('가능하시면') && !result.includes('편하실 때')) {
      // 문장 앞부분에 완화 표현 추가
      if (!result.startsWith('괜찮으시면') && !result.startsWith('가능하시면') && !result.startsWith('편하실 때')) {
        result = `괜찮으시면 ${result}`;
      }
    }
  }
  
  // 모든 카드에 공통 적용 (이미 부드러운 표현이 있으면 스킵)
  for (const [pattern, replacement] of softReplacements) {
    if (!result.includes('수 있을까요') && !result.includes('될까요')) {
      result = result.replace(pattern, replacement);
    }
  }
  
  // 강도가 낮을 때 (부드러움) 추가 완화 표현
  if (strength.softToFirm < 50) {
    // 이미 완화 표현이 있으면 추가하지 않음
    if (!result.includes('편하실 때') && !result.includes('괜찮으시면')) {
      result = result
        .replace(/해 주실 수 있을까요/g, '편하실 때 해 주실 수 있을까요')
        .replace(/부탁드려도 될까요/g, '괜찮으시면 부탁드려도 될까요');
    }
  }
  
  return result;
}

/**
 * 언어 정책 강제 후처리 (한국어 모드에서 영어 섞임 방지)
 */
function applyLanguagePolicy(text: string, language: string, englishHelperMode: EnglishHelperMode): string {
  // 한국어 모드가 아니면 그대로 반환
  if (language !== 'ko') {
    return text;
  }
  
  // 영어 도우미 모드가 OFF면 영어 완전 제거
  if (englishHelperMode === EnglishHelperMode.OFF) {
    // 한국어 문장 안에 섞인 영어 단어 제거
    // 영어 단어 패턴 (단, 고유명사나 약어는 보존)
    let result = text;
    
    // 영어 문장 전체 제거 (한국어와 섞인 경우)
    result = result.replace(/\b[A-Za-z]+(?:\s+[A-Za-z]+)*\b/g, (match) => {
      // 고유명사나 약어는 보존 (예: API, URL, PDF 등)
      const preserved = ['API', 'URL', 'PDF', 'PPT', 'PDF', 'HTML', 'CSS', 'JS', 'AI', 'IT'];
      if (preserved.includes(match.toUpperCase())) {
        return match;
      }
      // 한국어 문장 중간에 있는 영어는 제거
      return '';
    }).replace(/\s+/g, ' ').trim();
    
    // 영어 질문 패턴 제거 (예: "What are you doing these days?")
    result = result.replace(/[A-Z][a-z]+(?:\s+[a-z]+)*\?/g, '');
    
    return result;
  }
  
  // PAREN 모드: 한국어 문장 뒤에 괄호로 영어 추가
  if (englishHelperMode === EnglishHelperMode.PAREN) {
    // 현재는 한국어만 반환 (영어 번역은 별도 로직 필요)
    return text;
  }
  
  // TWOLINES 모드: 한국어 1줄 + 영어 1줄 병기
  if (englishHelperMode === EnglishHelperMode.TWOLINES) {
    // 현재는 한국어만 반환 (영어 번역은 별도 로직 필요)
    return text;
  }
  
  return text;
}

/**
 * 형식 옵션 적용 (문자/카톡 vs 이메일/공문)
 */
function applyFormatOption(text: string, format: FormatOption): string {
  if (format === FormatOption.MESSAGE) {
    // 문자/카톡용: 간결하고 친근하게
    return text
      .replace(/부탁드립니다/g, '부탁해요')
      .replace(/요청드립니다/g, '요청해요')
      .replace(/안내드립니다/g, '알려드려요')
      .replace(/감사드립니다/g, '감사해요')
      .replace(/하시기 바랍니다/g, '해주세요');
  } else {
    // 이메일/공문용: 격식 있고 정중하게
    return text
      .replace(/부탁해요/g, '부탁드립니다')
      .replace(/요청해요/g, '요청드립니다')
      .replace(/알려드려요/g, '안내드립니다')
      .replace(/감사해요/g, '감사드립니다')
      .replace(/해주세요/g, '해주시기 바랍니다');
  }
}

/**
 * 목적/형식 템플릿 적용 (원문이 비어있으면 템플릿 접두어/접미어를 붙이지 않음)
 */
function applyPurposeTemplate(text: string, purposeId: string, autoIncludeDetails?: boolean): string {
  // 원문이 비어있거나 의미가 없으면 템플릿을 적용하지 않음
  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length === 0 || trimmedText === '?' || trimmedText === '.') {
    return text; // 원문 그대로 반환 (템플릿 접두어/접미어 없음)
  }
  
  // 이미 해당 형식이 포함되어 있으면 스킵
  if (text.includes('[공지]') || text.includes('공지')) return text;
  
  const templates: Record<string, (text: string) => string> = {
    request: (t) => {
      if (t.includes('부탁') || t.includes('요청')) return t;
      if (t.endsWith('주세요') || t.endsWith('주시기 바랍니다')) return t;
      // 원문이 비어있지 않으면 부탁 표현 추가
      if (t.trim().length > 0) {
        return `${t} 부탁드립니다.`;
      }
      return t;
    },
    'notice-guide': (t) => {
      if (t.includes('[공지]')) return t;
      // 원문이 비어있지 않으면 공지 접두어 추가
      if (t.trim().length > 0) {
        return `[공지] ${t}`;
      }
      return t;
    },
    apology: (t) => {
      if (t.includes('죄송') || t.includes('사과')) return t;
      // 원문이 비어있지 않으면 사과 표현 추가
      if (t.trim().length > 0) {
        return `죄송합니다. ${t}`;
      }
      return t;
    },
    'review-thanks': (t) => {
      if (t.includes('후기') || t.includes('감사')) return t;
      // 원문이 비어있지 않으면 후기 표현 추가
      if (t.trim().length > 0) {
        return `${t}에 대한 후기입니다.`;
      }
      return t;
    },
    'complaint-correction': (t) => {
      if (t.includes('항의') || t.includes('불만')) return t;
      // 원문이 비어있지 않으면 항의 표현 추가
      if (t.trim().length > 0) {
        return `${t}에 대해 항의드립니다.`;
      }
      return t;
    }
  };
  
  return templates[purposeId]?.(text) || text;
}

/**
 * 관계 적용 (라벨 접두어 금지, 자연스럽게 문장 안에 포함)
 */
function applyRelationship(text: string, relationshipId: string): string {
  // 라벨 접두어 제거 (상사님:, 선생님: 등)
  text = text.replace(/^(상사님|선생님|학부모님|고객님|거래처 담당자분께?)[:,\s]*/g, '');
  
  const relationships: Record<string, (text: string) => string> = {
    friend: (t) => {
      // 친구: 대화체로 자연스럽게
      return t.replace(/부탁드립니다/g, '부탁해').replace(/요청드립니다/g, '부탁해');
    },
    teacher: (t) => {
      // 선생님: 문장 안에 자연스럽게 포함
      if (!t.includes('선생님')) {
        // 문장 중간이나 끝에 자연스럽게
        if (t.includes('부탁')) {
          return t.replace(/부탁/g, '선생님께 부탁');
        }
        return t;
      }
      return t;
    },
    parent: (t) => {
      // 학부모님: 문장 안에 자연스럽게
      if (!t.includes('학부모님')) {
        if (t.includes('안내')) {
          return t.replace(/안내/g, '학부모님께 안내');
        }
        return t;
      }
      return t;
    },
    boss: (t) => {
      // 상사님: 문장 안에 자연스럽게 (라벨 접두어 금지)
      if (!t.includes('상사님') && !t.includes('상사')) {
        if (t.includes('요청') || t.includes('보고')) {
          return t.replace(/(요청|보고)/g, '상사님께 $1');
        }
        return t;
      }
      return t;
    },
    customer: (t) => {
      // 고객님: 문장 안에 자연스럽게
      if (!t.includes('고객님')) {
        if (t.includes('안내')) {
          return t.replace(/안내/g, '고객님께 안내');
        }
        return t;
      }
      return t;
    },
    client: (t) => {
      // 거래처: 문장 안에 자연스럽게
      if (!t.includes('거래처')) {
        return t;
      }
      return t;
    }
  };
  
  return relationships[relationshipId]?.(text) || text;
}

/**
 * 톤 적용 (톤별로 명확히 다른 결과 생성)
 */
function applyTone(text: string, toneId: string, strength: Strength, variantType: 'short' | 'standard' | 'long'): string {
  let result = text;
  
  // 톤별 기본 변환 (톤마다 명확히 다른 어휘/구조 사용)
  switch (toneId) {
    case 'cultured':
      // 교양 있게: 정중한 표현, 격식 있는 문장 구조
      result = result
        .replace(/해줘/g, '해주시기 바랍니다')
        .replace(/해줄래/g, '해주실 수 있을까요')
        .replace(/해/g, '하시기 바랍니다')
        .replace(/부탁해요/g, '부탁드립니다')
        .replace(/요청해요/g, '요청드립니다');
      // 부탁/요청 맥락이 있을 때만 정중한 접두어 추가
      const hasRequestContextCultured = result.includes('부탁') || result.includes('요청') || 
                                        result.includes('안내') || result.includes('도움') ||
                                        result.includes('도와') || result.includes('해주') ||
                                        result.includes('주세요') || result.includes('주시');
      if (hasRequestContextCultured && !result.includes('정중히') && !result.includes('감사')) {
        result = `정중히 ${result}`;
      }
      if (strength.softToFirm > 70) {
        result = result.replace(/가능하시면/g, '반드시').replace(/부탁/g, '요청');
      }
      break;
    
    case 'friendly':
      // 친근하게: 편한 대화체, 구어체 표현
      result = result
        .replace(/습니다/g, '어요')
        .replace(/입니다/g, '이에요')
        .replace(/하시기 바랍니다/g, '해주세요')
        .replace(/부탁드립니다/g, '부탁해요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/안내드립니다/g, '알려드려요')
        .replace(/감사드립니다/g, '감사해요');
      if (strength.softToFirm < 30) {
        result = result.replace(/해요/g, '해요~');
      }
      break;
    
    case 'firm':
      // 단호하게: 정중하지만 분명, 직접적
      result = result
        .replace(/부탁드립니다/g, '요청드립니다')
        .replace(/가능하시면/g, '')
        .replace(/해주시기 바랍니다/g, '해주셔야 합니다')
        .replace(/부탁해요/g, '요청해요');
      if (strength.softToFirm > 70) {
        result = result.replace(/요청/g, '요구').replace(/제안/g, '요구');
      }
      if (!result.includes('반드시') && strength.softToFirm > 60) {
        result = result.replace(/해주세요/g, '반드시 해주세요');
      }
      break;
    
    case 'humorous':
      // 유머 있게: 가볍게, 과하지 않게
      result = result
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청드려요')
        .replace(/안내드립니다/g, '알려드려요');
      break;
    
    case 'apology':
      // 사과: 낮은 톤, 느린 리듬의 문장 구조
      if (!result.includes('죄송') && !result.includes('사과')) {
        result = `진심으로 사과드리며, ${result}`;
      }
      result = result
        .replace(/부탁드립니다/g, '양해 부탁드립니다')
        .replace(/요청드립니다/g, '양해 부탁드립니다');
      break;
    
    case 'warm':
      // 따뜻하게 (배려) - 원문에 부탁/요청/안내 등의 맥락이 있을 때만 감사 표현 추가
      const hasRequestContext = result.includes('부탁') || result.includes('요청') || 
                                result.includes('안내') || result.includes('도움') ||
                                result.includes('도와') || result.includes('해주') ||
                                result.includes('주세요') || result.includes('주시');
      if (hasRequestContext && !result.includes('감사') && !result.includes('고맙')) {
        result = `감사드리며, ${result}`;
      }
      result = result
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '부탁드려요');
      break;
    
    case 'notice-formal':
      // 공지/안내 (공식 포맷)
      if (!result.includes('[공지]') && !result.includes('공지')) {
        result = `[공지] ${result}`;
      }
      result = result
        .replace(/부탁드립니다/g, '부탁드리겠습니다')
        .replace(/요청드립니다/g, '요청드리겠습니다')
        .replace(/안내드립니다/g, '안내드리겠습니다');
      break;
    
    case 'warning':
      // 경고/시정요구 (기한 명시)
      if (!result.includes('경고') && !result.includes('시정')) {
        result = `경고드립니다. ${result}`;
      }
      if (strength.softToFirm > 75) {
        if (!result.includes('기한') && !result.includes('시정')) {
          result = `${result} 기한 내 시정이 이루어지지 않을 경우 다음 조치를 취하겠습니다.`;
        }
      }
      break;
    
    case 'protest':
      // 단호한 항의문
      if (!result.includes('항의')) {
        result = `단호히 항의드립니다. ${result}`;
      }
      if (strength.softToFirm > 85) {
        result = result.replace(/요청/g, '요구').replace(/부탁/g, '요구');
      }
      break;
  }
  
  // 강도 슬라이더 반영 (부드러움 ↔ 단호함)
  if (strength.softToFirm > 70) {
    result = result
      .replace(/가능하시면/g, '')
      .replace(/부탁드립니다/g, '요청드립니다')
      .replace(/부탁해요/g, '요청해요')
      .replace(/제안/g, '요구');
  }
  
  // 부드러움 증가
  if (strength.softToFirm < 30) {
    result = result
      .replace(/요청/g, '부탁')
      .replace(/요구/g, '제안');
    // 원문에 부탁/요청/안내 등의 맥락이 있을 때만 감사 표현 추가
    const hasRequestContext = result.includes('부탁') || result.includes('요청') || 
                              result.includes('안내') || result.includes('도움') ||
                              result.includes('도와') || result.includes('해주') ||
                              result.includes('주세요') || result.includes('주시');
    if (hasRequestContext && !result.includes('감사') && !result.includes('고맙')) {
      result = `감사드리며, ${result}`;
    }
  }
  
  return result;
}

/**
 * 독자 레벨 적용
 */
function applyAudienceLevel(text: string, audienceId: string): string {
  switch (audienceId) {
    case 'elementary1':
      // 초1: 짧고 쉬운 단어, 문장 길이 짧게
      return text
        .replace(/부탁드립니다/g, '부탁해')
        .replace(/요청드립니다/g, '부탁해')
        .replace(/안내드립니다/g, '알려줄게')
        .replace(/제안드립니다/g, '제안해')
        .replace(/법적 절차/g, '다음 조치')
        .replace(/시정을 요구/g, '바로 해줘')
        .replace(/기한 내/g, '시간 내에');
    
    case 'elementary':
      // 초등 고학년: 조금 더 정중하지만 여전히 쉬운 표현
      return text
        .replace(/부탁드립니다/g, '부탁해요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/법적 절차/g, '다음 조치')
        .replace(/시정을 요구/g, '바로 해주세요');
    
    case 'middle':
      // 중학생: 대화체 유지
      return text
        .replace(/부탁드립니다/g, '부탁해요')
        .replace(/요청드립니다/g, '요청해요');
    
    case 'high':
      // 고등학생: 성인과 유사하지만 약간 덜 격식
      return text
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청드려요');
    
    case 'senior':
      // 시니어: 가독성 강화, 줄바꿈 고려, 지나친 유행어 금지
      return text
        .replace(/\s+/g, ' ')
        .replace(/ㅋㅋ|ㅎㅎ|ㅠㅠ/g, '')
        .trim();
    
    default:
      // 성인: 기본 유지
      return text;
  }
}

/**
 * 길이별 강제 규칙 적용 (문자 내용만 기준으로 처리)
 */
function applyLengthRule(
  text: string,
  variantType: 'short' | 'standard' | 'long',
  resultOptions?: any
): string {
  // 문장 부호를 기준으로 나누지 않고, 문자 내용만 기준으로 처리
  // 공백이나 줄바꿈을 기준으로 단어/구절 단위로 분리
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  
  switch (variantType) {
    case 'short':
      // 짧게: 앞부분만 (문자 수 기준)
      if (text.length > 80) {
        // 단어 단위로 자르기 (문장 부호 무시)
        let short = '';
        for (const word of words) {
          if ((short + ' ' + word).length > 80) break;
          short += (short ? ' ' : '') + word;
        }
        return short || text.substring(0, 77);
      }
      return text;
    
    case 'long':
      // 자세히: 원문 유지 + 추가 내용
      let long = text;
      
      // 자세한 내용 추가
      if (resultOptions?.autoIncludeDetails) {
        if (!long.includes('상세') && !long.includes('추후')) {
          long += ' 상세한 내용은 추후 안내드리겠습니다.';
        }
        if (!long.includes('문의') && !long.includes('연락')) {
          long += ' 추가 문의사항이 있으시면 연락 주시기 바랍니다.';
        }
      }
      
      // 내용이 짧으면 추가 설명
      if (words.length < 20) {
        long += ' 관련 사항에 대해 추가로 안내드리겠습니다.';
      }
      
      return long;
    
    default:
      // 표준: 원문 그대로
      return text;
  }
}
