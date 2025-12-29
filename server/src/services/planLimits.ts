import { Plan, UsageLimits } from '../types/index.js';

// DEV 모드: 환경변수로 제한 우회
const BYPASS_LIMITS = process.env.BYPASS_LIMITS === 'true' || 
                      process.env.NODE_ENV === 'development';

/**
 * 요금제별 사용량 제한
 */
export function getPlanLimits(plan: Plan): UsageLimits {
  // DEV 모드에서는 PRO 제한을 반환 (모든 제한 해제)
  if (BYPASS_LIMITS) {
    return {
      dailyRewrites: 999999,
      weeklyRewrites: 999999,
      maxVariants: 3,
      maxVoices: 20,
      voicePlayLimit: 999999,
      historyLimit: 999999
    };
  }

  switch (plan) {
    case Plan.FREE:
      return {
        dailyRewrites: 10,
        weeklyRewrites: 50,
        maxVariants: 2,        // 1~2버전만
        maxVoices: 2,          // 보이스 1~2개만
        voicePlayLimit: 20,    // 음성 재생 횟수 제한
        historyLimit: 10       // 히스토리 제한
      };
    
    case Plan.PRO:
      return {
        dailyRewrites: 100,
        weeklyRewrites: 500,
        maxVariants: 3,        // 3버전 (짧게/표준/자세히)
        maxVoices: 10,         // 보이스 여러 개
        voicePlayLimit: 1000,
        historyLimit: 1000
      };
    
    case Plan.BUSINESS:
      return {
        dailyRewrites: 1000,
        weeklyRewrites: 5000,
        maxVariants: 3,
        maxVoices: 20,
        voicePlayLimit: 10000,
        historyLimit: 10000
      };
    
    default:
      return getPlanLimits(Plan.FREE);
  }
}

/**
 * 사용량 체크 (간단한 메모리 기반, 실제로는 DB 사용)
 */
const usageStore = new Map<string, { daily: number; weekly: number; lastReset: Date }>();

export function checkUsageLimit(userId: string, plan: Plan): { allowed: boolean; reason?: string } {
  // DEV 모드: 모든 제한 우회
  if (BYPASS_LIMITS) {
    return { allowed: true };
  }

  const limits = getPlanLimits(plan);
  const now = new Date();
  
  let usage = usageStore.get(userId);
  
  // 일일/주간 리셋 체크
  if (!usage || now.getTime() - usage.lastReset.getTime() > 7 * 24 * 60 * 60 * 1000) {
    usage = { daily: 0, weekly: 0, lastReset: now };
    usageStore.set(userId, usage);
  }
  
  if (usage.daily >= limits.dailyRewrites) {
    return { allowed: false, reason: '일일 사용량을 초과했습니다.' };
  }
  
  if (usage.weekly >= limits.weeklyRewrites) {
    return { allowed: false, reason: '주간 사용량을 초과했습니다.' };
  }
  
  return { allowed: true };
}

export function incrementUsage(userId: string) {
  // DEV 모드에서는 사용량 증가하지 않음
  if (BYPASS_LIMITS) {
    return;
  }

  const usage = usageStore.get(userId);
  if (usage) {
    usage.daily++;
    usage.weekly++;
  }
}
