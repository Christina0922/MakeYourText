import express from 'express';
import { VOICE_PRESETS } from '../data/presets.js';

const router = express.Router();

/**
 * POST /api/tts
 * 텍스트를 음성으로 변환 (서버 기반 TTS)
 * SSML을 사용하여 속도/높낮이/강도를 반영
 */
router.post('/', async (req, res) => {
  try {
    const { text, voicePreset, rate, pitch, emotion, language = 'ko-KR' } = req.body;

    if (!text || !voicePreset) {
      return res.status(400).json({
        error: 'Missing required parameters: text, voicePreset'
      });
    }

    // 보이스 프리셋 확인
    const preset = VOICE_PRESETS.find(v => v.id === voicePreset);
    if (!preset) {
      return res.status(400).json({
        error: 'Invalid voice preset'
      });
    }

    // SSML 생성 (속도/높낮이/강도 반영)
    // rate: 0.8 ~ 1.2 (기본 1.0)
    // pitch: 0 ~ 100 (50이 기본, 0.5 ~ 1.5로 변환)
    // emotion: 0 ~ 100 (50이 기본, 볼륨/강조로 반영)
    
    const ssmlRate = rate || 1.0;
    const ssmlPitch = 0.5 + ((pitch || 50) / 100); // 0.5 ~ 1.5
    const ssmlVolume = 0.5 + ((emotion || 50) / 200); // 0.5 ~ 1.0

    // SSML 형식으로 텍스트 래핑
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${getVoiceName(preset)}">
          <prosody rate="${ssmlRate}" pitch="${ssmlPitch}" volume="${ssmlVolume}">
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `.trim();

    // 실제 TTS 서비스 호출 (예: Google Cloud TTS, Azure TTS, AWS Polly 등)
    // 여기서는 예시로 간단한 응답을 반환
    // 실제 구현 시 TTS 서비스 API를 호출하여 mp3를 생성
    
    // TODO: 실제 TTS 서비스 연동
    // 예: const audioBuffer = await ttsService.synthesize(ssml);
    
    // 임시로 에러 반환 (실제 TTS 서비스 연동 필요)
    res.status(501).json({
      error: 'Server TTS not implemented yet',
      message: 'Please use browser TTS for now. Set REACT_APP_USE_SERVER_TTS=false',
      ssml: ssml // 디버깅용
    });

    // 실제 구현 시:
    // res.setHeader('Content-Type', 'audio/mpeg');
    // res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * 보이스 프리셋에서 실제 TTS 보이스 이름 매핑
 */
function getVoiceName(preset: any): string {
  // 실제 TTS 서비스의 보이스 이름으로 매핑
  // 예: Google Cloud TTS, Azure TTS 등
  const voiceMap: Record<string, string> = {
    'cultured-voice': 'ko-KR-Standard-A', // 예시
    'friendly-voice': 'ko-KR-Standard-B',
    'work-voice': 'ko-KR-Standard-C',
    'apology-voice': 'ko-KR-Standard-D',
    'kids-voice': 'ko-KR-Standard-E'
  };
  
  return voiceMap[preset.id] || 'ko-KR-Standard-A';
}

/**
 * XML 특수문자 이스케이프
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default router;

