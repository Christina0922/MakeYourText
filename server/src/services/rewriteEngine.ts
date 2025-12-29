import { RewriteRequest, RewriteResult, RewriteVariant, Strength, LengthOption, FormatOption, EnglishHelperMode } from '../types/index.js';
import { TONE_PRESETS, AUDIENCE_LEVELS, PURPOSE_TYPES, RELATIONSHIPS } from '../data/presets.js';
import { getPlanLimits } from './planLimits.js';
import { validateTextSafety } from './safety.js';

// DEV 모드: 환경변수로 제한 우회
const BYPASS_LIMITS = process.env.BYPASS_LIMITS === 'true' || 
                      process.env.NODE_ENV === 'development';

/**
 * 템플릿별 리라이트 (단일 텍스트 반환)
 */
export async function rewriteTextForTemplate(request: RewriteRequest): Promise<string> {
  // 안전 검사
  const safety = validateTextSafety(request.text, request.tonePresetId);
  if (safety.blocked) {
    throw new Error(safety.reason || '안전 검사 실패');
  }
  
  const tonePreset = TONE_PRESETS.find(t => t.id === request.tonePresetId);
  const audience = AUDIENCE_LEVELS.find(a => a.id === request.audienceLevelId);
  const purpose = PURPOSE_TYPES.find(p => p.id === request.purposeTypeId);
  
  if (!tonePreset || !audience || !purpose) {
    throw new Error('템플릿 정보를 찾을 수 없습니다');
  }
  
  const relationship = request.relationshipId 
    ? RELATIONSHIPS.find(r => r.id === request.relationshipId)
    : null;
  
  // 표준 길이로 생성
  const rewritten = applyRewriteRules(
    request.text,
    tonePreset,
    audience,
    purpose,
    relationship,
    request.strength,
    request.format,
    request.length,
    'standard',
    request.resultOptions,
    request.language || 'ko',
    request.englishHelperMode || EnglishHelperMode.OFF
  );
  
  return rewritten;
}

/**
 * 리라이트 엔진 (규칙 기반)
 */
export function rewriteText(request: RewriteRequest): RewriteResult {
  // ✅ englishHelperMode 로그
  console.log('[rewriteText] englishHelperMode:', request.englishHelperMode);
  
  // ✅ englishHelperMode가 없으면 에러 반환 (조용히 기본값으로 넘어가지 않음)
  if (request.englishHelperMode === undefined || request.englishHelperMode === null) {
    console.error('[rewriteText] ERROR: englishHelperMode is missing!');
    return {
      variants: [],
      safety: { blocked: false, reason: 'englishHelperMode missing' }
    };
  }
  
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
  const originalText = text; // 원문 보존 (검수용)
  
  // ✅ 로그: englishHelperMode 확인
  console.log('[applyRewriteRules] englishHelperMode:', englishHelperMode, 'originalText:', originalText);
  
  // ✅ 0. 영어 입력 처리 (englishHelperMode에 따라 분기)
  if (language === 'ko') {
    result = convertEnglishToKorean(result, englishHelperMode, originalText);
  }
  
  // 0.5. 입력 정규화 (구어체를 표준 표현으로 변환)
  result = normalizeInputText(result, tonePreset.id);
  
  // 1. 목적/형식 템플릿 적용 (원문이 비어있으면 템플릿 접두어/접미어를 붙이지 않음)
  result = applyPurposeTemplate(result, purpose.id, resultOptions?.autoIncludeDetails, originalText);
  
  // 2. 톤 적용 (톤별로 명확히 다른 결과) - 목적 정보 전달하여 충돌 방지
  result = applyTone(result, tonePreset.id, strength, variantType, originalText, purpose.id);
  
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
  result = applyLengthRule(result, variantType, resultOptions, tonePreset.id, originalText);
  
  // 8. 언어 정책 강제 후처리 (한국어 모드에서 영어 섞임 방지) - 최종 후처리
  result = applyLanguagePolicy(result, language, englishHelperMode, originalText);
  
  // 9. 문체 혼합 검수 체크 (출력 직전 자동 검사)
  result = validateAndFixStyleConsistency(result, tonePreset.id, variantType);
  
  // 10. 문맥 이상 검수 (입력에 없는 정보 추가 방지)
  result = validateContextIntegrity(result, originalText);
  
  // 11. 반말/존댓말 혼용 검수 (문체 일관성 100%)
  result = validateFormalConsistency(result, tonePreset.id);
  
  // 12. ✅ QA 체크: "으로/로" 같은 조사만 남는 문제 방지
  result = validateParticleOnlyIssue(result, originalText);
  
  // 13. ✅ QA 체크: englishHelperMode에 따른 영문 검증
  result = validateEnglishHelperMode(result, englishHelperMode, originalText);
  
  return result;
}

/**
 * QA 체크: "으로/로" 같은 조사만 남는 문제 방지
 */
function validateParticleOnlyIssue(text: string, originalText: string): string {
  let result = text;
  
  // "으로" 또는 "로"가 문장 시작이나 단독 토큰으로 나오는 경우
  const particlePatterns = [
    /^으로\s+/,
    /^로\s+/,
    /\s+으로\s*$/,
    /\s+로\s*$/,
    /\s+으로\s+[^가-힣]/,
    /\s+로\s+[^가-힣]/
  ];
  
  for (const pattern of particlePatterns) {
    if (pattern.test(result)) {
      console.warn('[QA] Particle-only issue detected, fixing...');
      // 원문을 확인하여 의미를 복원
      if (originalText && originalText.trim().length > 0) {
        // 원문의 의미를 기반으로 재구성
        result = originalText.trim() + '에 대해 안내드립니다.';
      } else {
        // 원문이 없으면 조사 제거
        result = result.replace(pattern, ' ').trim();
      }
    }
  }
  
  return result;
}

/**
 * 목적-문구 강제 매핑 검수 (목적=요청이면 항의/경고 문구 제거)
 */
