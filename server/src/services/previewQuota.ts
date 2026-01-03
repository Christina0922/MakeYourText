import { Plan } from '../types/index.js';

/**
 * 미리듣기 한도 설정 (환경변수로 관리)
 */
export interface PreviewQuotaConfig {
  // 무료 사용자 한도
  freeDailyLimit: number;        // 하루 무료 미리듣기 횟수 (기본: 3)
  freeTotalLimit: number;         // 총 무료 미리듣기 횟수 (기본: 5, 0이면 비활성화)
  freeMaxLength: number;          // 1회 미리듣기 최대 길이 (초, 기본: 10)
  freeMaxChars: number;          // 1회 미리듣기 최대 글자수 (0이면 비활성화)
  freeMaxSentences: number;       // 1회 미리듣기 최대 문장수 (0이면 비활성화)
  
  // 유료 사용자 한도
  paidDailyLimit: number;         // 유료 사용자 하루 미리듣기 횟수 (0이면 무제한)
  paidMaxLength: number;           // 유료 사용자 1회 최대 길이 (초, 0이면 무제한)
}

/**
 * 환경변수에서 한도 설정 읽기
 */
function getQuotaConfig(): PreviewQuotaConfig {
  return {
    freeDailyLimit: parseInt(process.env.FREE_PREVIEW_DAILY_LIMIT || '3', 10),
    freeTotalLimit: parseInt(process.env.FREE_PREVIEW_TOTAL_LIMIT || '5', 10),
    freeMaxLength: parseInt(process.env.FREE_PREVIEW_MAX_LENGTH_SEC || '10', 10),
    freeMaxChars: parseInt(process.env.FREE_PREVIEW_MAX_CHARS || '0', 10),
    freeMaxSentences: parseInt(process.env.FREE_PREVIEW_MAX_SENTENCES || '0', 10),
    paidDailyLimit: parseInt(process.env.PAID_PREVIEW_DAILY_LIMIT || '0', 10), // 0 = 무제한
    paidMaxLength: parseInt(process.env.PAID_PREVIEW_MAX_LENGTH_SEC || '0', 10), // 0 = 무제한
  };
}

/**
 * 사용자 식별자 타입
 */
export interface UserIdentifier {
  type: 'logged_in' | 'anonymous';
  id: string; // userId 또는 anonymousToken
}

/**
 * 한도 사용량 정보
 */
export interface QuotaUsage {
  dailyCount: number;
  totalCount: number;
  lastResetDate: string; // YYYY-MM-DD 형식
  firstUseDate?: string; // 첫 사용일 (총 한도용)
}

/**
 * 한도 검사 결과
 */
export interface QuotaCheckResult {
  allowed: boolean;
  errorCode?: 'QUOTA_EXCEEDED' | 'LENGTH_EXCEEDED';
  message?: string;
  upgradeRequired: boolean;
  remainingCount?: number;
  limitCount?: number;
  resetAt?: string; // ISO 8601 형식
}

/**
 * 메모리 기반 한도 저장소 (실제 운영에서는 DB 사용)
 */
const quotaStore = new Map<string, QuotaUsage>();

/**
 * 날짜 문자열 생성 (YYYY-MM-DD)
 */
function getDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 다음 날 자정 시각 (ISO 8601)
 */
function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * 사용자 식별자로 키 생성
 */
function getUserKey(identifier: UserIdentifier): string {
  return `${identifier.type}:${identifier.id}`;
}

/**
 * 사용량 정보 가져오기 또는 초기화
 */
function getOrCreateUsage(identifier: UserIdentifier): QuotaUsage {
  const key = getUserKey(identifier);
  const today = getDateString();
  
  let usage = quotaStore.get(key);
  
  // 일일 리셋 체크
  if (!usage || usage.lastResetDate !== today) {
    usage = {
      dailyCount: 0,
      totalCount: usage?.totalCount || 0,
      lastResetDate: today,
      firstUseDate: usage?.firstUseDate || today,
    };
    quotaStore.set(key, usage);
  }
  
  return usage;
}

/**
 * 텍스트 길이 추정 (초 단위, 대략적인 계산)
 * 한국어 기준: 평균 3-4자/초
 */
function estimateDuration(text: string): number {
  // 공백 제거 후 글자수 계산
  const charCount = text.replace(/\s/g, '').length;
  // 한국어 기준 약 3.5자/초로 계산
  return Math.ceil(charCount / 3.5);
}

/**
 * 텍스트 문장수 계산
 */
