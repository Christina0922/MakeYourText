import { RewriteRequest, RewriteResult, RewriteVariant, Strength, LengthOption, FormatOption } from '../types/index.js';
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
      request.resultOptions
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
  resultOptions: any
): string {
  let result = text;
  
  // 1. 목적/형식 템플릿 적용
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
  
  // 6. 길이별 강제 규칙 적용 (마지막에 적용하여 문장 수 제어)
  result = applyLengthRule(result, variantType, resultOptions);
  
  return result;
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
 * 목적/형식 템플릿 적용
 */
function applyPurposeTemplate(text: string, purposeId: string, autoIncludeDetails?: boolean): string {
  // 이미 해당 형식이 포함되어 있으면 스킵
  if (text.includes('[공지]') || text.includes('공지')) return text;
  
  const templates: Record<string, (text: string) => string> = {
    request: (t) => {
      if (t.includes('부탁') || t.includes('요청')) return t;
      if (t.endsWith('주세요') || t.endsWith('주시기 바랍니다')) return t;
      return `${t} 부탁드립니다.`;
    },
    notice: (t) => {
      if (t.includes('[공지]')) return t;
      return `[공지] ${t}`;
    },
    apology: (t) => {
      if (t.includes('죄송') || t.includes('사과')) return t;
      return `죄송합니다. ${t}`;
    },
    review: (t) => {
      if (t.includes('후기') || t.includes('감사')) return t;
      return `${t}에 대한 후기입니다.`;
    },
    complaint: (t) => {
      if (t.includes('항의') || t.includes('불만')) return t;
      return `${t}에 대해 항의드립니다.`;
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