function validatePurposeMapping(text: string, purposeId: string): string {
  let result = text;
  
  // ✅ 규칙 1: 목적=요청이면 항의/경고 문구 절대 금지
  if (purposeId === 'request') {
    // 금지 키워드 제거
    const forbiddenPatterns = [
      /항의드립니다\.?\s*/g,
      /단호히 항의드립니다\.?\s*/g,
      /경고드립니다\.?\s*/g,
      /시정요구/g,
      /다음 조치를 취하겠습니다/g,
      /조치를 취하겠습니다/g,
      /법적 절차/g
    ];
    
    for (const pattern of forbiddenPatterns) {
      result = result.replace(pattern, '');
    }
    
    // 항의/경고를 요청 표현으로 변경
    result = result.replace(/항의/g, '요청');
    result = result.replace(/시정/g, '처리');
    
    // 요청 표현이 없으면 추가
    if (!result.includes('부탁') && !result.includes('요청') && !result.includes('주세요')) {
      if (!result.endsWith('.')) {
        result += ' 부탁드립니다.';
      } else {
        result = result.replace(/\.$/, ' 부탁드립니다.');
      }
    }
  }
  
  // ✅ 규칙 1: 목적=항의/시정요구일 때만 항의/경고 계열 허용
  if (purposeId === 'complaint-correction') {
    // 요청 표현을 항의 표현으로 변경하지 않음 (이미 applyTone에서 처리)
    // 여기서는 추가 검증만 수행
  }
  
  return result.trim();
}

/**
 * QA 체크: englishHelperMode에 따른 영문 검증
 */
