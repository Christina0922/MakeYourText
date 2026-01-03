import express from 'express';
import { synthesizeSpeech } from '../services/ttsGoogleChirpHd.js';

const router = express.Router();

/**
 * POST /tts/preview
 * POST /api/tts/preview
 * TTS 미리듣기 오디오 생성 및 반환
 * 
 * 성공: 200 + audio/mpeg (바이너리)
 * 실패: 4xx/5xx + JSON
 */
router.post('/preview', async (req, res) => {
  try {
    const { text, voice, rate, pitch, audienceLevelId, relationshipId } = req.body;

    // 디버그 로그
    console.log('[TTS Preview] Request:', {
      textLength: text?.length || 0,
      voice: voice || 'default',
      rate,
      pitch,
      audienceLevelId,
      relationshipId,
      path: req.path
    });

    // 텍스트 검증
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('[TTS Preview] Error: TEXT_REQUIRED');
      return res.status(400).json({
        ok: false,
        error: 'TEXT_REQUIRED',
        message: 'text is required'
      });
    }

    try {
      // TTS 오디오 생성
      const audioBuffer = await synthesizeSpeech({
        text: text.trim(),
        voice,
        rate: typeof rate === 'number' ? rate : undefined,
        pitch: typeof pitch === 'number' ? pitch : undefined,
        audienceLevelId: typeof audienceLevelId === 'string' ? audienceLevelId : undefined,
        relationshipId: typeof relationshipId === 'string' ? relationshipId : undefined,
        audioEncoding: 'MP3'
      });

      // 성공 로그
      console.log('[TTS Preview] Success:', {
        audioSize: audioBuffer.length,
        contentType: 'audio/mpeg',
        path: req.path
      });

      // MP3 오디오 바이너리 반환 (200 OK)
      res.status(200);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache');
      res.send(audioBuffer);
      
    } catch (ttsError: any) {
      // TTS 클라이언트가 초기화되지 않은 경우
      if (ttsError.message?.includes('not initialized') || 
          ttsError.message?.includes('TTS client') ||
          ttsError.code === 'TTS_NOT_CONFIGURED') {
        console.error('[TTS Preview] Error: TTS_NOT_CONFIGURED');
        return res.status(501).json({
          ok: false,
          error: 'TTS_NOT_CONFIGURED',
          message: 'TTS service is not configured. Please set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT'
        });
      }
      
      // 기타 TTS 에러
      console.error('[TTS Preview] Error:', ttsError);
      return res.status(500).json({
        ok: false,
        error: 'TTS_ERROR',
        message: ttsError.message || 'TTS generation failed'
      });
    }
  } catch (error: any) {
    console.error('[TTS Preview] Unexpected error:', error);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error'
    });
  }
});

export default router;

