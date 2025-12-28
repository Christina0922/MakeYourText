import { RewriteRequest, RewriteResult, RewriteVariant, Strength } from '../types/index.js';
import { TONE_PRESETS, AUDIENCE_LEVELS, PURPOSE_TYPES, RELATIONSHIPS } from '../data/presets.js';
import { getPlanLimits } from './planLimits.js';
import { validateTextSafety } from './safety.js';

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
  const variantTypes: Array<'short' | 'standard' | 'long'> = 
    limits.maxVariants >= 3 
      ? ['short', 'standard', 'long']
      : ['standard', 'short'];
  
  const relationship = request.relationshipId 
    ? RELATIONSHIPS.find(r => r.id === request.relationshipId)
    : null;
  
  for (const type of variantTypes) {
    const rewritten = applyRewriteRules(
      request.text,
      tonePreset,
      audience,
      purpose,
      relationship,
      request.strength,
      request.resultOptions,
      type
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
  resultOptions: any,
  variantType: 'short' | 'standard' | 'long'
): string {
  let result = text;
  
  // 목적/형식 템플릿 적용
  result = applyPurposeTemplate(result, purpose.id);
  
  // 관계 적용
  if (relationship) {
    result = applyRelationship(result, relationship.id);
  }
  
  // 톤 적용
  result = applyTone(result, tonePreset.id, strength);
  
  // 독자 레벨 적용
  result = applyAudienceLevel(result, audience.id);
  
  // 변형 타입 적용
  result = applyVariantType(result, variantType, resultOptions);
  
  return result;
}

/**
 * 목적/형식 템플릿 적용
 */
function applyPurposeTemplate(text: string, purposeId: string): string {
  // 이미 해당 형식이 포함되어 있으면 스킵
  if (text.includes('[공지]') || text.includes('공지')) return text;
  
  const templates: Record<string, (text: string) => string> = {
    notice: (t) => {
      if (t.endsWith('.')) return `[공지] ${t}`;
      return `[공지] ${t}`;
    },
    request: (t) => {
      if (t.includes('부탁') || t.includes('요청')) return t;
      if (t.endsWith('주세요') || t.endsWith('주시기 바랍니다')) return t;
      return `${t} 부탁드립니다.`;
    },
    apology: (t) => {
      if (t.includes('죄송') || t.includes('사과')) return t;
      return `죄송합니다. ${t}`;
    },
    guide: (t) => {
      if (t.includes('안내')) return t;
      return `안내드립니다. ${t}`;
    },
    review: (t) => {
      if (t.includes('후기')) return t;
      return `${t}에 대한 후기입니다.`;
    },
    complaint: (t) => {
      if (t.includes('항의') || t.includes('불만')) return t;
      return `${t}에 대해 항의드립니다.`;
    },
    proposal: (t) => {
      if (t.includes('제안')) return t;
      return `${t}를 제안드립니다.`;
    },
    report: (t) => {
      if (t.includes('보고')) return t;
      return `${t}에 대해 보고드립니다.`;
    },
    'parent-notice': (t) => {
      // 학부모 공지 (결석/보강/숙제/상담/방학특강)
      if (!t.includes('[공지]') && !t.includes('공지')) {
        return `[학부모 공지] ${t}`;
      }
      return t;
    },
    'company-email': (t) => {
      // 회사 메일 (요청/확인/리마인드/사과/감사)
      if (!t.includes('안내') && !t.includes('요청')) {
        return `안내드립니다. ${t}`;
      }
      return t;
    },
    'student-assignment': (t) => {
      // 학생 과제 (요약/소감/발표 대본)
      return t;
    },
    'customer-service': (t) => {
      // 고객 응대 (문의 답변/환불/지연 안내)
      if (!t.includes('고객님')) {
        return `고객님, ${t}`;
      }
      return t;
    }
  };
  
  return templates[purposeId]?.(text) || text;
}

/**
 * 톤 적용
 */
function applyTone(text: string, toneId: string, strength: Strength): string {
  let result = text;
  
  // 톤별 기본 변환
  switch (toneId) {
    case 'cultured':
      // 교양 있게: 정중한 표현, 격식 있는 문장 구조
      result = result
        .replace(/해줘/g, '해주시기 바랍니다')
        .replace(/해줄래/g, '해주실 수 있을까요')
        .replace(/해/g, '하시기 바랍니다');
      if (!result.includes('부탁') && !result.includes('요청')) {
        result = `정중히 ${result}`;
      }
      if (strength.calmToStrong > 50) {
        result = result.replace(/가능하시면/g, '반드시');
      }
      break;
    
    case 'friendly':
      // 친근하게: 편한 대화체
      result = result
        .replace(/습니다/g, '어요')
        .replace(/입니다/g, '이에요')
        .replace(/하시기 바랍니다/g, '해주세요')
        .replace(/부탁드립니다/g, '부탁해요')
        .replace(/요청드립니다/g, '요청해요');
      break;
    
    case 'firm':
      // 단호하게: 정중하지만 분명
      result = result
        .replace(/부탁드립니다/g, '요청드립니다')
        .replace(/가능하시면/g, '')
        .replace(/해주시기 바랍니다/g, '해주셔야 합니다');
      if (strength.softToFirm > 70) {
        result = result.replace(/요청/g, '요구');
      }
      break;
    
    case 'humorous':
      // 유머 있게: 가볍게, 과하지 않게
      result = result.replace(/부탁드립니다/g, '부탁드려요~');
      break;
    
    case 'apology':
      // 사과: 낮은 톤, 느린 리듬의 문장 구조
      if (!result.includes('죄송') && !result.includes('사과')) {
        result = `진심으로 사과드리며, ${result}`;
      }
      result = result.replace(/부탁드립니다/g, '양해 부탁드립니다');
      break;
    
    case 'warm':
      // 따뜻하게 (배려)
      if (!result.includes('감사') && !result.includes('고맙')) {
        result = `감사드리며, ${result}`;
      }
      result = result.replace(/부탁드립니다/g, '부탁드려요');
      break;
    
    case 'casual':
      // 캐주얼 (친근)
      result = result
        .replace(/부탁드립니다/g, '부탁해요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/안내드립니다/g, '알려드려요');
      break;
    
    case 'formal':
      // 포멀 (공식)
      result = result
        .replace(/부탁드립니다/g, '부탁드리겠습니다')
        .replace(/요청드립니다/g, '요청드리겠습니다');
      if (!result.includes('안내')) {
        result = `안내드립니다. ${result}`;
      }
      break;
    
    case 'strong':
      // 강경(시정요구/기한 명시)
      if (strength.calmToStrong > 80) {
        if (!result.includes('기한')) {
          result = `${result} 기한 내 미이행 시 법적 절차를 검토하겠습니다.`;
        }
      } else {
        result = `시정을 요구드립니다. ${result}`;
      }
      break;
    
    case 'warning':
      // 경고/시정요구
      result = `경고드립니다. ${result}`;
      if (strength.calmToStrong > 75) {
        result = `${result} 시정이 이루어지지 않을 경우 다음 조치를 취하겠습니다.`;
      }
      break;
    
    case 'protest':
      // 단호한 항의문
      result = `단호히 항의드립니다. ${result}`;
      if (strength.softToFirm > 85) {
        result = result.replace(/요청/g, '요구').replace(/부탁/g, '요구');
      }
      break;
    
    case 'ultimatum':
      // 최후통첩 톤
      result = `최종 통보드립니다. ${result}`;
      if (strength.calmToStrong > 90) {
        result = `${result} 기한 내 응답이 없을 경우 법적 절차를 진행하겠습니다.`;
      }
      break;
  }
  
  // 강도 슬라이더 반영
  if (strength.calmToStrong > 70) {
    result = result
      .replace(/부탁/g, '요청')
      .replace(/제안/g, '요구')
      .replace(/가능하시면/g, '');
  }
  
  if (strength.softToFirm > 70) {
    result = result
      .replace(/가능하시면/g, '')
      .replace(/부탁드립니다/g, '요청드립니다')
      .replace(/부탁해요/g, '요청해요');
  }
  
  // 부드러움 증가
  if (strength.softToFirm < 30) {
    result = result
      .replace(/요청/g, '부탁')
      .replace(/요구/g, '제안');
    if (!result.includes('감사') && !result.includes('고맙')) {
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
        .replace(/기한 내/g, '시간 내에')
        // 긴 문장을 짧게
        .split(/[.,。]/)
        .filter(s => s.trim().length > 0)
        .slice(0, 2)
        .join('. ') + '.';
    
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
        .replace(/~요/g, '요')
        .replace(/ㅋㅋ|ㅎㅎ|ㅠㅠ/g, '')
        .trim();
    
    default:
      // 성인: 기본 유지
      return text;
  }
}

/**
 * 변형 타입 적용
 */
function applyVariantType(text: string, type: 'short' | 'standard' | 'long', resultOptions?: any): string {
  let result = text;
  
  // 결과 옵션: bullet / paragraph 형식
  if (resultOptions?.format === 'bullet') {
    // 핵심 bullet 형식으로 변환
    const sentences = result.split(/[.,。]/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      result = sentences.map(s => `• ${s.trim()}`).join('\n');
    } else {
      result = `• ${result.trim()}`;
    }
  }
  
  switch (type) {
    case 'short':
      // 짧게: 핵심만, 불필요한 수식어 제거
      let short = result
        .replace(/정중히 |명확히 |진심으로 |가볍게 /g, '')
        .replace(/\[공지\] /g, '')
        .split(/[.,。]/)[0] || result;
      // 너무 길면 앞부분만
      if (short.length > 50) {
        short = short.substring(0, 47) + '...';
      }
      return short;
    
    case 'long':
      // 자세히: 배경/근거 추가, 문맥 설명
      let long = result;
      if (!long.includes('상세') && !long.includes('추후')) {
        long = `${long} 상세한 내용은 추후 안내드리겠습니다.`;
      }
      if (!long.includes('문의') && !long.includes('연락')) {
        long = `${long} 추가 문의사항이 있으시면 연락 주시기 바랍니다.`;
      }
      return long;
    
    default:
      // 표준: 그대로
      return result;
  }
}