function countSentences(text: string): number {
  // 마침표, 물음표, 느낌표로 문장 구분
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

/**
 * 한도 검사
 */
export function checkPreviewQuota(
  identifier: UserIdentifier,
  plan: Plan,
  text: string
): QuotaCheckResult {
  const config = getQuotaConfig();
  const usage = getOrCreateUsage(identifier);
  const today = getDateString();
  
  // 유료 사용자는 제한 완화
  if (plan !== Plan.FREE) {
    // 길이 제한 체크 (유료도 설정된 경우)
    if (config.paidMaxLength > 0) {
      const duration = estimateDuration(text);
      if (duration > config.paidMaxLength) {
        return {
          allowed: false,
          errorCode: 'LENGTH_EXCEEDED',
          message: `유료 사용자도 ${config.paidMaxLength}초를 초과할 수 없습니다.`,
          upgradeRequired: false,
        };
      }
    }
    
    // 횟수 제한 체크 (유료도 설정된 경우)
    if (config.paidDailyLimit > 0 && usage.dailyCount >= config.paidDailyLimit) {
      return {
        allowed: false,
        errorCode: 'QUOTA_EXCEEDED',
        message: `하루 ${config.paidDailyLimit}회의 미리듣기 한도를 사용하셨습니다.`,
        upgradeRequired: false,
        remainingCount: 0,
        limitCount: config.paidDailyLimit,
        resetAt: getNextResetTime(),
      };
    }
    
    // 유료 사용자는 통과
    return {
      allowed: true,
      upgradeRequired: false,
      remainingCount: config.paidDailyLimit > 0 
        ? Math.max(0, config.paidDailyLimit - usage.dailyCount - 1)
        : undefined,
      limitCount: config.paidDailyLimit > 0 ? config.paidDailyLimit : undefined,
      resetAt: getNextResetTime(),
    };
  }
  
  // 무료 사용자 한도 검사
  
  // 1. 일일 횟수 제한 체크
  if (usage.dailyCount >= config.freeDailyLimit) {
    return {
      allowed: false,
      errorCode: 'QUOTA_EXCEEDED',
      message: '무료 미리듣기 한도를 사용하셨습니다. 계속 사용하려면 요금제를 선택해 주세요.',
      upgradeRequired: true,
      remainingCount: 0,
      limitCount: config.freeDailyLimit,
      resetAt: getNextResetTime(),
    };
  }
  
  // 2. 총 횟수 제한 체크 (설정된 경우)
  if (config.freeTotalLimit > 0 && usage.totalCount >= config.freeTotalLimit) {
    return {
      allowed: false,
      errorCode: 'QUOTA_EXCEEDED',
      message: '무료 미리듣기 한도를 사용하셨습니다. 계속 사용하려면 요금제를 선택해 주세요.',
      upgradeRequired: true,
      remainingCount: 0,
      limitCount: config.freeTotalLimit,
      resetAt: undefined, // 총 한도는 리셋 없음
    };
  }
  
  // 3. 길이 제한 체크
  const duration = estimateDuration(text);
  if (duration > config.freeMaxLength) {
    return {
      allowed: false,
      errorCode: 'LENGTH_EXCEEDED',
      message: `무료 사용자는 ${config.freeMaxLength}초 이하의 텍스트만 미리듣기할 수 있습니다. 더 긴 문장은 유료 요금제에서 지원합니다.`,
      upgradeRequired: true,
    };
  }
  
  // 4. 글자수 제한 체크 (설정된 경우)
  if (config.freeMaxChars > 0) {
    const charCount = text.length;
    if (charCount > config.freeMaxChars) {
      return {
        allowed: false,
        errorCode: 'LENGTH_EXCEEDED',
        message: `무료 사용자는 ${config.freeMaxChars}자 이하의 텍스트만 미리듣기할 수 있습니다.`,
        upgradeRequired: true,
      };
    }
  }
  
  // 5. 문장수 제한 체크 (설정된 경우)
  if (config.freeMaxSentences > 0) {
    const sentenceCount = countSentences(text);
    if (sentenceCount > config.freeMaxSentences) {
      return {
        allowed: false,
        errorCode: 'LENGTH_EXCEEDED',
        message: `무료 사용자는 ${config.freeMaxSentences}문장 이하의 텍스트만 미리듣기할 수 있습니다.`,
        upgradeRequired: true,
      };
    }
  }
  
  // 모든 검사 통과
  const remainingDaily = config.freeDailyLimit - usage.dailyCount - 1;
  const remainingTotal = config.freeTotalLimit > 0 
    ? config.freeTotalLimit - usage.totalCount - 1
    : undefined;
  
  // 일일 한도와 총 한도 중 더 작은 값 사용
  const remainingCount = config.freeTotalLimit > 0
    ? Math.min(remainingDaily, remainingTotal || Infinity)
    : remainingDaily;
  
  return {
    allowed: true,
    upgradeRequired: false,
    remainingCount: Math.max(0, remainingCount),
    limitCount: config.freeTotalLimit > 0
      ? Math.min(config.freeDailyLimit, config.freeTotalLimit)
      : config.freeDailyLimit,
    resetAt: getNextResetTime(),
  };
}

/**
 * 사용량 증가
 */
export function incrementPreviewUsage(identifier: UserIdentifier): void {
  const usage = getOrCreateUsage(identifier);
  usage.dailyCount++;
  usage.totalCount++;
  
  const key = getUserKey(identifier);
  quotaStore.set(key, usage);
}

/**
 * 현재 사용량 조회
 */
export function getPreviewUsage(
  identifier: UserIdentifier,
  plan: Plan
): {
  remainingCount: number;
  limitCount: number;
  resetAt: string;
} {
  const config = getQuotaConfig();
  const usage = getOrCreateUsage(identifier);
  
  if (plan !== Plan.FREE) {
    // 유료 사용자
    if (config.paidDailyLimit > 0) {
      return {
        remainingCount: Math.max(0, config.paidDailyLimit - usage.dailyCount),
        limitCount: config.paidDailyLimit,
        resetAt: getNextResetTime(),
      };
    } else {
      // 무제한 (-1로 표시, JSON 직렬화 가능)
      return {
        remainingCount: -1,
        limitCount: -1,
        resetAt: getNextResetTime(),
      };
    }
  }
  
  // 무료 사용자
  const remainingDaily = config.freeDailyLimit - usage.dailyCount;
  const remainingTotal = config.freeTotalLimit > 0
    ? config.freeTotalLimit - usage.totalCount
    : undefined;
  
  const remainingCount = config.freeTotalLimit > 0
    ? Math.min(remainingDaily, remainingTotal || Infinity)
    : remainingDaily;
  
  const limitCount = config.freeTotalLimit > 0
    ? Math.min(config.freeDailyLimit, config.freeTotalLimit)
    : config.freeDailyLimit;
  
  return {
    remainingCount: Math.max(0, remainingCount),
    limitCount,
    resetAt: getNextResetTime(),
  };
}

