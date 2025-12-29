import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RewriteVariant, VoicePreset, VoiceControls, Plan, EnglishHelperMode } from '../types';
import { api } from '../services/api';
import { ttsProvider } from '../services/tts';
import './RewriteResult.css';

interface RewriteResultProps {
  variants: RewriteVariant[];
  plan: Plan;
  onCopy: (text: string) => void;
  onSave: (text: string) => void;
  isDev?: boolean;
  englishHelperMode?: EnglishHelperMode; // 영어 도우미 모드 추가
}

// 슬라이더 범위 상수 정의 (통일된 범위)
const SPEED_RANGE = { min: 0.8, max: 1.2, step: 0.1, default: 1.0 };
const PITCH_RANGE = { min: 0, max: 100, step: 1, default: 50 };
const EMOTION_RANGE = { min: 0, max: 100, step: 1, default: 50 };

const RewriteResultComponent: React.FC<RewriteResultProps> = ({
  variants,
  plan,
  onCopy,
  onSave,
  isDev = false,
  englishHelperMode = EnglishHelperMode.OFF
}) => {
  const { t } = useTranslation();
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  
  // 각 카드별로 완전히 분리된 state
  const [selectedVoices, setSelectedVoices] = useState<Record<string, string>>({});
  const [voiceControls, setVoiceControls] = useState<Record<string, VoiceControls>>({});
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.getVoicePresets().then(presets => {
      setVoicePresets(presets);
      
      // 각 variant별로 기본 보이스 설정
      const defaultVoice = presets[0]?.id || '';
      const defaultControls: VoiceControls = {
        rate: SPEED_RANGE.default,
        pitch: PITCH_RANGE.default,
        emotion: EMOTION_RANGE.default
      };
      
      const initialVoices: Record<string, string> = {};
      const initialControls: Record<string, VoiceControls> = {};
      
      variants.forEach(v => {
        if (!selectedVoices[v.type]) {
          initialVoices[v.type] = defaultVoice;
          initialControls[v.type] = defaultControls;
        }
      });
      
      if (Object.keys(initialVoices).length > 0) {
        setSelectedVoices(prev => ({ ...prev, ...initialVoices }));
        setVoiceControls(prev => ({ ...prev, ...initialControls }));
      }
    });
  }, [variants]);

  // 설정 변경 감지
  const handleVoiceChange = (variantType: string, voiceId: string) => {
    setSelectedVoices(prev => {
      const oldVoice = prev[variantType];
      if (oldVoice !== voiceId) {
        setHasChanges(prev => ({ ...prev, [variantType]: true }));
      }
      return { ...prev, [variantType]: voiceId };
    });
  };

  const handleControlChange = (variantType: string, field: keyof VoiceControls, value: number) => {
    // 숫자로 변환 (문자열이 올 수 있으므로)
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    setVoiceControls(prev => {
      const current = prev[variantType] || { 
        rate: SPEED_RANGE.default, 
        pitch: PITCH_RANGE.default, 
        emotion: EMOTION_RANGE.default 
      };
      const oldValue = current[field];
      
      // 값이 실제로 변경되었는지 확인
      if (Math.abs(oldValue - numValue) > 0.01) {
        setHasChanges(prev => ({ ...prev, [variantType]: true }));
      }
      
      return {
        ...prev,
        [variantType]: {
          ...current,
          [field]: numValue
        }
      };
    });
  };

  // 변경사항 적용 및 재생
  const handleApplyAndPlay = async (variant: RewriteVariant) => {
    // 변경사항 적용 표시 제거
    setHasChanges(prev => ({ ...prev, [variant.type]: false }));
    
    // 재생
    await handlePlay(variant);
  };

  const handlePlay = async (variant: RewriteVariant) => {
    // 현재 슬라이더 값을 반드시 읽어서 사용
    const voiceId = selectedVoices[variant.type] || voicePresets[0]?.id;
    const controls = voiceControls[variant.type] || {
      rate: SPEED_RANGE.default,
      pitch: PITCH_RANGE.default,
      emotion: EMOTION_RANGE.default
    };

    if (!voiceId) {
      setError(prev => ({ ...prev, [variant.type]: '보이스를 선택해주세요.' }));
      return;
    }

    if (!ttsProvider.isSupported()) {
      setError(prev => ({ ...prev, [variant.type]: '음성 재생을 지원하지 않는 브라우저입니다.' }));
      return;
    }

    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) {
      setError(prev => ({ ...prev, [variant.type]: '보이스를 찾을 수 없습니다.' }));
      return;
    }

    setPlaying(prev => ({ ...prev, [variant.type]: true }));
    setLoading(prev => ({ ...prev, [variant.type]: true }));
    setError(prev => ({ ...prev, [variant.type]: null }));

    try {
      // 슬라이더 값이 반영된 TTS 재생 (englishHelperMode 전달)
      await ttsProvider.speak(variant.text, voice, controls, englishHelperMode);
    } catch (error: any) {
      console.error('TTS error:', error);
      const errorMessage = error?.message || '음성 생성에 실패했습니다. 다시 시도해 주세요.';
      setError(prev => ({ ...prev, [variant.type]: errorMessage }));
    } finally {
      setPlaying(prev => ({ ...prev, [variant.type]: false }));
      setLoading(prev => ({ ...prev, [variant.type]: false }));
    }
  };

  const handleStop = () => {
    ttsProvider.stop();
    setPlaying({});
    setLoading({});
  };

  const handleSentencePlay = async (variant: RewriteVariant, sentence: string) => {
    // 현재 슬라이더 값을 반드시 읽어서 사용
    const voiceId = selectedVoices[variant.type] || voicePresets[0]?.id;
    const controls = voiceControls[variant.type] || {
      rate: SPEED_RANGE.default,
      pitch: PITCH_RANGE.default,
      emotion: EMOTION_RANGE.default
    };

    if (!voiceId || !ttsProvider.isSupported()) return;
    
    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) return;
    
    try {
      await ttsProvider.speak(sentence.trim(), voice, controls, englishHelperMode);
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const getVariantLabel = (type: string) => {
    switch (type) {
      case 'short': return t('result.short');
      case 'standard': return t('result.standard');
      case 'long': return t('result.long');
      default: return type;
    }
  };

  // DEV 모드에서는 모든 보이스 사용 가능, 아니면 요금제별 제한
  const availableVoices = (isDev || plan !== 'free') 
    ? voicePresets
    : voicePresets.slice(0, 2);

  // DEV 모드에서는 모든 기능 활성화
  const canUseAdvancedFeatures = isDev || plan !== 'free';

  return (
    <div className="rewrite-results">
      <h3 className="results-title">{t('result.title')}</h3>
      
      {variants.map((variant) => {
        const isPlaying = playing[variant.type] || false;
        const isLoading = loading[variant.type] || false;
        const variantError = error[variant.type];
        const currentControls = voiceControls[variant.type] || {
          rate: SPEED_RANGE.default,
          pitch: PITCH_RANGE.default,
          emotion: EMOTION_RANGE.default
        };

        return (
          <div key={variant.type} className="result-variant">
            <div className="variant-header">
              <span className="variant-type">{getVariantLabel(variant.type)}</span>
              <div className="variant-actions">
                {isPlaying ? (
                  <button
                    className="stop-btn"
                    onClick={handleStop}
                  >
                    {t('common.stop')}
                  </button>
                ) : (
                  <button
                    className="play-btn"
                    onClick={() => handlePlay(variant)}
                    disabled={!ttsProvider.isSupported() || isLoading}
                  >
                    {isLoading ? t('common.loading') : t('common.play')}
                  </button>
                )}
                <button
                  className="copy-btn"
                  onClick={() => onCopy(variant.text)}
                  disabled={isPlaying || isLoading}
                >
                  {t('common.copy')}
                </button>
                {canUseAdvancedFeatures && (
                  <button
                    className="save-btn"
                    onClick={() => onSave(variant.text)}
                    disabled={isPlaying || isLoading}
                  >
                    {t('common.save')}
                  </button>
                )}
              </div>
            </div>

            {variantError && (
              <div className="error-message">
                {variantError}
              </div>
            )}

            <div className="variant-text">
              {variant.text.split(/\n/).filter(s => s.trim().length > 0).map((line, idx) => (
                <div key={idx} className="sentence-row">
                  <span className="sentence-text">{line.trim()}</span>
                  <button
                    className="sentence-play-btn"
                    onClick={() => handleSentencePlay(variant, line.trim())}
                    disabled={!ttsProvider.isSupported() || isPlaying || isLoading}
                    title={t('result.sentenceListen')}
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>

            <div className="voice-controls">
              <div className="voice-preset-select">
                <label>{t('result.voicePreset')}</label>
                <select
                  value={selectedVoices[variant.type] || ''}
                  onChange={(e) => handleVoiceChange(variant.type, e.target.value)}
                  disabled={!canUseAdvancedFeatures && availableVoices.length === 0 || isPlaying || isLoading}
                >
                  {availableVoices.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                      {!canUseAdvancedFeatures && voicePresets.indexOf(voice) >= 2 && ' (유료)'}
                    </option>
                  ))}
                </select>
              </div>

              {canUseAdvancedFeatures && (
                <>
                  <div className="voice-slider">
                    <label>
                      {t('result.rate')}: {currentControls.rate.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min={SPEED_RANGE.min}
                      max={SPEED_RANGE.max}
                      step={SPEED_RANGE.step}
                      value={currentControls.rate}
                      onChange={(e) => handleControlChange(variant.type, 'rate', parseFloat(e.target.value))}
                      disabled={isPlaying || isLoading}
                    />
                  </div>

                  <div className="voice-slider">
                    <label>
                      {t('result.pitch')}: {currentControls.pitch}
                    </label>
                    <input
                      type="range"
                      min={PITCH_RANGE.min}
                      max={PITCH_RANGE.max}
                      step={PITCH_RANGE.step}
                      value={currentControls.pitch}
                      onChange={(e) => handleControlChange(variant.type, 'pitch', parseInt(e.target.value, 10))}
                      disabled={isPlaying || isLoading}
                    />
                  </div>

                  <div className="voice-slider">
                    <label>
                      {t('result.emotion')}: {currentControls.emotion}
                    </label>
                    <input
                      type="range"
                      min={EMOTION_RANGE.min}
                      max={EMOTION_RANGE.max}
                      step={EMOTION_RANGE.step}
                      value={currentControls.emotion}
                      onChange={(e) => handleControlChange(variant.type, 'emotion', parseInt(e.target.value, 10))}
                      disabled={isPlaying || isLoading}
                    />
                  </div>

                  {hasChanges[variant.type] && (
                    <button
                      className="apply-btn"
                      onClick={() => handleApplyAndPlay(variant)}
                      disabled={isPlaying || isLoading}
                    >
                      ✓ 변경사항 적용 및 미리듣기
                    </button>
                  )}
                </>
              )}
              
              {/* 낭독용 안내 메시지 */}
              <div className="tts-info">
                <small>
                  {englishHelperMode === EnglishHelperMode.OFF 
                    ? '낭독용으로 특수기호와 영문은 제외됩니다'
                    : '낭독용으로 특수기호는 제외됩니다 (영문 포함)'}
                </small>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RewriteResultComponent;
