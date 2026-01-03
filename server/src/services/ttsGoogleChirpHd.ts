import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { normalizeForTts } from './ttsPreprocess.js';
import { toSsml, SsmlOptions } from './ssmlBuilder.js';
import { getVoiceProfile, normalizeAudienceLevelId, normalizeRelationshipId } from './ttsVoiceProfile.js';
import path from 'path';
import { existsSync } from 'fs';

// 환경변수
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'GOOGLE_CHIRP_HD';
const TTS_VOICE = process.env.TTS_VOICE || 'ko-KR-Chirp-HD-F';
const TTS_AUDIO = (process.env.TTS_AUDIO || 'MP3').toUpperCase();
const DEV_MODE = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

let ttsClient: TextToSpeechClient | null = null;

/**
 * TTS 클라이언트 초기화
 */
function initTtsClient(): TextToSpeechClient | null {
  if (ttsClient) {
    return ttsClient;
  }

  // DEV 모드이고 인증 정보가 없으면 null 반환
  if (DEV_MODE && !GOOGLE_APPLICATION_CREDENTIALS && !GOOGLE_CLOUD_PROJECT) {
    console.warn('[TTS] DEV mode: Google Cloud credentials not set, using dummy mode');
    return null;
  }

  try {
    // 서비스 계정 키 파일이 있으면 사용
    if (GOOGLE_APPLICATION_CREDENTIALS) {
      const keyPath = path.resolve(GOOGLE_APPLICATION_CREDENTIALS);
      if (existsSync(keyPath)) {
        ttsClient = new TextToSpeechClient({
          keyFilename: keyPath,
          projectId: GOOGLE_CLOUD_PROJECT
        });
        console.log('[TTS] Initialized with service account key:', keyPath);
        return ttsClient;
      }
    }

    // ADC (Application Default Credentials) 사용
    ttsClient = new TextToSpeechClient({
      projectId: GOOGLE_CLOUD_PROJECT
    });
    console.log('[TTS] Initialized with ADC');
    return ttsClient;
  } catch (error: any) {
    console.error('[TTS] Failed to initialize client:', error);
    return null;
  }
}

/**
 * 더미 오디오 생성 (DEV 모드용)
 */
function generateDummyAudio(): Buffer {
  // 간단한 더미 WAV 헤더 (1초 침묵)
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const duration = 1; // 1초
  const dataSize = sampleRate * channels * (bitsPerSample / 8) * duration;

  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV 헤더 작성
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // data 부분은 0으로 채움 (침묵)

  return buffer;
}

/**
 * Google Chirp 3 HD TTS로 음성 생성
 */
export interface TtsOptions {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  audienceLevelId?: string;  // 연령대 (초등 저학년, 중학생, 성인, 시니어 등)
  relationshipId?: string;   // 관계 (친구, 선생님, 상사 등)
}

export async function synthesizeSpeech(options: TtsOptions): Promise<Buffer> {
  const {
    text,
    voice = TTS_VOICE,
    rate,
    pitch,
    audioEncoding = TTS_AUDIO as 'MP3' | 'LINEAR16' | 'OGG_OPUS',
    audienceLevelId,
    relationshipId
  } = options;

  // 클라이언트 초기화
  const client = initTtsClient();

  // 클라이언트가 없으면 에러 발생 (더미 오디오 반환하지 않음)
  if (!client) {
    throw new Error('TTS client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT');
  }

  try {
    // 1. 텍스트 전처리
    const normalizedText = normalizeForTts(text);
    
    if (!normalizedText.trim()) {
      throw new Error('Text is empty after preprocessing');
    }

    // 2. 연령대와 관계에 따른 목소리 프로필 가져오기
    const normalizedAudience = audienceLevelId ? normalizeAudienceLevelId(audienceLevelId) : undefined;
    const normalizedRelationship = relationshipId ? normalizeRelationshipId(relationshipId) : undefined;
    const voiceProfile = getVoiceProfile(normalizedAudience, normalizedRelationship);

    // 3. 사용자 지정 rate/pitch가 있으면 우선 적용, 없으면 프로필 사용
    const finalRate = rate !== undefined ? rate : voiceProfile.rate;
    const finalPitch = pitch !== undefined ? pitch : voiceProfile.pitch;
    
    console.log('[TTS] Voice profile:', {
      audienceLevelId: normalizedAudience,
      relationshipId: normalizedRelationship,
      rate: finalRate,
      pitch: finalPitch,
      breakTime: voiceProfile.breakTime
    });
    
    // 4. SSML 생성 (연령대/관계에 맞는 자연스러운 목소리)
    const ssml = toSsml(normalizedText, {
      rate: finalRate,
      pitch: finalPitch,
      volume: voiceProfile.volume,
      breakTime: voiceProfile.breakTime
    });

    // 5. Google TTS API 호출 (연령대/관계에 맞는 자연스러운 설정)
    const [response] = await client.synthesizeSpeech({
      input: { ssml },
      voice: {
        languageCode: 'ko-KR',
        name: voice,
        ssmlGender: 'FEMALE' // Chirp-HD-F는 FEMALE
      },
      audioConfig: {
        audioEncoding: audioEncoding === 'MP3' ? 'MP3' : audioEncoding === 'LINEAR16' ? 'LINEAR16' : 'OGG_OPUS',
        speakingRate: finalRate,     // 연령대/관계에 맞는 속도
        pitch: finalPitch,            // 연령대/관계에 맞는 pitch
        volumeGainDb: (voiceProfile.volume - 1.0) * 12  // 볼륨 조정 (0.85~1.0을 dB로 변환)
      }
    });

    if (!response.audioContent) {
      throw new Error('No audio content returned from TTS API');
    }

    // Buffer로 변환
    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    return audioBuffer;
  } catch (error: any) {
    console.error('[TTS] Synthesis error:', error);
    // 에러는 그대로 전파 (더미 오디오 반환하지 않음)
    throw error;
  }
}

/**
 * 사용 가능한 보이스 목록 조회
 */
export async function listVoices(): Promise<Array<{ name: string; languageCode: string; ssmlGender: string }>> {
  const client = initTtsClient();

  if (!client && DEV_MODE) {
    // 더미 보이스 목록 반환
    return [
      { name: 'ko-KR-Chirp-HD-F', languageCode: 'ko-KR', ssmlGender: 'FEMALE' },
      { name: 'ko-KR-Chirp-HD-M', languageCode: 'ko-KR', ssmlGender: 'MALE' },
    ];
  }

  if (!client) {
    throw new Error('TTS client not initialized');
  }

  try {
    const [result] = await client.listVoices({
      languageCode: 'ko-KR'
    });

    return (result.voices || []).map(voice => ({
      name: voice.name || '',
      languageCode: voice.languageCodes?.[0] || 'ko-KR',
      ssmlGender: String(voice.ssmlGender || 'NEUTRAL')
    }));
  } catch (error: any) {
    console.error('[TTS] List voices error:', error);
    // 에러 시 기본 목록 반환
    return [
      { name: 'ko-KR-Chirp-HD-F', languageCode: 'ko-KR', ssmlGender: 'FEMALE' },
      { name: 'ko-KR-Chirp-HD-M', languageCode: 'ko-KR', ssmlGender: 'MALE' },
    ];
  }
}

