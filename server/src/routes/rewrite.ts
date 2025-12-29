import express from 'express';
import { RewriteRequest } from '../types/index.js';
import { rewriteText } from '../services/rewriteEngine.js';
import { checkUsageLimit, incrementUsage } from '../services/planLimits.js';

const router = express.Router();

// DEV 모드: 환경변수로 제한 우회
const BYPASS_LIMITS = process.env.BYPASS_LIMITS === 'true' || 
                      process.env.NODE_ENV === 'development';

/**
 * POST /api/rewrite
 * 텍스트 리라이트 요청
 */
router.post('/', async (req, res) => {
  try {
    const request: RewriteRequest = req.body;
    
    // 기본값 설정
    if (!request.plan) {
      request.plan = 'free';
    }
    
    // 사용량 체크 (DEV 모드에서는 우회)
    if (!BYPASS_LIMITS) {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const usageCheck = checkUsageLimit(userId, request.plan);
      
      if (!usageCheck.allowed) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          reason: usageCheck.reason
        });
      }
    }
    
    // 리라이트 실행
    const result = rewriteText(request);
    
    // 사용량 증가 (DEV 모드에서는 증가하지 않음)
    if (!BYPASS_LIMITS && !result.safety.blocked && result.variants.length > 0) {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      incrementUsage(userId);
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Rewrite error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
