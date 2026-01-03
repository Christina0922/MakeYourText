import express from 'express';
import { VOICE_PRESETS } from '../data/presets.js';
import { Plan } from '../types/index.js';
import {
  checkPreviewQuota,
  incrementPreviewUsage,
  getPreviewUsage,
  UserIdentifier,
} from '../services/previewQuota.js';

const router = express.Router();

/**
 * 텍스트를 낭독용으로 전처리 (SSML break 태그 추가)
 */
function preprocessTextForSSML(text: string): string {
  let result = text;
  
  // 1. 문장부호 기반 쉼 추가
  // 쉼표 뒤에 150ms 쉼
  result = result.replace(/,/g, '<break time="150ms"/>');
  // 마침표 뒤에 300ms 쉼
  result = result.replace(/\./g, '<break time="300ms"/>');
  // 물음표/느낌표 뒤에 350ms 쉼
  result = result.replace(/\?/g, '<break time="350ms"/>');
  result = result.replace(/!/g, '<break time="350ms"/>');
  
  // 2. 강조어(요청/기한/중요)에 emphasis 추가
  const emphasisWords = ['부탁', '요청', '기한', '오늘', '내일', '반드시', '중요', '필수'];
  for (const word of emphasisWords) {
    if (result.includes(word)) {
      // SSML emphasis 태그로 강조
      result = result.replace(new RegExp(`(${word})`, 'g'), '<emphasis level="moderate">$1</emphasis>');
    }
  }
  
  return result;
}

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

    // 텍스트 전처리 (낭독용으로 변환)
    const processedText = preprocessTextForSSML(text);

    // SSML 생성 (속도/높낮이/강도 반영)
    // rate: 0.8 ~ 1.2 (기본 1.0)
    // pitch: 0 ~ 100 (50이 기본, -10% ~ +10%로 변환)
    // emotion: 0 ~ 100 (50이 기본, 볼륨/강조로 반영)
    
    const ssmlRate = Math.max(0.8, Math.min(1.2, rate || 1.0));
    // pitch: 0-100을 -10% ~ +10%로 변환 (SSML pitch는 percentage)
    const pitchValue = pitch || 50;
    const ssmlPitch = ((pitchValue - 50) / 50) * 10; // -10% ~ +10%
    
    // emotion: 0-100을 볼륨과 속도 변화로 반영
    const emotionValue = emotion || 50;
    const ssmlVolume = 0.7 + (emotionValue / 333); // 0.7 ~ 1.0
    
    // 감정 강도에 따라 속도도 약간 조절
    let adjustedRate = ssmlRate;
    if (emotionValue > 70) {
      adjustedRate = Math.min(1.2, ssmlRate + 0.1);
    } else if (emotionValue < 30) {
      adjustedRate = Math.max(0.8, ssmlRate - 0.1);
    }

    // SSML 형식으로 텍스트 래핑
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${getVoiceName(preset)}">
          <prosody rate="${adjustedRate}" pitch="${ssmlPitch > 0 ? '+' : ''}${ssmlPitch.toFixed(1)}%" volume="${ssmlVolume.toFixed(2)}">
            ${processedText}
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

/**
 * 사용자 식별자 추출 (헤더에서)
 * - Authorization 헤더가 있으면 로그인 사용자 (userId)
 * - 없으면 X-Anonymous-Token 헤더에서 익명 토큰 사용
 * - 둘 다 없으면 IP 기반 임시 식별자 생성
 */
function getUserIdentifier(req: express.Request): UserIdentifier {
  // 로그인 사용자 확인 (실제로는 JWT 토큰 검증)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // TODO: JWT 토큰에서 userId 추출
    // 임시로 토큰 자체를 사용
    const token = authHeader.substring(7);
    return { type: 'logged_in', id: token };
  }
  
  // 익명 사용자 토큰 확인
  const anonymousToken = req.headers['x-anonymous-token'] as string;
  if (anonymousToken) {
    return { type: 'anonymous', id: anonymousToken };
  }
  
  // 둘 다 없으면 IP 기반 임시 식별자 (개발용)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return { type: 'anonymous', id: `ip:${ip}` };
}

/**
 * POST /api/tts/preview
 * 미리듣기 전용 API (한도 검사 포함)
 * 
 * 주의: 이 엔드포인트는 index.ts의 /api/tts/preview로 대체되었습니다.
 * 이 라우터가 등록되어 있다면 충돌을 방지하기 위해 이 핸들러는 비활성화합니다.
 */
// router.post('/preview', ...) - 비활성화: index.ts에서 처리

/**
 * GET /api/tts/preview/quota
 * 현재 사용자의 미리듣기 한도 정보 조회
 * x-user-id 헤더가 없으면 서버가 anon userId를 생성하여 처리
 */
router.get('/preview/quota', async (req, res) => {
  try {
    const plan = (req.query.plan as Plan) || Plan.FREE;
    const identifier = getUserIdentifier(req);
    const usage = getPreviewUsage(identifier, plan);
    
    res.json({
      remainingCount: usage.remainingCount === Infinity ? -1 : usage.remainingCount,
      limitCount: usage.limitCount === Infinity ? -1 : usage.limitCount,
      resetAt: usage.resetAt,
      unlimited: usage.limitCount === Infinity,
    });
  } catch (error: any) {
    console.error('Quota check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

export default router;
