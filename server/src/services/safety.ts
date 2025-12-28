import { SafetyCheck, TonePreset } from '../types/index.js';
import { TONE_PRESETS } from '../data/presets.js';

// 위험 키워드 패턴 (차단 대상)
const DANGEROUS_PATTERNS = [
  // 폭력/해악
  /살해|살인|죽여|때려|폭행|구타|폭력|해치|해코지|해치워|없애|제거해|죽일|죽이겠|죽이게/gi,
  /가족.*위협|가족.*해치|가족.*해코지|가족.*때려|가족.*죽여/gi,
  /테러|폭탄|폭발|살상|폭파/gi,
  /협박.*살해|협박.*폭행|협박.*해치/gi,
  
  // 불법행위 유도
  /협박.*불법|갈취|강요.*불법|강제.*불법|억압.*불법/gi,
  /스토킹|따라다니|추적해|감시해.*불법/gi,
  /불법.*촬영|몰카|도촬|불법.*촬영.*유포/gi,
  /해킹|침입|불법.*접근|불법.*침입/gi,
  /사기|사칭|위조.*문서|위조.*증명/gi,
  
  // 과도한 욕설/혐오
  /씨발|개새끼|병신|미친놈|좆|씹|빠구리|개같|좆같|씹새/gi,
  /혐오.*표현|차별.*표현|비하.*표현/gi,
  
  // 개인정보 유도
  /주민번호.*알려|계좌번호.*알려|비밀번호.*알려|카드번호.*알려|주소.*알려|전화번호.*알려/gi,
  /주민번호.*보내|계좌번호.*보내|비밀번호.*보내/gi
];

// 허용 가능한 강경 표현 (법적 절차 수준)
const ALLOWED_STRONG_EXPRESSIONS = [
  /법적.*절차|법적.*검토|법적.*대응/gi,
  /환불|계약.*해지|민원.*접수|시정.*요구/gi,
  /기한.*내|기한.*명시|최종.*통보/gi
];

/**
 * 텍스트 안전 검사
 */
export function validateTextSafety(text: string, tonePresetId: string): SafetyCheck {
  const tonePreset = TONE_PRESETS.find(t => t.id === tonePresetId);
  const isStrongTone = tonePreset?.category === 'strong';
  
  // 위험 패턴 검사
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: '위험한 표현이 포함되어 있습니다. 안전한 문장으로 수정해주세요.',
        suggestedAlternative: isStrongTone 
          ? '시정요구 범주로 순화된 문장을 제안합니다.'
          : undefined
      };
    }
  }
  
  // 강경 톤에서 추가 검사
  if (isStrongTone) {
    // 허용된 강경 표현만 사용 가능
    const hasAllowedExpression = ALLOWED_STRONG_EXPRESSIONS.some(pattern => pattern.test(text));
    const hasDangerousExpression = DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
    
    if (hasDangerousExpression && !hasAllowedExpression) {
      return {
        blocked: true,
        reason: '강경 톤에서는 법적 절차 수준의 표현만 사용 가능합니다.',
        suggestedAlternative: '기한 내 미이행 시 법적 절차를 검토하겠습니다.'
      };
    }
  }
  
  return { blocked: false };
}

