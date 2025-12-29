import express from 'express';
import { rewriteText, rewriteTextForTemplate } from '../services/rewriteEngine.js';
import { checkUsageLimit } from '../services/planLimits.js';
import { RewriteRequest, EnglishHelperMode, TemplateResult } from '../types/index.js';
import { TEMPLATES } from '../data/templates.js';

const router = express.Router();

// DEV 모드: 환경변수로 제한 우회
const BYPASS_LIMITS = process.env.BYPASS_LIMITS === 'true' || 
                      process.env.NODE_ENV === 'development';

/**
 * POST /api/rewrite
 * 텍스트 리라이트 요청 처리
 */
router.post('/', async (req, res) => {
  try {
    // ✅ englishHelperMode를 req.body에서 받기
    const {
      text,
      tonePresetId,
      purposeTypeId,
      audienceLevelId,
      relationshipId,
      length,
      format,
      strength,
      resultOptions,
      language,
      englishHelperMode, // ✅ 반드시 포함
      plan
    } = req.body;

    // ✅ englishHelperMode가 undefined면 400 에러 반환
    if (englishHelperMode === undefined) {
      console.error('[englishHelperMode] missing in request body');
      return res.status(400).json({
        error: 'Invalid request',
        reason: 'englishHelperMode missing'
      });
    }

    // ✅ 처리 시작 시 로그
    console.log('[englishHelperMode]', englishHelperMode);

    // text가 비어있으면 400 에러
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        reason: '문장을 입력해 주세요'
      });
    }

    // 필수 파라미터 검증
    if (!tonePresetId || !purposeTypeId || !audienceLevelId) {
      return res.status(400).json({
        error: 'Invalid request',
        reason: '필수 파라미터가 누락되었습니다'
      });
    }

    // 사용량 제한 체크 (DEV 모드에서는 우회)
    if (!BYPASS_LIMITS) {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const usageCheck = checkUsageLimit(userId, plan || 'free');
      if (!usageCheck.allowed) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          reason: usageCheck.reason
        });
      }
    }

    // ✅ 템플릿 일괄 생성 모드
    const selectedTemplates = req.body.selectedTemplates as string[] | undefined;
    
    if (selectedTemplates && selectedTemplates.length > 0) {
      // 최대 30개 제한
      if (selectedTemplates.length > 30) {
        return res.status(400).json({
          error: 'Invalid request',
          reason: '템플릿은 최대 30개까지 선택할 수 있습니다'
        });
      }
      
      // 템플릿별 결과 생성
      const templateResults: TemplateResult[] = [];
      
      for (const templateId of selectedTemplates) {
        const template = TEMPLATES.find(t => t.id === templateId);
        if (!template) {
          templateResults.push({
            templateId,
            templateName: '알 수 없음',
            tags: [],
            text: '',
            error: '템플릿을 찾을 수 없습니다'
          });
          continue;
        }
        
        try {
          // 템플릿별 리라이트 요청 생성
          const templateRequest: RewriteRequest = {
            text: text.trim(),
            tonePresetId: template.toneId,
            purposeTypeId: template.purposeId,
            audienceLevelId: template.audienceId,
            relationshipId: template.relationshipId,
            length: length || 'standard',
            format: template.format,
            strength: strength || { softToFirm: 50 },
            resultOptions: resultOptions || {},
            language: language || 'ko',
            englishHelperMode: englishHelperMode || EnglishHelperMode.OFF,
            plan: plan || 'free'
          };
          
          // 템플릿별 리라이트 실행
          const templateText = await rewriteTextForTemplate(templateRequest);
          
          templateResults.push({
            templateId,
            templateName: template.name,
            tags: template.tags,
            text: templateText
          });
        } catch (error: any) {
          templateResults.push({
            templateId,
            templateName: template.name,
            tags: template.tags,
            text: '',
            error: error.message || '생성 실패'
          });
        }
      }
      
      // ✅ 템플릿 일괄 생성 결과 반환
      return res.json({
        variants: [],
        safety: { blocked: false },
        templateResults
      });
    }
    
    // 기존 단일 생성 모드
    const rewriteRequest: RewriteRequest = {
      text: text.trim(),
      tonePresetId,
      purposeTypeId,
      audienceLevelId,
      relationshipId,
      length: length || 'standard',
      format: format || 'message',
      strength: strength || { softToFirm: 50 },
      resultOptions: resultOptions || {},
      language: language || 'ko',
      englishHelperMode: englishHelperMode || EnglishHelperMode.OFF, // ✅ 서버에서도 받아서 처리
      plan: plan || 'free'
    };

    // 리라이트 실행
    const result = rewriteText(rewriteRequest);

    // ✅ 응답에 englishHelperMode 포함 (DEV 모드 확인용)
    res.json({
      ...result,
      meta: {
        englishHelperMode: englishHelperMode
      }
    });
  } catch (error: any) {
    console.error('Rewrite error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
