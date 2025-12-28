import express from 'express';
import { RewriteRequest } from '../types/index.js';
import { rewriteText } from '../services/rewriteEngine.js';
import { checkUsageLimit, incrementUsage } from '../services/planLimits.js';

const router = express.Router();

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
    
    // 사용량 체크 (실제로는 userId를 세션/토큰에서 가져옴)
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const usageCheck = checkUsageLimit(userId, request.plan);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        reason: usageCheck.reason
      });
    }
    
    // 리라이트 실행
    const result = rewriteText(request);
    
    // 사용량 증가
    if (!result.safety.blocked && result.variants.length > 0) {
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

