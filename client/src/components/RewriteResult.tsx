import React, { useState } from 'react';
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
}

const RewriteResultComponent: React.FC<RewriteResultProps> = ({
  variants,
  plan,
  onCopy,
  onSave
}) => {
  const { t } = useTranslation();
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [selectedVoices, setSelectedVoices] = useState<Record<string, string>>({});
  const [voiceControls, setVoiceControls] = useState<Record<string, VoiceControls>>({});
  const [playing, setPlaying] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    api.getVoicePresets().then(presets => {
      setVoicePresets(presets);
      
      // 기본 보이스 설정
      const defaultVoice = presets[0]?.id || '';
      const defaultControls: VoiceControls = {
        rate: 1.0,
        pitch: 50,
        emotion: 50
      };
      
      variants.forEach(v => {
        if (!selectedVoices[v.type]) {
          setSelectedVoices(prev => ({ ...prev, [v.type]: defaultVoice }));
          setVoiceControls(prev => ({ ...prev, [v.type]: defaultControls }));
        }
      });
    });
  }, [variants]);

  const handlePlay = async (variant: RewriteVariant) => {
    const voiceId = selectedVoices[variant.type] || voicePresets[0]?.id;
    const controls = voiceControls[variant.type] || {
      rate: 1.0,
      pitch: 50,
      emotion: 50
    };

    if (!voiceId || !ttsProvider.isSupported()) {
      alert('음성 재생을 지원하지 않는 브라우저입니다.');
      return;
    }

    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) return;

    setPlaying(prev => ({ ...prev, [variant.type]: true }));

    try {
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

  const getVariantLabel = (type: string) => {
    switch (type) {
      case 'short': return t('result.short');
      case 'standard': return t('result.standard');
      case 'long': return t('result.long');
      default: return type;
    }
  };

  // 요금제별 보이스 제한
  const availableVoices = plan === 'free' 
    ? voicePresets.slice(0, 2)
    : voicePresets;

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
              {plan !== 'free' && (
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
            {variant.text.split(/[.,。\n]/).filter(s => s.trim().length > 0).map((sentence, idx) => (
              <div key={idx} className="sentence-row">
                <span className="sentence-text">{sentence.trim()}{idx < variant.text.split(/[.,。\n]/).filter(s => s.trim().length > 0).length - 1 ? '.' : ''}</span>
                <button
                  className="sentence-play-btn"
                  onClick={async () => {
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
                  }}
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
                onChange={(e) => setSelectedVoices(prev => ({
                  ...prev,
                  [variant.type]: e.target.value
                }))}
                disabled={plan === 'free' && availableVoices.length === 0}
              >
                {availableVoices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                    {plan === 'free' && voicePresets.indexOf(voice) >= 2 && ' (유료)'}
                  </option>
                ))}
              </select>
            </div>

            {plan !== 'free' && (
              <>
                <div className="voice-slider">
                  <label>{t('result.rate')}: {voiceControls[variant.type]?.rate.toFixed(1) || '1.0'}</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.1"
                    value={voiceControls[variant.type]?.rate || 1.0}
                    onChange={(e) => setVoiceControls(prev => ({
                      ...prev,
                      [variant.type]: {
                        ...prev[variant.type],
                        rate: Number(e.target.value)
                      }
                    }))}
                  />
                </div>

                <div className="voice-slider">
                  <label>{t('result.pitch')}: {voiceControls[variant.type]?.pitch || 50}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceControls[variant.type]?.pitch || 50}
                    onChange={(e) => setVoiceControls(prev => ({
                      ...prev,
                      [variant.type]: {
                        ...prev[variant.type],
                        pitch: Number(e.target.value)
                      }
                    }))}
                  />
                </div>

                <div className="voice-slider">
                  <label>{t('result.emotion')}: {voiceControls[variant.type]?.emotion || 50}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceControls[variant.type]?.emotion || 50}
                    onChange={(e) => setVoiceControls(prev => ({
                      ...prev,
                      [variant.type]: {
                        ...prev[variant.type],
                        emotion: Number(e.target.value)
                      }
                    }))}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RewriteResultComponent;

