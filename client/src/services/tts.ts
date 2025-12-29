import { VoicePreset, VoiceControls, EnglishHelperMode } from '../types';

export interface ITtsProvider {
  speak(text: string, voicePreset: VoicePreset, controls: VoiceControls, englishHelperMode?: EnglishHelperMode): Promise<void>;
  stop(): void;
  isSupported(): boolean;
}

/**
 * TTS용 텍스트 정제 (특수기호 제거, 영어 도우미 모드에 따라 영문 처리)
 * 화면 표시용(textDisplay)과 TTS용(textForTTS)을 분리
 */
function sanitizeForTTS(text: string, englishHelperMode: EnglishHelperMode = EnglishHelperMode.OFF): string {
  // 1) 특수기호는 전부 제거 (발음 금지)
  // 한글/공백/영문/숫자만 남기고 나머지는 공백 처리
  let cleaned = text.replace(/[^\uAC00-\uD7A3\sA-Za-z0-9]/g, ' ');

  // 2) 연속 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 3) 영어 도우미 모드에 따라 영문/숫자 처리
  if (englishHelperMode === EnglishHelperMode.OFF) {
    // 한글 모드: 영문/숫자 제거 (한글만 읽기)
    cleaned = cleaned.replace(/[A-Za-z0-9]/g, '').replace(/\s+/g, ' ').trim();
  }
  // PAREN, TWOLINES 모드일 때는 영문/숫자 유지 (영어도 읽기)

  return cleaned;
}

/**
 * Web Speech API TTS Provider (개선된 음성 품질)
 */
