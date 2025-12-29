import { VoicePreset, VoiceControls } from '../types';
import { api } from './api';

/**
 * TTS Provider 인터페이스
 */
export interface ITtsProvider {
  speak(text: string, voicePreset: VoicePreset, controls: VoiceControls): Promise<void>;
  stop(): void;
  isSupported(): boolean;
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

  async speak(text: string, voicePreset: VoicePreset, controls: VoiceControls): Promise<void> {
    if (!this.synth) {
      throw new Error('Speech synthesis not supported');
    }

    // 기존 재생 중지
    this.stop();

    // 음성 목록 다시 로드 (최신 상태 유지)
    this.loadVoices();

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    
    // 언어 설정
    utterance.lang = 'ko-KR';
    
    // 속도 설정 (0.8 ~ 1.2) - 자연스러운 속도 유지
    utterance.rate = Math.max(0.8, Math.min(1.2, controls.rate));
    
    // 높낮이 설정 - 더 자연스러운 범위로 조정
    // pitch: 0-100을 0.8-1.2로 변환 (기계음 감소)
    utterance.pitch = 0.8 + (controls.pitch / 250); // 더 좁은 범위로 자연스럽게
    
    // 볼륨 설정 (감정 강도로 반영)
    // emotion: 0-100을 0.7-1.0으로 변환 (너무 작은 볼륨 방지)
    utterance.volume = 0.7 + (controls.emotion / 333);

    // 최적의 보이스 선택 (사람처럼 들리도록)
    this.selectBestVoice(utterance, voicePreset);

    // Promise 콜백 안에서 사용하기 위해 로컬 변수에 저장
    const synth = this.synth;

    return new Promise((resolve, reject) => {
      if (!utterance) {
        reject(new Error('Utterance not created'));
        return;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (error) => {
        reject(error);
      };

      synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.utterance = null;
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  /**
   * 최적의 보이스를 선택하여 사람처럼 들리게 함
   */
  private selectBestVoice(utterance: SpeechSynthesisUtterance, voicePreset: VoicePreset): void {
    if (this.voices.length === 0) {
      return;
    }

    // 한국어 음성 필터링
    const koreanVoices = this.voices.filter(v => 
      v.lang.startsWith('ko') || v.lang === 'ko-KR' || v.lang === 'ko'
    );

    if (koreanVoices.length === 0) {
      return;
    }

    // 프리셋 스타일에 따라 최적의 음성 선택
    let selectedVoice: SpeechSynthesisVoice | null = null;

    switch (voicePreset.style) {
      case 'formal':
      case 'apology':
        // 격식/사과: 차분하고 정중한 여성 음성 선호
        selectedVoice = koreanVoices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('여성') ||
          v.name.toLowerCase().includes('yuna') ||
          v.name.toLowerCase().includes('sora')
        ) || koreanVoices[0];
        break;

      case 'friendly':
      case 'kids':
        // 친근/어린이: 밝고 활기찬 여성 음성 선호
        selectedVoice = koreanVoices.find(v => 
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('여성') ||
          v.name.toLowerCase().includes('young')
        ) || koreanVoices[0];
        break;

      case 'work':
        // 업무: 중성적이고 명확한 음성
        selectedVoice = koreanVoices.find(v => 
          v.name.toLowerCase().includes('neutral') ||
          v.name.toLowerCase().includes('standard')
        ) || koreanVoices[0];
        break;

      default:
        // 기본: 가장 자연스러운 음성 선택
        // 일반적으로 'premium' 또는 'neural'이 포함된 음성이 더 자연스러움
        selectedVoice = koreanVoices.find(v => 
          v.name.toLowerCase().includes('premium') ||
          v.name.toLowerCase().includes('neural') ||
          v.name.toLowerCase().includes('enhanced')
        ) || koreanVoices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }
}

/**
 * 서버 기반 TTS Provider (SSML 사용, 사람처럼 들림)
 */
export class ServerTtsProvider implements ITtsProvider {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;

  async speak(text: string, voicePreset: VoicePreset, controls: VoiceControls): Promise<void> {
    // 기존 재생 중지
    this.stop();

    try {
      // 서버에서 TTS 생성
      const blob = await api.generateTts({
        text,
        voicePreset: voicePreset.id,
        rate: controls.rate,
        pitch: controls.pitch,
        emotion: controls.emotion,
        language: 'ko-KR'
      });

      // Blob URL 생성
      const url = URL.createObjectURL(blob);
      this.currentUrl = url;

      // 오디오 재생
      this.audio = new Audio(url);
      
      return new Promise((resolve, reject) => {
        if (!this.audio) {
          reject(new Error('Audio not created'));
          return;
        }

        this.audio.onended = () => {
          this.cleanup();
          resolve();
        };

        this.audio.onerror = (error) => {
          this.cleanup();
          reject(error);
        };

        this.audio.play().catch(reject);
      });
    } catch (error) {
      throw error;
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  isSupported(): boolean {
    return true; // 서버 기반이므로 항상 지원
  }
}

// TTS Provider 선택 (환경변수로 제어 가능)
const USE_SERVER_TTS = (typeof process !== 'undefined' && process.env?.REACT_APP_USE_SERVER_TTS === 'true') || false;

// TTS Provider 인스턴스
export const ttsProvider: ITtsProvider = USE_SERVER_TTS 
  ? new ServerTtsProvider()
  : new WebSpeechTtsProvider();
