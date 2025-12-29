import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RewriteVariant, VoicePreset, VoiceControls, Plan } from '../types';
import { api } from '../services/api';
import { ttsProvider } from '../services/tts';
import './RewriteResult.css';

interface RewriteResultProps {
  variants: RewriteVariant[];
  plan: Plan;
  onCopy: (text: string) => void;
  onSave: (text: string) => void;
  isDev?: boolean;
}

const RewriteResultComponent: React.FC<RewriteResultProps> = ({
  variants,
  plan,
  onCopy,
  onSave,
  isDev = false
}) => {
  const { t } = useTranslation();
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  
  // 각 카드별로 완전히 분리된 state
  const [selectedVoices, setSelectedVoices] = useState<Record<string, string>>({});
  const [voiceControls, setVoiceControls] = useState<Record<string, VoiceControls>>({});
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.getVoicePresets().then(presets => {
      setVoicePresets(presets);
      
      // 각 variant별로 기본 보이스 설정
      const defaultVoice = presets[0]?.id || '';
      const defaultControls: VoiceControls = {
        rate: 1.0,
        pitch: 50,
        emotion: 50
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
    setVoiceControls(prev => {
      const oldValue = prev[variantType]?.[field];
      if (oldValue !== value) {
        setHasChanges(prev => ({ ...prev, [variantType]: true }));
      }
      return {
        ...prev,
        [variantType]: {
          ...prev[variantType] || { rate: 1.0, pitch: 50, emotion: 50 },
          [field]: value
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
      rate: 1.0,
      pitch: 50,
      emotion: 50
    };

    if (!voiceId) {
      alert('보이스를 선택해주세요.');
      return;
    }

    if (!ttsProvider.isSupported()) {
      alert('음성 재생을 지원하지 않는 브라우저입니다.');
      return;
    }

    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) return;

    setPlaying(prev => ({ ...prev, [variant.type]: true }));

    try {
      // 슬라이더 값이 반영된 TTS 재생
      await ttsProvider.speak(variant.text, voice, controls);
    } catch (error) {
      console.error('TTS error:', error);
      alert('음성 재생 중 오류가 발생했습니다.');
    } finally {
      setPlaying(prev => ({ ...prev, [variant.type]: false }));
    }
  };

  const handleStop = () => {
    ttsProvider.stop();
    setPlaying({});
  };

  const handleSentencePlay = async (variant: RewriteVariant, sentence: string) => {
    // 현재 슬라이더 값을 반드시 읽어서 사용
    const voiceId = selectedVoices[variant.type] || voicePresets[0]?.id;
    const controls = voiceControls[variant.type] || {
      rate: 1.0,
      pitch: 50,
      emotion: 50
    };

    if (!voiceId || !ttsProvider.isSupported()) return;
    
    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) return;
    
    try {
      await ttsProvider.speak(sentence.trim(), voice, controls);
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
      
      {variants.map((variant) => (
        <div key={variant.type} className="result-variant">
          <div className="variant-header">
            <span className="variant-type">{getVariantLabel(variant.type)}</span>
            <div className="variant-actions">
              <button
                className="play-btn"
                onClick={() => playing[variant.type] ? handleStop() : handlePlay(variant)}
                disabled={!ttsProvider.isSupported()}
              >
                {playing[variant.type] ? t('common.pause') : t('common.play')}
              </button>
              <button
                className="copy-btn"
                onClick={() => onCopy(variant.text)}
              >
                {t('common.copy')}
              </button>
              {canUseAdvancedFeatures && (
                <button
                  className="save-btn"
                  onClick={() => onSave(variant.text)}
                >
                  {t('common.save')}
                </button>
              )}
            </div>
          </div>

          <div className="variant-text">
            {variant.text.split(/\n/).filter(s => s.trim().length > 0).map((line, idx) => (
              <div key={idx} className="sentence-row">
                <span className="sentence-text">{line.trim()}</span>
                <button
                  className="sentence-play-btn"
                  onClick={() => handleSentencePlay(variant, line.trim())}
                  disabled={!ttsProvider.isSupported()}
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
                disabled={!canUseAdvancedFeatures && availableVoices.length === 0}
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
                  <label>{t('result.rate')}: {voiceControls[variant.type]?.rate.toFixed(1) || '1.0'}</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.1"
                    value={voiceControls[variant.type]?.rate || 1.0}
                    onChange={(e) => handleControlChange(variant.type, 'rate', Number(e.target.value))}
                  />
                </div>

                <div className="voice-slider">
                  <label>{t('result.pitch')}: {voiceControls[variant.type]?.pitch || 50}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceControls[variant.type]?.pitch || 50}
                    onChange={(e) => handleControlChange(variant.type, 'pitch', Number(e.target.value))}
                  />
                </div>

                <div className="voice-slider">
                  <label>{t('result.emotion')}: {voiceControls[variant.type]?.emotion || 50}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceControls[variant.type]?.emotion || 50}
                    onChange={(e) => handleControlChange(variant.type, 'emotion', Number(e.target.value))}
                  />
                </div>

                {hasChanges[variant.type] && (
                  <button
                    className="apply-btn"
                    onClick={() => handleApplyAndPlay(variant)}
                  >
                    ✓ 변경사항 적용 및 미리듣기
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RewriteResultComponent;
