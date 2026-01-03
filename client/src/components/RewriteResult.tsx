import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RewriteVariant, VoicePreset, VoiceControls, Plan, EnglishHelperMode, PreviewQuota } from '../types';
import { api } from '../services/api';
import { ttsProvider } from '../services/tts';
import { requestPreview, getPreviewQuota, trackPreviewEvent } from '../services/previewService';
import { fetchPreviewAudio, playAudioBlob } from '../utils/tts';
import PreviewQuotaDisplay from './PreviewQuotaDisplay';
import UpgradeModal from './UpgradeModal';
import './RewriteResult.css';

interface RewriteResultProps {
  variants: RewriteVariant[];
  plan: Plan;
  onCopy: (text: string) => void;
  onSave: (text: string) => void;
  isDev?: boolean;
  englishHelperMode?: EnglishHelperMode; // 영어 도우미 모드 추가
  audienceLevelId?: string;  // 연령대 (초등 저학년, 중학생, 성인, 시니어 등)
  relationshipId?: string;   // 관계 (친구, 선생님, 상사 등)
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
  englishHelperMode = EnglishHelperMode.OFF,
  audienceLevelId,
  relationshipId
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
  
  // 미리듣기 한도 관련 state
  const [quota, setQuota] = useState<PreviewQuota | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState<string>('');

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
    
