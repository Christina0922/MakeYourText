import { VoicePreset, VoiceControls } from '../types';

/**
 * TTS Provider 인터페이스
 */
export interface ITtsProvider {
  speak(text: string, voicePreset: VoicePreset, controls: VoiceControls): Promise<void>;
  stop(): void;
  isSupported(): boolean;
}

/**
 * Web Speech API TTS Provider (MVP)
 */
export class WebSpeechTtsProvider implements ITtsProvider {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  async speak(
    text: string,
    voicePreset: VoicePreset,
    controls: VoiceControls
  ): Promise<void> {
    if (!this.synth) {
      throw new Error('Speech synthesis is not supported');
    }

    // 기존 재생 중지
    this.stop();

    return new Promise((resolve, reject) => {
      this.utterance = new SpeechSynthesisUtterance(text);

      // 언어 설정
      this.utterance.lang = 'ko-KR';

      // 속도 (0.8 ~ 1.2)
      this.utterance.rate = controls.rate;

      // 높낮이 (0 ~ 2, 기본 1)
      this.utterance.pitch = 1 + (controls.pitch - 50) / 50; // 0-100을 0.5-1.5로 변환

      // 볼륨 (감정 강도에 따라)
      this.utterance.volume = 0.5 + controls.emotion / 200; // 0-100을 0.5-1.0으로 변환

      // 보이스 프리셋에 따른 음성 선택
      this.selectVoice(voicePreset);

      this.utterance.onend = () => {
        resolve();
      };

      this.utterance.onerror = (error) => {
        reject(error);
      };

      this.synth!.speak(this.utterance);
    });
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.utterance = null;
  }

  private selectVoice(voicePreset: VoicePreset): void {
    if (!this.synth || !this.utterance) return;

    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    // 한국어 음성 필터링
    const koreanVoices = voices.filter(v => v.lang.startsWith('ko'));

    if (koreanVoices.length === 0) {
      // 한국어 음성이 없으면 기본 음성 사용
      return;
    }

    // 보이스 프리셋 스타일에 따라 선택
    let selectedVoice = koreanVoices[0];

    // 성별/연령/스타일에 따른 선택 로직 (간단한 휴리스틱)
    if (voicePreset.style === 'apology' || voicePreset.style === 'formal') {
      // 낮은 톤 선호
      selectedVoice = koreanVoices.find(v => v.name.includes('Female')) || koreanVoices[0];
    } else if (voicePreset.style === 'friendly' || voicePreset.style === 'kids') {
      // 밝은 톤 선호
      selectedVoice = koreanVoices.find(v => v.name.includes('Female')) || koreanVoices[0];
    }

    this.utterance.voice = selectedVoice;
  }
}

// TTS Provider 인스턴스
export const ttsProvider = new WebSpeechTtsProvider();

