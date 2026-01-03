import { Request, Response, NextFunction } from 'express';
import { getUsage, getPlan, getNextResetTime } from '../services/quotaStore.js';

// 환경변수에서 제한 값 읽기
const FREE_DAILY_REQUESTS = parseInt(process.env.FREE_DAILY_REQUESTS || '20', 10);
const FREE_DAILY_CHARS = parseInt(process.env.FREE_DAILY_CHARS || '20000', 10);

/**
 * Quota Guard 미들웨어
 * 무료 사용자의 일일 사용량 제한을 체크합니다.
 */
export function quotaGuard(req: Request, res: Response, next: NextFunction): void {
  try {
    // userId 헤더 확인
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(400).json({
        ok: false,
        error: 'USER_ID_REQUIRED',
        message: 'x-user-id header is required'
      });
      return;
    }

    // 플랜 확인 (에러 발생 시 FREE로 처리)
    let plan: 'FREE' | 'PRO' = 'FREE';
    try {
      const planResult = getPlan(userId);
      plan = planResult.plan;
    } catch (error: any) {
      console.error('[quotaGuard] Failed to get plan:', error);
      // 에러 발생 시 FREE로 처리하고 계속 진행
    }
    
    // PRO 사용자는 통과
    if (plan === 'PRO') {
      next();
      return;
    }

    // FREE 사용자: 사용량 체크 (에러 발생 시 통과)
    let usage = { requests: 0, chars: 0 };
    try {
      usage = getUsage(userId);
    } catch (error: any) {
      console.error('[quotaGuard] Failed to get usage:', error);
      // 에러 발생 시 통과 (서버 문제로 인한 차단 방지)
      next();
      return;
    }

    const requestText = typeof req.body?.text === 'string' ? req.body.text : '';
    const requestChars = requestText.length;

    // 횟수 제한 체크
    if (usage.requests >= FREE_DAILY_REQUESTS) {
      res.status(402).json({
        ok: false,
        error: 'QUOTA_EXCEEDED',
        message: '일일 요청 횟수를 초과했습니다.',
        quota: {
          limitRequests: FREE_DAILY_REQUESTS,
          usedRequests: usage.requests,
          limitChars: FREE_DAILY_CHARS,
          usedChars: usage.chars,
          resetAt: getNextResetTime()
        },
        upgradeUrl: '/upgrade'
      });
      return;
    }

    // 글자수 제한 체크 (현재 요청 포함)
    if (usage.chars + requestChars > FREE_DAILY_CHARS) {
      res.status(402).json({
        ok: false,
        error: 'QUOTA_EXCEEDED',
        message: '일일 글자 수 제한을 초과했습니다.',
        quota: {
          limitRequests: FREE_DAILY_REQUESTS,
          usedRequests: usage.requests,
          limitChars: FREE_DAILY_CHARS,
          usedChars: usage.chars,
          resetAt: getNextResetTime()
        },
        upgradeUrl: '/upgrade'
      });
      return;
    }

    // 통과
    next();
  } catch (error: any) {
    console.error('[quotaGuard] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}