    // 미리듣기 한도 조회
    loadQuota();
  }, [variants, plan]);
  
  // 한도 정보 로드
  const loadQuota = async () => {
    try {
      const quotaData = await getPreviewQuota(plan);
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to load quota:', error);
    }
  };

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

    // 미리듣기 이벤트 기록
    trackPreviewEvent('preview_clicked', { plan, variantType: variant.type });

    setPlaying(prev => ({ ...prev, [variant.type]: true }));
    setLoading(prev => ({ ...prev, [variant.type]: true }));
    setError(prev => ({ ...prev, [variant.type]: null }));

    try {
      // 서버에서 한도 검사 후 미리듣기 요청
      const previewResult = await requestPreview(
        variant.text,
        voice,
        controls,
        plan,
        'ko-KR'
      );

      if (!previewResult.success) {
        // 한도 초과 또는 기타 에러
        if (previewResult.error?.upgradeRequired) {
          setUpgradeModalMessage(
            previewResult.error.message || '무료 미리듣기 한도를 사용하셨습니다. 계속 사용하려면 요금제를 선택해 주세요.'
          );
          setShowUpgradeModal(true);
          trackPreviewEvent('preview_failed', {
            plan,
            errorCode: previewResult.error.errorCode,
            variantType: variant.type,
          });
        } else {
          setError(prev => ({
            ...prev,
            [variant.type]: previewResult.error?.message || '미리듣기에 실패했습니다.',
          }));
        }
        
        // 한도 정보 업데이트
        if (previewResult.error?.remainingCount !== undefined) {
          setQuota(prev => prev ? {
            ...prev,
            remainingCount: previewResult.error!.remainingCount!,
            limitCount: previewResult.error!.limitCount || prev.limitCount,
            resetAt: previewResult.error!.resetAt || prev.resetAt,
          } : null);
        }
        
        return;
      }

      // 한도 검사 통과 - 서버 TTS로 오디오 생성 및 재생
      try {
        // 서버 TTS API 호출 (Google Chirp 3 HD)
        // rate: 0.8-1.2를 0.87 기준으로 조정 (더 느리고 자연스럽게)
        const serverRate = controls.rate ? Math.max(0.75, Math.min(1.05, controls.rate * 0.87)) : 0.87;
        // pitch: 0-100을 -5~+3 semitones로 변환 (더 자연스러운 범위)
        const serverPitch = controls.pitch ? ((controls.pitch - 50) / 50) * 4 - 2 : -2;
        
        const audioBlob = await fetchPreviewAudio(variant.text, {
          voice: voice.id, // 보이스 ID 전달
          rate: serverRate,
          pitch: serverPitch,
          audienceLevelId: audienceLevelId,  // 연령대 전달
          relationshipId: relationshipId      // 관계 전달
        });

        // 오디오 재생
        await playAudioBlob(audioBlob);
        
        // 성공 이벤트 기록
        trackPreviewEvent('preview_success', { plan, variantType: variant.type });
      } catch (ttsError: any) {
        // 501 (TTS_NOT_CONFIGURED)일 때만 개발용 폴백 허용
        if (ttsError.code === 'TTS_NOT_CONFIGURED' || ttsError.status === 501) {
          console.warn('[TTS] TTS not configured, using Web Speech API as fallback:', ttsError.message);
          try {
            await ttsProvider.speak(variant.text, voice, controls, englishHelperMode);
            trackPreviewEvent('preview_success', { plan, variantType: variant.type, fallback: true });
          } catch (fallbackError: any) {
            setError(prev => ({
              ...prev,
              [variant.type]: 'TTS 서비스가 설정되지 않았고, 브라우저 TTS도 사용할 수 없습니다.'
            }));
            trackPreviewEvent('preview_failed', {
              plan,
              errorCode: 'TTS_NOT_CONFIGURED',
              variantType: variant.type,
            });
          }
        } else {
          // 기타 에러는 폴백하지 않고 에러 표시
          console.error('[TTS] Server TTS failed:', ttsError);
          const errorMessage = ttsError.message || 'TTS 생성에 실패했습니다.';
          setError(prev => ({
            ...prev,
            [variant.type]: errorMessage
          }));
          trackPreviewEvent('preview_failed', {
            plan,
            errorCode: 'TTS_ERROR',
            variantType: variant.type,
            error: errorMessage
          });
        }
      }
      
      // 한도 정보 업데이트
      if (previewResult.quota) {
        setQuota(previewResult.quota);
      } else {
        // 한도 정보 다시 조회
        await loadQuota();
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      const errorMessage = error?.message || '음성 생성에 실패했습니다. 다시 시도해 주세요.';
      setError(prev => ({ ...prev, [variant.type]: errorMessage }));
      trackPreviewEvent('preview_failed', {
        plan,
        errorCode: 'INTERNAL_ERROR',
        variantType: variant.type,
        error: errorMessage,
      });
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
    if (!sentence || !sentence.trim()) {
      return;
    }

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

    const voice = voicePresets.find(v => v.id === voiceId);
    if (!voice) {
      setError(prev => ({ ...prev, [variant.type]: '보이스를 찾을 수 없습니다.' }));
      return;
    }

    setPlaying(prev => ({ ...prev, [variant.type]: true }));
    setLoading(prev => ({ ...prev, [variant.type]: true }));
    setError(prev => ({ ...prev, [variant.type]: null }));

    try {
      // 서버 TTS로 문장 재생 (미리듣기와 동일한 방식)
      const serverRate = controls.rate ? Math.max(0.75, Math.min(1.05, controls.rate * 0.87)) : 0.87;
      const serverPitch = controls.pitch ? ((controls.pitch - 50) / 50) * 4 - 2 : -2;
      
      const audioBlob = await fetchPreviewAudio(sentence.trim(), {
        voice: voice.id,
        rate: serverRate,
        pitch: serverPitch,
        audienceLevelId: audienceLevelId,
        relationshipId: relationshipId
      });

      await playAudioBlob(audioBlob);
      
      trackPreviewEvent('preview_success', { plan, variantType: variant.type, sentence: true });
    } catch (ttsError: any) {
      // 501 (TTS_NOT_CONFIGURED)일 때만 개발용 폴백 허용
      if (ttsError.code === 'TTS_NOT_CONFIGURED' || ttsError.status === 501) {
        console.warn('[TTS] TTS not configured, using Web Speech API as fallback:', ttsError.message);
        try {
          await ttsProvider.speak(sentence.trim(), voice, controls, englishHelperMode);
          trackPreviewEvent('preview_success', { plan, variantType: variant.type, sentence: true, fallback: true });
        } catch (fallbackError: any) {
          setError(prev => ({
            ...prev,
            [variant.type]: 'TTS 서비스가 설정되지 않았고, 브라우저 TTS도 사용할 수 없습니다.'
          }));
        }
      } else {
        // 기타 에러는 폴백하지 않고 에러 표시
        console.error('[TTS] Server TTS failed:', ttsError);
        const errorMessage = ttsError.message || 'TTS 생성에 실패했습니다.';
        setError(prev => ({
          ...prev,
          [variant.type]: errorMessage
        }));
      }
    } finally {
      setPlaying(prev => ({ ...prev, [variant.type]: false }));
      setLoading(prev => ({ ...prev, [variant.type]: false }));
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

  const handleUpgrade = () => {
    // 실제로는 결제 페이지로 이동하거나 업그레이드 처리
    console.log('Upgrade requested');
    // TODO: 결제 페이지로 이동
    window.alert('업그레이드 기능은 준비 중입니다.');
  };

  return (
    <div className="rewrite-results">
      <div className="results-header">
        <h3 className="results-title">{t('result.title')}</h3>
        {quota && (
          <PreviewQuotaDisplay quota={quota} plan={plan} />
        )}
      </div>
      
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
        message={upgradeModalMessage}
        plan={plan}
      />
      
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