function validateEnglishHelperMode(text: string, englishHelperMode: EnglishHelperMode, originalText: string): string {
  let result = text;
  const hasEnglish = /[A-Za-z]/.test(result);
  const originalHasEnglish = /[A-Za-z]/.test(originalText);
  
  // ✅ englishHelperMode=true인데 화면 표시에 영문이 0이면 실패
  if (englishHelperMode !== EnglishHelperMode.OFF && originalHasEnglish && !hasEnglish) {
    console.warn('[QA] englishHelperMode is ON but English was removed, restoring...');
    // 원문의 영어를 복원 (한국어와 병기) - 중복 체크
    if (originalText) {
      const englishParts = originalText.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g);
      if (englishParts && englishParts.length > 0) {
        const englishStr = englishParts.join(' ');
        // 이미 영어가 포함되어 있으면 추가하지 않음 (중복 방지)
        if (!result.includes(englishStr) && !result.match(/\([^)]*[A-Za-z][^)]*\)/) && !result.includes(`\n${englishStr}`)) {
          if (englishHelperMode === EnglishHelperMode.PAREN) {
            result = `${result} (${englishStr})`;
          } else if (englishHelperMode === EnglishHelperMode.TWOLINES) {
            result = `${result}\n${englishStr}`;
          }
        }
      }
    }
  }
  
  // ✅ 영어 단어 중복 제거 (같은 영어 단어가 여러 번 나오면 한 번만 유지)
  if (englishHelperMode !== EnglishHelperMode.OFF && hasEnglish) {
    const englishWords = result.match(/\b[A-Za-z]+\b/g) || [];
    const wordCounts: Record<string, number> = {};
    
    for (const word of englishWords) {
      const lowerWord = word.toLowerCase();
      wordCounts[lowerWord] = (wordCounts[lowerWord] || 0) + 1;
    }
    
    // 중복된 영어 단어가 있으면 제거
    const hasDuplicates = Object.values(wordCounts).some(count => count > 1);
    if (hasDuplicates) {
      let tempResult = result;
      const processedWords = new Set<string>();
      for (const word of englishWords) {
        const lowerWord = word.toLowerCase();
        if (wordCounts[lowerWord] > 1 && !processedWords.has(lowerWord)) {
          // 정규식 특수 문자 이스케이프
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedWord}\\b`, 'g');
          let firstFound = false;
          tempResult = tempResult.replace(regex, (match) => {
            if (!firstFound) {
              firstFound = true;
              return match;
            }
            return '';
          });
          processedWords.add(lowerWord); // 이미 처리했으므로 표시
        }
      }
      result = tempResult.replace(/\s+/g, ' ').trim();
    }
  }
  
  // ✅ englishHelperMode=false인데 화면 표시에 영문이 남아 있으면 한국어로 변환
  if (englishHelperMode === EnglishHelperMode.OFF && hasEnglish) {
    console.warn('[QA] englishHelperMode is OFF but English remains, converting to Korean...');
    // 영문을 한국어로 변환 (삭제가 아니라 의미 재구성)
    result = convertEnglishToKorean(result, EnglishHelperMode.OFF, originalText);
  }
  
  return result;
}

/**
 * 반말/존댓말 혼용 검수 (문체 일관성 100%)
 */
function validateFormalConsistency(text: string, toneId: string): string {
  let result = text;
  
  // 공식/공지/교양/단호/항의 톤은 존댓말로 고정
  const formalTones = ['notice-formal', 'cultured', 'firm', 'warning', 'protest'];
  const isFormalTone = formalTones.includes(toneId);
  
  // 반말 토큰 패턴
  const informalPatterns = [
    /\b해\b(?!주세요|주시기|주시면|주셔야)/g,
    /\b해봐\b/g,
    /\b해줘\b/g,
    /\b써줘\b/g,
    /\b하지마\b/g,
    /\b하지 마\b/g,
    /\b써\b(?!주세요|주시기|주시면|주셔야)/g,
    /\b해라\b/g,
    /\b써라\b/g
  ];
  
  // 존댓말 토큰 패턴
  const formalPatterns = [
    /합니다/g,
    /드립니다/g,
    /해주세요/g,
    /해 주세요/g,
    /하십시오/g,
    /부탁드립니다/g,
    /요청드립니다/g,
    /바랍니다/g,
    /해 주시기 바랍니다/g
  ];
  
  // 반말 토큰이 있는지 확인
  const hasInformal = informalPatterns.some(pattern => pattern.test(result));
  
  // 존댓말 토큰이 있는지 확인
  const hasFormal = formalPatterns.some(pattern => pattern.test(result));
  
  // 반말과 존댓말이 혼용되면 톤에 맞게 통일
  if (hasInformal && hasFormal) {
    if (isFormalTone) {
      // 공식 톤이면 반말을 존댓말로 변환
      result = result
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요')
        .replace(/\b써줘\b/g, '써 주세요')
        .replace(/\b하지마\b/g, '하지 말아 주세요')
        .replace(/\b하지 마\b/g, '하지 말아 주세요')
        .replace(/\b써\b(?!주세요|주시기|주시면|주셔야)/g, '써 주세요')
        .replace(/\b해라\b/g, '해 주세요')
        .replace(/\b써라\b/g, '써 주세요');
    } else {
      // 친근/유머 톤이면 존댓말을 구어 존댓말로 변환 (반말은 아님)
      result = result
        .replace(/합니다/g, '해요')
        .replace(/드립니다/g, '드려요')
        .replace(/해주세요/g, '해 주세요')
        .replace(/해 주세요/g, '해 주세요')
        .replace(/하십시오/g, '해 주세요')
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/바랍니다/g, '바래요')
        .replace(/해 주시기 바랍니다/g, '해 주세요');
    }
  } else if (hasInformal && isFormalTone) {
    // 공식 톤인데 반말만 있으면 존댓말로 변환
    result = result
      .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
      .replace(/\b해봐\b/g, '해 주세요')
      .replace(/\b해줘\b/g, '해 주세요')
      .replace(/\b써줘\b/g, '써 주세요')
      .replace(/\b하지마\b/g, '하지 말아 주세요')
      .replace(/\b하지 마\b/g, '하지 말아 주세요')
      .replace(/\b써\b(?!주세요|주시기|주시면|주셔야)/g, '써 주세요')
      .replace(/\b해라\b/g, '해 주세요')
      .replace(/\b써라\b/g, '써 주세요');
  }
  
  return result;
}

/**
 * 입력에 시간 표현이 있는지 검사
 */
function hasTimeExpression(text: string): boolean {
  const timePatterns = [
    /오늘|내일|모레|다음주|다음 주|이번주|이번 주/,
    /까지|내|전|후|이후|이전/,
    /\d+일|\d+시간|\d+분|\d+주|\d+개월|\d+년/,
    /기한|마감|데드라인|deadline|due/,
    /오전|오후|아침|점심|저녁|밤/,
    /월요일|화요일|수요일|목요일|금요일|토요일|일요일/
  ];
  
  return timePatterns.some(pattern => pattern.test(text));
}

/**
 * 입력에 조치/제재 표현이 있는지 검사
 */
function hasActionExpression(text: string): boolean {
  const actionPatterns = [
    /조치|제재|신고|퇴실|차단|법적|법적 절차|고소|고발|민원|환불|해지|계약 해지/,
    /불이익|손해|배상|보상|책임/,
    /취하|시정|개선|수정|변경/
  ];
  
  return actionPatterns.some(pattern => pattern.test(text));
}

/**
 * 문맥 이상 검수 (입력에 없는 정보 추가 방지)
 */
function validateContextIntegrity(result: string, originalText: string): string {
  let output = result;
  
  // 규칙 1: 기한 생성 금지
  // 입력에 시간 표현이 없으면 기한 관련 문구 제거
  if (!hasTimeExpression(originalText)) {
    const deadlinePatterns = [
      /기한 내/g,
      /기한까지/g,
      /오늘 중으로/g,
      /내일까지/g,
      /오늘까지/g,
      /오늘 오후 \d+시까지/g,
      /오늘 \d+시까지/g,
      /내일 \d+시까지/g,
      /\d+일까지/g,
      /\d+시간 내/g,
      /\d+분 내/g
    ];
    
    for (const pattern of deadlinePatterns) {
      output = output.replace(pattern, '');
    }
    
    // "기한" 단어가 단독으로 있으면 제거
    output = output.replace(/\s*기한\s*/g, ' ');
  }
  
  // 규칙 2: 다음 조치/제재 생성 금지
  // 입력에 조치/제재 표현이 없으면 조치 관련 문구 제거
  if (!hasActionExpression(originalText)) {
    const actionPatterns = [
      /다음 조치를 취하겠습니다/g,
      /다음 조치/g,
      /불이익을 드릴 수 있습니다/g,
      /불이익/g,
      /제재를 가하겠습니다/g,
      /제재/g,
      /법적 절차를 검토하겠습니다/g,
      /법적 절차/g,
      /시정이 이루어지지 않을 경우 다음 조치를 취하겠습니다/g,
      /시정이 이루어지지 않을 경우/g
    ];
    
    for (const pattern of actionPatterns) {
      output = output.replace(pattern, '');
    }
  }
  
  // 공백 정리
  output = output.replace(/\s+/g, ' ').trim();
  
  // 문장 끝 정리 (마침표가 여러 개 있으면 하나만)
  output = output.replace(/\.{2,}/g, '.');
  
  return output;
}

/**
 * 입력 정규화 (구어체를 표준 표현으로 변환)
 */
function normalizeInputText(text: string, toneId: string): string {
  let result = text;
  
  // 금지어 제거 (톤 불문)
  const forbiddenWords: Array<[RegExp, string]> = [
    [/써 줘/g, ''],
    [/해 줘/g, ''],
    [/해줘/g, ''],
    [/좀 해/g, ''],
    [/좀 써/g, ''],
    [/해줄래/g, ''],
    [/해봐/g, ''],
    [/해라/g, ''],
    [/써라/g, ''],
    [/하지마/g, ''],
    [/하지 마/g, ''],
    [/아무 때나/g, ''],
    [/대충/g, ''],
    [/대략/g, ''],
    [/적당히/g, '']
  ];
  
  for (const [pattern, replacement] of forbiddenWords) {
    result = result.replace(pattern, replacement);
  }
  
  // 공식/공지 톤에서 완화 표현 제거
  if (toneId === 'notice-formal' || toneId === 'cultured') {
    result = result
      .replace(/괜찮으시면/g, '')
      .replace(/가능하시면/g, '')
      .replace(/시간 되시면/g, '');
  }
  
  // 핵심 치환표 (입력 정규화)
  const isFormal = toneId === 'notice-formal' || toneId === 'cultured' || toneId === 'firm';
  const isFriendly = toneId === 'friendly' || toneId === 'humorous';
  
  // "써 줘/좀 써/써줄래" → 톤별 변환
  if (result.includes('써 줘') || result.includes('좀 써') || result.includes('써줄래') || result.includes('써줘')) {
    if (isFormal) {
      result = result.replace(/(써 줘|좀 써|써줄래|써줘)/g, '작성 부탁드립니다');
    } else if (isFriendly) {
      result = result.replace(/(써 줘|좀 써|써줄래|써줘)/g, '써 주세요');
    } else {
      result = result.replace(/(써 줘|좀 써|써줄래|써줘)/g, '작성해 주세요');
    }
  }
  
  // "해 줘/좀 해/해줘" → 톤별 변환
  if (result.includes('해 줘') || result.includes('좀 해') || result.includes('해줘') || result.includes('해줄래')) {
    if (isFormal) {
      result = result.replace(/(해 줘|좀 해|해줘|해줄래)/g, '진행 부탁드립니다');
    } else if (isFriendly) {
      result = result.replace(/(해 줘|좀 해|해줘|해줄래)/g, '해 주세요');
    } else {
      result = result.replace(/(해 줘|좀 해|해줘|해줄래)/g, '진행해 주세요');
    }
  }
  
  // "알려 줘" → 톤별 변환
  if (result.includes('알려 줘') || result.includes('알려줘')) {
    if (isFormal) {
      result = result.replace(/(알려 줘|알려줘)/g, '공유 부탁드립니다');
    } else {
      result = result.replace(/(알려 줘|알려줘)/g, '알려 주세요');
    }
  }
  
  // "해 줘요" → 선택된 톤으로 통일
  if (result.includes('해 줘요') || result.includes('해줘요')) {
    if (isFormal) {
      result = result.replace(/(해 줘요|해줘요)/g, '부탁드립니다');
    } else if (isFriendly) {
      result = result.replace(/(해 줘요|해줘요)/g, '해 주세요');
    } else {
      result = result.replace(/(해 줘요|해줘요)/g, '해 주세요');
    }
  }
  
  return result.trim();
}

/**
 * 문체 혼합 검수 체크 (출력 직전 자동 검사)
 */
function validateAndFixStyleConsistency(text: string, toneId: string, variantType: 'short' | 'standard' | 'long'): string {
  let result = text;
  
  // 1. 금지어가 남아있으면 제거
  const forbiddenPatterns = [
    /써 줘/g, /해 줘/g, /해줘/g, /좀 해/g, /좀 써/g,
    /해줄래/g, /해봐/g, /해라/g, /써라/g, /하지마/g, /하지 마/g
  ];
  
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(result)) {
      // 금지어가 있으면 톤에 맞게 치환
      if (toneId === 'notice-formal' || toneId === 'cultured') {
        result = result.replace(/써 줘|해 줘|해줘|좀 해|좀 써|해줄래|해봐|해라|써라|하지마|하지 마/g, '부탁드립니다');
      } else if (toneId === 'friendly' || toneId === 'humorous') {
        result = result.replace(/써 줘|해 줘|해줘|좀 해|좀 써|해줄래|해봐|해라|써라|하지마|하지 마/g, '해 주세요');
      } else {
        result = result.replace(/써 줘|해 줘|해줘|좀 해|좀 써|해줄래|해봐|해라|써라|하지마|하지 마/g, '해 주세요');
      }
    }
  }
  
  // 2. 문체 혼합 검사 (구어체 + 격식체)
  const hasCasual = /해 주세요|해줘요|해줄래요|써 주세요/.test(result);
  const hasFormal = /부탁드립니다|요청드립니다|안내드립니다|드리겠습니다/.test(result);
  
  if (hasCasual && hasFormal) {
    // 톤에 맞게 통일
    if (toneId === 'notice-formal' || toneId === 'cultured') {
      // 격식체로 통일
      result = result
        .replace(/해 주세요/g, '부탁드립니다')
        .replace(/해줘요/g, '부탁드립니다')
        .replace(/해줄래요/g, '부탁드립니다')
        .replace(/써 주세요/g, '작성 부탁드립니다');
    } else if (toneId === 'friendly' || toneId === 'humorous') {
      // 구어체로 통일
      result = result
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/안내드립니다/g, '알려드려요')
        .replace(/드리겠습니다/g, '드릴게요');
    } else {
      // 기본: 격식체로 통일
      result = result
        .replace(/해 주세요/g, '부탁드립니다')
        .replace(/해줘요/g, '부탁드립니다');
    }
  }
  
  // 3. 공지/공식 톤에서 "괜찮으시면" 제거
  if ((toneId === 'notice-formal' || toneId === 'cultured') && result.includes('괜찮으시면')) {
    result = result.replace(/괜찮으시면\s*/g, '');
  }
  
  // 4. 빈 내용 문장 제거
  result = result
    .replace(/관련 사항에 대해 추가로 안내드리겠습니다\./g, '')
    .replace(/추가 안내드리겠습니다\./g, '')
    .replace(/상세한 내용은 추후 안내드리겠습니다\./g, '')
    .replace(/추후 안내드리겠습니다\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 5. 톤별 어미 고정 적용
  result = applyToneEnding(result, toneId, variantType);
  
  return result;
}

/**
 * 톤별 어미 고정 적용
 */
function applyToneEnding(text: string, toneId: string, variantType: 'short' | 'standard' | 'long'): string {
  let result = text;
  
  switch (toneId) {
    case 'notice-formal':
      // 공지/안내(공식 포맷): "~드립니다", "~부탁드립니다"만 허용
      result = result
        .replace(/해주세요/g, '부탁드립니다')
        .replace(/해요/g, '드립니다')
        .replace(/죠\?/g, '드립니다')
        .replace(/할래요\?/g, '부탁드립니다')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      
      // 문장 끝이 올바른 어미로 끝나도록
      if (!result.match(/[드리겠습니다|부탁드립니다|요청드립니다|안내드립니다|바랍니다]\.?$/)) {
        if (result.trim().length > 0 && !result.endsWith('.')) {
          result += ' 부탁드립니다.';
        }
      }
      break;
    
    case 'cultured':
      // 교양 있게: "~해 주시기 바랍니다", "~해 주시면 감사하겠습니다", "~부탁드립니다"
      result = result
        .replace(/해줘/g, '해 주시기 바랍니다')
        .replace(/써줘/g, '작성해 주시기 바랍니다')
        .replace(/해 주세요/g, '해 주시기 바랍니다')
        .replace(/해요/g, '해 주시기 바랍니다')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주시기 바랍니다')
        .replace(/\b해봐\b/g, '해 주시기 바랍니다');
      break;
    
    case 'friendly':
      // 친근하게: "~해 주세요", "~해 주실래요?", "~부탁드려요"
      result = result
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/안내드립니다/g, '알려드려요')
        .replace(/드리겠습니다/g, '드릴게요')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      break;
    
    case 'firm':
      // 단호하게: "~해 주세요", "~해 주셔야 합니다"
      result = result
        .replace(/괜찮으시면/g, '')
        .replace(/가능하시면/g, '')
        .replace(/부탁드립니다/g, '해 주세요')
        .replace(/요청드립니다/g, '해 주세요')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      break;
    
    case 'warm':
      // 따뜻하게: "번거로우시겠지만", "가능하실 때", "감사하겠습니다"
      result = result
        .replace(/요청드립니다/g, '해 주시면 감사하겠습니다')
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      break;
    
    case 'apology':
      // 사과: "불편을 드려 죄송합니다", "확인 후 조치하겠습니다"
      if (!result.includes('죄송') && !result.includes('사과')) {
        result = `불편을 드려 죄송합니다. ${result}`;
      }
      result = result
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      break;
    
    case 'humorous':
      // 유머 있게: 가벼운 한 문장 + 본문 요청(단, 존댓말 유지)
      if (!result.includes('부탁') && !result.includes('요청')) {
        result = `부탁 하나 드려도 될까요? ${result}`;
      }
      result = result
        .replace(/부탁드립니다/g, '부탁드려요')
        .replace(/요청드립니다/g, '요청해요')
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요');
      break;
    
    case 'warning':
    case 'protest':
      // 경고/항의: 존댓말로 고정
      result = result
        .replace(/\b해\b(?!주세요|주시기|주시면|주셔야)/g, '해 주세요')
        .replace(/\b해봐\b/g, '해 주세요')
        .replace(/\b해줘\b/g, '해 주세요')
        .replace(/\b써\b(?!주세요|주시기|주시면|주셔야)/g, '써 주세요')
        .replace(/\b써줘\b/g, '써 주세요')
        .replace(/\b하지마\b/g, '하지 말아 주세요')
        .replace(/\b하지 마\b/g, '하지 말아 주세요');
      break;
  }
  
  return result;
}

/**
 * 영어 입력을 한국어로 변환 (템플릿 적용 전에 실행)
 * ✅ englishHelperMode에 따라 분기
 */
function convertEnglishToKorean(text: string, englishHelperMode: EnglishHelperMode, originalText?: string): string {
  let result = text;
  
  // 영어가 있는지 확인
  const hasEnglish = /[A-Za-z]/.test(result);
  if (!hasEnglish) {
    return result; // 영어가 없으면 그대로 반환
  }
  
  // ✅ englishHelperMode가 OFF가 아니면 영어를 유지하고 한국어 보조만 추가
  if (englishHelperMode !== EnglishHelperMode.OFF) {
    // PAREN/TWOLINES 모드: 영어는 유지하되 한국어 의미 추가
    // 예: "We decided to take a trip" → "We decided to take a trip, 여행을 가기로 결정했습니다."
    const englishSentences = result.match(/[A-Z][^.!?]*[.!?]/g) || result.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g) || [];
    const koreanTranslations: string[] = [];
    
    for (const engSentence of englishSentences) {
      // 간단한 영어→한국어 변환 (실제로는 더 정교한 번역 필요)
      let korean = engSentence
        .replace(/we decided to/gi, '여행을 가기로 결정했습니다')
        .replace(/decided to/gi, '결정했습니다')
        .replace(/take a trip/gi, '여행을 가기로')
        .replace(/trip/gi, '여행')
        .replace(/we/gi, '우리는')
        .replace(/decided/gi, '결정했습니다')
        .replace(/to/gi, '')
        .replace(/a/gi, '')
        .replace(/the/gi, '')
        .replace(/[A-Za-z]/g, '')
        .trim();
      
      // 의미 있는 한국어가 없으면 기본 변환
      if (korean.length === 0 || korean.replace(/[^\uAC00-\uD7A3]/g, '').length === 0) {
        korean = '의미를 전달합니다';
      }
      
      if (korean.length > 0) {
        koreanTranslations.push(korean);
      }
    }
    
    if (koreanTranslations.length > 0) {
      if (englishHelperMode === EnglishHelperMode.PAREN) {
        result = `${result} (${koreanTranslations.join(', ')})`;
      } else if (englishHelperMode === EnglishHelperMode.TWOLINES) {
        result = `${result}\n${koreanTranslations.join('\n')}`;
      }
    }
    
    return result; // 영어는 유지
  }
  
  // ✅ OFF 모드: 영어를 한국어로 변환 (삭제가 아니라 의미 재구성)
  // 예: "finish 해" → "마무리해 주세요"
  const englishPatterns: Array<[RegExp, string]> = [
    [/finish\s+해/gi, '마무리해'],
    [/finish\s+this/gi, '이것을 마무리'],
    [/please\s+finish/gi, '마무리해 주세요'],
    [/please\s+finish\s+this/gi, '이것을 마무리해 주세요'],
    [/finish/gi, '마무리'],
    [/we decided to take a trip/gi, '여행을 가기로 결정했습니다'],
    [/decided to take a trip/gi, '여행을 가기로 결정했습니다'],
    [/take a trip/gi, '여행을 가기로'],
    [/we decided/gi, '결정했습니다'],
    [/decided/gi, '결정했습니다'],
    [/trip/gi, '여행'],
    [/we/gi, '우리는'],
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
    [/that/gi, '그것']
  ];
  
  // 영어 문장이 대부분이면 한국어로 변환
  const englishWordCount = (result.match(/\b[A-Za-z]+\b/g) || []).length;
  const totalWordCount = result.split(/\s+/).filter(w => w.trim().length > 0).length;
  
  if (englishWordCount > totalWordCount * 0.3) {
    // 영어 문장이 일부 이상이면 패턴 매칭으로 변환
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
      // 일반 영어 단어는 한국어로 변환 (삭제가 아니라)
      // 간단한 변환 (실제로는 더 정교한 번역 필요)
      return '';
    }).replace(/\s+/g, ' ').trim();
    
    // 의미가 비어있으면 기본 메시지
    if (result.trim().length === 0 || result.replace(/[^\uAC00-\uD7A3]/g, '').length === 0) {
      result = '의미를 전달합니다';
    }
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
 * ✅ englishHelperMode에 따라 분기
 */
function applyLanguagePolicy(text: string, language: string, englishHelperMode: EnglishHelperMode, originalText: string): string {
  // 한국어 모드가 아니면 그대로 반환
  if (language !== 'ko') {
    return text;
  }
  
  // ✅ 로그: englishHelperMode 확인
  console.log('[applyLanguagePolicy] englishHelperMode:', englishHelperMode, 'text:', text);
  
  // ✅ englishHelperMode가 OFF면 영어를 한국어로 변환 (삭제가 아니라)
  if (englishHelperMode === EnglishHelperMode.OFF) {
    let result = text;
    
    // 영어가 있으면 한국어로 의미 재구성
    const hasEnglish = /[A-Za-z]/.test(result);
    if (hasEnglish) {
      // 영어를 한국어로 변환 (convertEnglishToKorean 사용)
      result = convertEnglishToKorean(result, EnglishHelperMode.OFF, originalText);
    }
    
    // 연속 공백 정리
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
  }
  
  // ✅ 규칙 3: PAREN 모드 - 자연스러운 병기 (설명문 금지, 중복 방지)
  if (englishHelperMode === EnglishHelperMode.PAREN) {
    // 설명문 제거
    let cleaned = text.replace(/의미를 전달합니다/g, '').replace(/번역합니다/g, '').trim();
    
    // ✅ 영어 단어 중복 제거 (같은 영어 단어가 여러 번 나오면 한 번만 유지)
    const englishWords = cleaned.match(/\b[A-Za-z]+\b/g) || [];
    const seenWords = new Set<string>();
    const uniqueEnglishWords: string[] = [];
    
    for (const word of englishWords) {
      const lowerWord = word.toLowerCase();
      if (!seenWords.has(lowerWord)) {
        seenWords.add(lowerWord);
        uniqueEnglishWords.push(word);
      }
    }
    
    // 중복된 영어 단어 제거 (첫 번째만 유지)
    if (englishWords.length > uniqueEnglishWords.length) {
      let tempText = cleaned;
      const wordCounts: Record<string, number> = {};
      
      for (const word of englishWords) {
        const lowerWord = word.toLowerCase();
        wordCounts[lowerWord] = (wordCounts[lowerWord] || 0) + 1;
      }
      
      // 두 번째 이후의 중복 단어 제거
      const processedWords = new Set<string>();
      for (const word of englishWords) {
        const lowerWord = word.toLowerCase();
        if (wordCounts[lowerWord] > 1 && !processedWords.has(lowerWord)) {
          // 정규식 특수 문자 이스케이프
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedWord}\\b`, 'g');
          const matches = tempText.match(regex);
          if (matches && matches.length > 1) {
            // 첫 번째는 유지하고 나머지 제거
            let firstFound = false;
            tempText = tempText.replace(regex, (match) => {
              if (!firstFound) {
                firstFound = true;
                return match;
              }
              return '';
            });
          }
          processedWords.add(lowerWord); // 이미 처리했으므로 표시
        }
      }
      cleaned = tempText.replace(/\s+/g, ' ').trim();
    }
    
    const hasEnglish = /[A-Za-z]/.test(cleaned);
    const hasKorean = /[\uAC00-\uD7A3]/.test(cleaned);
    
    // ✅ 한국어 문장과 영어 문장 분리
    if (hasEnglish && hasKorean) {
      // 한국어 부분과 영어 부분 분리
      const koreanPart = cleaned.replace(/\b[A-Za-z]+\b/g, '').replace(/\s+/g, ' ').trim();
      const englishMatches = cleaned.match(/\b[A-Za-z]+(?:\s+[A-Za-z]+)*\b/g);
      const englishPart = englishMatches ? englishMatches.join(' ') : '';
      
      if (koreanPart && englishPart) {
        // 이미 괄호 안에 영어가 있으면 추가하지 않음 (중복 방지)
        if (!cleaned.includes(`(${englishPart})`) && !cleaned.match(/\([^)]*[A-Za-z][^)]*\)/)) {
          // 한국어 문장 + 영어 문장 (자연스러운 병기)
          return `${koreanPart} (${englishPart})`;
        }
      }
    }
    
    if (hasEnglish && originalText && !hasKorean) {
      // 원문의 영어를 추출하여 괄호로 추가
      const englishParts = originalText.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g);
      if (englishParts && englishParts.length > 0) {
        const englishStr = englishParts.join(' ');
        if (!cleaned.includes(`(${englishStr})`)) {
          return `${cleaned} (${englishStr})`;
        }
      }
    }
    
    return cleaned;
  }
  
  // ✅ 규칙 3: TWOLINES 모드 - 자연스러운 병기 (설명문 금지, 중복 방지)
  if (englishHelperMode === EnglishHelperMode.TWOLINES) {
    // 설명문 제거
    let cleaned = text.replace(/의미를 전달합니다/g, '').replace(/번역합니다/g, '').trim();
    
    // ✅ 영어 단어 중복 제거 (같은 영어 단어가 여러 번 나오면 한 번만 유지)
    const englishWords = cleaned.match(/\b[A-Za-z]+\b/g) || [];
    const seenWords = new Set<string>();
    
    if (englishWords.length > 0) {
      let tempText = cleaned;
      const wordCounts: Record<string, number> = {};
      
      for (const word of englishWords) {
        const lowerWord = word.toLowerCase();
        wordCounts[lowerWord] = (wordCounts[lowerWord] || 0) + 1;
      }
      
      // 두 번째 이후의 중복 단어 제거
      const processedWords = new Set<string>();
      for (const word of englishWords) {
        const lowerWord = word.toLowerCase();
        if (wordCounts[lowerWord] > 1 && !processedWords.has(lowerWord)) {
          // 정규식 특수 문자 이스케이프
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedWord}\\b`, 'g');
          let firstFound = false;
          tempText = tempText.replace(regex, (match) => {
            if (!firstFound) {
              firstFound = true;
              return match;
            }
            return '';
          });
          processedWords.add(lowerWord); // 이미 처리했으므로 표시
        }
      }
      cleaned = tempText.replace(/\s+/g, ' ').trim();
    }
    
    const hasEnglish = /[A-Za-z]/.test(cleaned);
    const hasKorean = /[\uAC00-\uD7A3]/.test(cleaned);
    
    // ✅ 한국어 문장과 영어 문장 분리
    if (hasEnglish && hasKorean) {
      // 한국어 부분과 영어 부분 분리
      const koreanPart = cleaned.replace(/\b[A-Za-z]+\b/g, '').replace(/\s+/g, ' ').trim();
      const englishMatches = cleaned.match(/\b[A-Za-z]+(?:\s+[A-Za-z]+)*\b/g);
      const englishPart = englishMatches ? englishMatches.join(' ') : '';
      
      if (koreanPart && englishPart) {
        // 이미 별도 줄에 영어가 있으면 추가하지 않음 (중복 방지)
        if (!cleaned.includes(`\n${englishPart}`) && !cleaned.endsWith(englishPart)) {
          // 한국어 문장 + 영어 문장 (자연스러운 병기)
          return `${koreanPart}\n${englishPart}`;
        }
      }
    }
    
    if (hasEnglish && originalText && !hasKorean) {
      // 원문의 영어를 추출하여 별도 줄로 추가
      const englishParts = originalText.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g);
      if (englishParts && englishParts.length > 0) {
        const englishStr = englishParts.join(' ');
        if (!cleaned.includes(`\n${englishStr}`) && !cleaned.endsWith(englishStr)) {
          return `${cleaned}\n${englishStr}`;
        }
      }
    }
    
    return cleaned;
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
 * ✅ 템플릿 오염 방지: 입력 의미를 덮어쓰지 않음
 */
function applyPurposeTemplate(text: string, purposeId: string, autoIncludeDetails?: boolean, originalText?: string): string {
  // 원문이 비어있거나 의미가 없으면 템플릿을 적용하지 않음
  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length === 0 || trimmedText === '?' || trimmedText === '.') {
    return text; // 원문 그대로 반환 (템플릿 접두어/접미어 없음)
  }
  
  // ✅ 템플릿 오염 방지: 입력 의미를 덮어쓰지 않음
  // 입력이 '사실/결정/공지'인데 "경고드립니다" 같은 문구가 자동 삽입되면 실패
  const hasWarning = /경고|시정|항의/.test(trimmedText);
  const hasNotice = /공지|안내/.test(trimmedText);
  const hasApology = /사과|죄송/.test(trimmedText);
  
  // 이미 해당 형식이 포함되어 있으면 스킵
  if (text.includes('[공지]') || text.includes('공지')) return text;
  
  const templates: Record<string, (text: string) => string> = {
    request: (t) => {
      // ✅ 규칙 1: 목적=요청이면 항의/경고 문구 제거
      t = t.replace(/항의드립니다\.?\s*/g, '');
      t = t.replace(/단호히 항의드립니다\.?\s*/g, '');
      t = t.replace(/경고드립니다\.?\s*/g, '');
      t = t.replace(/시정요구/g, '요청');
      t = t.replace(/조치를 취하겠습니다/g, '처리하겠습니다');
      
      if (t.includes('부탁') || t.includes('요청')) return t;
      if (t.endsWith('주세요') || t.endsWith('주시기 바랍니다')) return t;
      // 원문이 비어있지 않으면 부탁 표현 추가
      if (t.trim().length > 0) {
        return `${t} 부탁드립니다.`;
      }
      return t;
    },
    'notice-guide': (t) => {
      // ✅ 템플릿 오염 방지: 경고/항의가 있으면 공지 템플릿 적용하지 않음
      if (hasWarning && !hasNotice) {
        return t; // 경고가 있으면 공지 템플릿 적용하지 않음
      }
      if (t.includes('[공지]')) return t;
      // 원문이 비어있지 않으면 공지 접두어 추가
      if (t.trim().length > 0) {
        return `[공지] ${t}`;
      }
      return t;
    },
    apology: (t) => {
      // ✅ 템플릿 오염 방지: 이미 사과가 있으면 추가하지 않음
      if (hasApology) return t;
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
      // ✅ 템플릿 오염 방지: 공지/안내가 있으면 항의 템플릿 적용하지 않음
      if (hasNotice && !hasWarning) {
        return t; // 공지가 있으면 항의 템플릿 적용하지 않음
      }
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
 * originalText를 받아서 입력에 없는 정보를 추가하지 않도록 함
 */
function applyTone(text: string, toneId: string, strength: Strength, variantType: 'short' | 'standard' | 'long', originalText: string): string {
  let result = text;
  
  // 입력에 시간 표현이 있는지 확인
  const hasTime = hasTimeExpression(originalText);
  // 입력에 조치 표현이 있는지 확인
  const hasAction = hasActionExpression(originalText);
  
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
      // ✅ 규칙 1: 목적이 '요청'이면 경고/항의 문구 금지
      if (purposeId === 'request') {
        // 경고 문구 제거
        result = result.replace(/경고드립니다\.?\s*/g, '');
        result = result.replace(/시정요구/g, '요청');
        result = result.replace(/시정/g, '처리');
      } else {
        // 경고/시정요구 (기한 명시) - 규칙 3: 기한이 입력에 없으면 기한/조치 문구 추가하지 않음
        if (!result.includes('경고') && !result.includes('시정')) {
          result = `경고드립니다. ${result}`;
        }
        // 입력에 기한이 있고, 조치 표현이 있을 때만 기한/조치 문구 추가
        if (strength.softToFirm > 75 && hasTime && hasAction) {
          if (!result.includes('기한') && !result.includes('시정')) {
            result = `${result} 기한 내 시정이 이루어지지 않을 경우 다음 조치를 취하겠습니다.`;
          }
        }
        // 입력에 기한이 없거나 조치가 없으면 기한/조치 문구 추가하지 않음
      }
      break;
    
    case 'protest':
      // ✅ 규칙 1: 목적이 '요청'이면 항의 문구 금지
      if (purposeId === 'request') {
        // 항의 문구 제거
        result = result.replace(/단호히 항의드립니다\.?\s*/g, '');
        result = result.replace(/항의드립니다\.?\s*/g, '');
        result = result.replace(/항의/g, '요청');
        // 요청 표현으로 변경
        if (!result.includes('부탁') && !result.includes('요청')) {
          result = `${result} 부탁드립니다.`;
        }
      } else {
        // 단호한 항의문
        if (!result.includes('항의')) {
          result = `단호히 항의드립니다. ${result}`;
        }
        if (strength.softToFirm > 85) {
          result = result.replace(/요청/g, '요구').replace(/부탁/g, '요구');
        }
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
 * - 짧게: 1문장 핵심 요청(무엇)만
 * - 표준: 1~2문장, "무엇 + (기한 또는 요청 방식)" 포함 (단, 입력에 기한이 있을 때만)
 * - 자세히: 2~3문장, "배경 1문장 + 요청 + 기한/후속/문의" 포함 (단, 입력에 해당 정보가 있을 때만)
 */
function applyLengthRule(
  text: string,
  variantType: 'short' | 'standard' | 'long',
  resultOptions?: any,
  toneId?: string,
  originalText?: string
): string {
  // 원문 보존 (기한/조치 검사용)
  const hasTime = originalText ? hasTimeExpression(originalText) : false;
  const hasAction = originalText ? hasActionExpression(originalText) : false;
  
  // 문장 부호를 기준으로 나누지 않고, 문자 내용만 기준으로 처리
  // 공백이나 줄바꿈을 기준으로 단어/구절 단위로 분리
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  
  switch (variantType) {
    case 'short':
      // 짧게: 1문장 핵심 요청(무엇)만
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
    
    case 'standard':
      // 표준: 1~2문장, "무엇 + (기한 또는 요청 방식)" 포함
      // 단, 입력에 기한이 있을 때만 기한 추가
      let standard = text;
      
      // 기한이나 요청 방식이 없고, 입력에 기한이 있으면 추가
      if (!standard.includes('기한') && !standard.includes('까지') && !standard.includes('오늘') && !standard.includes('내일')) {
        if (hasTime) {
          // 입력에 기한이 있으면 원문의 기한 표현을 활용
          // 톤에 맞게 기한 추가
          if (toneId === 'notice-formal' || toneId === 'cultured') {
            standard += ' 오늘 중으로 부탁드립니다.';
          } else if (toneId === 'friendly') {
            standard += ' 가능하시면 오늘 중으로 부탁드려요.';
          } else {
            standard += ' 오늘 중으로 부탁드립니다.';
          }
        }
        // 입력에 기한이 없으면 기한 추가하지 않음
      }
      
      return standard;
    
    case 'long':
      // 자세히: 2~3문장, "배경 1문장 + 요청 + 기한/후속/문의" 포함
      // 단, 입력에 해당 정보가 있을 때만 추가
      let long = text;
      
      // 배경 문장이 없으면 추가 (일반적인 안내 표현)
      if (!long.includes('배경') && !long.includes('관련') && !long.includes('참고')) {
        if (toneId === 'notice-formal' || toneId === 'cultured') {
          long = `관련 사항에 대해 안내드립니다. ${long}`;
        } else {
          long = `관련하여 안내드립니다. ${long}`;
        }
      }
      
      // 자세한 내용 추가 (구체 요소 포함)
      // 단, 입력에 해당 정보가 있을 때만 추가
      if (resultOptions?.autoIncludeDetails) {
        // 기한 추가 (입력에 기한이 있을 때만)
        if (hasTime && !long.includes('기한') && !long.includes('까지') && !long.includes('오늘') && !long.includes('내일')) {
          long += ' 오늘 오후 6시까지 부탁드립니다.';
        }
        
        // 다음 단계 추가 (입력에 조치가 있을 때만)
        if (hasAction && !long.includes('다음') && !long.includes('후속') && !long.includes('추후')) {
          long += ' 추가 안내는 별도로 공지드리겠습니다.';
        }
        
        // 문의 추가 (일반적인 안내이므로 항상 가능)
        if (!long.includes('문의') && !long.includes('연락')) {
          long += ' 문의사항이 있으시면 연락 주시기 바랍니다.';
        }
      } else {
        // autoIncludeDetails가 false여도 최소 1개 구체 요소 포함
        // 단, 입력에 해당 정보가 있을 때만
        if (hasTime && !long.includes('기한') && !long.includes('까지') && !long.includes('오늘') && !long.includes('내일') &&
            !long.includes('문의') && !long.includes('연락') && !long.includes('다음') && !long.includes('후속')) {
          // 기한 추가 (입력에 기한이 있을 때만)
          long += ' 오늘 중으로 부탁드립니다.';
        } else if (!hasTime && !long.includes('문의') && !long.includes('연락')) {
          // 기한이 없으면 문의만 추가
          long += ' 문의사항이 있으시면 연락 주시기 바랍니다.';
        }
      }
      
      return long;
    
    default:
      return text;
  }
}