export class WebSpeechTtsProvider implements ITtsProvider {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      
      // 음성 목록이 비동기로 로드될 수 있으므로 이벤트 리스너 추가
      if (this.synth) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices(): void {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  async speak(text: string, voicePreset: VoicePreset, controls: VoiceControls, englishHelperMode: EnglishHelperMode = EnglishHelperMode.OFF): Promise<void> {
    if (!this.synth) {
      throw new Error('Speech synthesis not supported');
    }

    // 기존 재생 중지
    this.stop();

    // 음성 목록 다시 로드 (최신 상태 유지)
    this.loadVoices();

    // ✅ TTS용 텍스트 정제 (특수기호 제거, 영어 도우미 모드에 따라 영문 처리)
    const processedText = sanitizeForTTS(text, englishHelperMode);

    const utterance = new SpeechSynthesisUtterance(processedText);
    this.utterance = utterance;
    
    // 언어 설정
    // 영어가 포함되어 있으면 다국어 지원
    const hasEnglish = /[A-Za-z]/.test(processedText);
    if (hasEnglish && englishHelperMode !== EnglishHelperMode.OFF) {
      utterance.lang = 'ko-KR, en-US'; // 한국어와 영어 모두 지원
    } else {
      utterance.lang = 'ko-KR';
    }
    
    // 속도 설정 (0.8 ~ 1.2, 기본 1.0) - 통일된 범위
    const rate = Math.max(0.8, Math.min(1.2, controls.rate || 1.0));
    utterance.rate = rate;
    
    // 높낮이 설정 - 더 자연스러운 범위로 조정
    // pitch: 0-100을 0.8-1.2로 변환 (기계음 감소)
    const pitchValue = controls.pitch || 50;
    const pitch = 0.8 + (pitchValue / 100) * 0.4; // 0.8 ~ 1.2
    utterance.pitch = pitch;
    
    // 감정 강도 설정 - 볼륨과 속도에 반영
    // emotion: 0-100을 볼륨 0.5-1.0으로 변환
    const emotionValue = controls.emotion || 50;
    const volume = 0.5 + (emotionValue / 200); // 0.5 ~ 1.0
    utterance.volume = volume;
    
    // 감정 강도에 따라 속도도 약간 조절
    let adjustedRate = rate;
    if (emotionValue > 70) {
      adjustedRate = Math.min(1.2, rate + 0.1);
    } else if (emotionValue < 30) {
      adjustedRate = Math.max(0.8, rate - 0.1);
    }
    utterance.rate = adjustedRate;
    
    // 보이스 선택 (한국어 우선, 자연스러운 목소리)
    const koreanVoices = this.voices.filter(v => 
      v.lang.startsWith('ko') || v.lang.startsWith('ko-KR')
    );
    
    if (koreanVoices.length > 0) {
      // 프리셋에 맞는 보이스 선택
      let selectedVoice = koreanVoices[0];
      
      // 프리셋별 보이스 매칭
      if (voicePreset.id === 'cultured-voice' || voicePreset.id === 'formal-voice') {
        // 교양/격식: 차분하고 또렷한 목소리
        selectedVoice = koreanVoices.find(v => 
          v.name.includes('premium') || 
          v.name.includes('neural') || 
          v.name.includes('enhanced') ||
          v.name.includes('Standard')
        ) || koreanVoices[0];
      } else if (voicePreset.id === 'friendly-voice') {
        // 친근: 밝고 부드러운 목소리
        selectedVoice = koreanVoices.find(v => 
          v.name.includes('Wavenet') || 
          v.name.includes('Neural') ||
          v.name.includes('B')
        ) || koreanVoices[0];
      } else if (voicePreset.id === 'work-voice' || voicePreset.id === 'firm-voice') {
        // 업무/단호: 속도 보통, 억양 낮게
        selectedVoice = koreanVoices.find(v => 
          v.name.includes('C') || 
          v.name.includes('Standard')
        ) || koreanVoices[0];
      } else if (voicePreset.id === 'apology-voice') {
        // 사과: 낮은 톤, 느린 속도
        selectedVoice = koreanVoices.find(v => 
          v.name.includes('D') || 
          v.name.includes('Standard')
        ) || koreanVoices[0];
      } else if (voicePreset.id === 'kids-voice') {
        // 초1: 밝고 짧게
        selectedVoice = koreanVoices.find(v => 
          v.name.includes('E') || 
          v.name.includes('Neural')
        ) || koreanVoices[0];
      }
      
      utterance.voice = selectedVoice;
    }
    
    return new Promise((resolve, reject) => {
      if (!this.utterance) {
        reject(new Error('Utterance not initialized'));
        return;
      }
      
      this.utterance.onend = () => {
        resolve();
      };
      
      this.utterance.onerror = (error) => {
        reject(error);
      };
      
      if (this.synth) {
        this.synth.speak(this.utterance);
      } else {
        reject(new Error('Speech synthesis not available'));
      }
    });
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.utterance = null;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

/**
 * 서버 기반 TTS Provider (SSML 지원)
 */
export class ServerTtsProvider implements ITtsProvider {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5000/api') {
    this.baseUrl = baseUrl;
  }

  async speak(text: string, voicePreset: VoicePreset, controls: VoiceControls, englishHelperMode: EnglishHelperMode = EnglishHelperMode.OFF): Promise<void> {
    // ✅ TTS용 텍스트 정제 (특수기호 제거, 영어 도우미 모드에 따라 영문 처리)
    const processedText = sanitizeForTTS(text, englishHelperMode);
    
    const response = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: processedText,
        voicePreset: voicePreset.id,
        rate: controls.rate,
        pitch: controls.pitch,
        emotion: controls.emotion,
        language: 'ko-KR',
        englishHelperMode: englishHelperMode
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };
      audio.play();
    });
  }

  stop(): void {
    // 서버 TTS는 Audio 객체를 추적해야 함 (구현 필요)
  }

  isSupported(): boolean {
    return true; // 서버 TTS는 항상 지원
  }
}

// TTS Provider 선택 (환경변수로 제어)
const USE_SERVER_TTS = process.env.REACT_APP_USE_SERVER_TTS === 'true';

export const ttsProvider: ITtsProvider = USE_SERVER_TTS
  ? new ServerTtsProvider(process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api')
  : new WebSpeechTtsProvider();
