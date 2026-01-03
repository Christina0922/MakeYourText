import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateResult, VoicePreset, VoiceControls, EnglishHelperMode, Plan, PreviewQuota } from '../types';
import { ttsProvider } from '../services/tts';
import { requestPreview, getPreviewQuota, trackPreviewEvent } from '../services/previewService';
import PreviewQuotaDisplay from './PreviewQuotaDisplay';
import UpgradeModal from './UpgradeModal';
import './TemplateResults.css';

interface TemplateResultsProps {
  results: TemplateResult[];
  plan?: Plan;
  englishHelperMode?: EnglishHelperMode;
  onCopy?: (text: string) => void;
  onSave?: (result: TemplateResult) => void;
  onRetry?: (templateId: string) => void;
}

const TemplateResults: React.FC<TemplateResultsProps> = ({
  results,
  plan = Plan.FREE,
  englishHelperMode = EnglishHelperMode.OFF,
  onCopy,
  onSave,
  onRetry
}) => {
  const { t } = useTranslation();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceControls, setVoiceControls] = useState<Record<string, VoiceControls>>({});
  const [selectedVoices, setSelectedVoices] = useState<Record<string, VoicePreset>>({});
  const [quota, setQuota] = useState<PreviewQuota | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState<string>('');

  useEffect(() => {
    loadQuota();
  }, [plan]);

  const loadQuota = async () => {
    try {
      const quotaData = await getPreviewQuota(plan);
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to load quota:', error);
    }
  };

  const handlePlay = async (result: TemplateResult) => {
    if (playingId === result.templateId) {
      ttsProvider.stop();
      setPlayingId(null);
      return;
    }

    setPlayingId(result.templateId);
    
    const controls = voiceControls[result.templateId] || {
      rate: 1.0,
      pitch: 50,
      emotion: 50
    };
    
    const voice = selectedVoices[result.templateId] || {
      id: 'cultured-voice',
      label: '교양/격식',
      gender: 'neutral',
      age: 'mid',
      style: 'formal'
    };

    // 미리듣기 이벤트 기록
    trackPreviewEvent('preview_clicked', { plan, templateId: result.templateId });

    try {
      // 서버에서 한도 검사 후 미리듣기 요청
      const previewResult = await requestPreview(
        result.text,
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
            templateId: result.templateId,
          });
        } else {
          alert(previewResult.error?.message || '미리듣기에 실패했습니다.');
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
        
        setPlayingId(null);
        return;
      }

      // 한도 검사 통과 - 실제 TTS 재생
      await ttsProvider.speak(result.text, voice, controls, englishHelperMode);
      
      // 성공 이벤트 기록
      trackPreviewEvent('preview_success', { plan, templateId: result.templateId });
      
      // 한도 정보 업데이트
      if (previewResult.quota) {
        setQuota(previewResult.quota);
      } else {
        await loadQuota();
      }
      
      setPlayingId(null);
    } catch (error: any) {
      console.error('TTS error:', error);
      alert('음성 재생에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
      trackPreviewEvent('preview_failed', {
        plan,
        errorCode: 'INTERNAL_ERROR',
        templateId: result.templateId,
        error: error.message,
      });
      setPlayingId(null);
    }
  };

  const handleUpgrade = () => {
    console.log('Upgrade requested');
    window.alert('업그레이드 기능은 준비 중입니다.');
  };

  const handleCopyAll = () => {
    const allText = results
      .filter(r => !r.error)
      .map(r => `[${r.templateName}]\n${r.text}`)
      .join('\n\n');
    
    if (onCopy) {
      onCopy(allText);
    } else {
      navigator.clipboard.writeText(allText);
    }
  };

  const handleSaveAll = () => {
    results.filter(r => !r.error).forEach(result => {
      if (onSave) {
        onSave(result);
      }
    });
  };

  if (results.length === 0) {
    return null;
  }

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;

  return (
    <div className="template-results">
      <div className="template-results-header">
        <div>
          <h3>템플릿별 결과 ({successCount}개 성공{errorCount > 0 ? `, ${errorCount}개 실패` : ''})</h3>
          {quota && (
            <PreviewQuotaDisplay quota={quota} plan={plan} />
          )}
        </div>
        <div className="template-results-actions">
          <button onClick={handleCopyAll}>전체 복사</button>
          <button onClick={handleSaveAll}>전체 저장</button>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
        message={upgradeModalMessage}
        plan={plan}
      />

      <div className="template-results-list">
        {results.map((result) => (
          <div
            key={result.templateId}
            className={`template-result-card ${result.error ? 'error' : ''}`}
          >
            <div className="template-result-header">
              <div className="template-result-title">
                <h4>{result.templateName}</h4>
                <div className="template-result-tags">
                  {result.tags.map((tag, idx) => (
                    <span key={idx} className="template-result-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="template-result-actions">
                {result.error ? (
                  <button
                    className="retry-button"
                    onClick={() => onRetry && onRetry(result.templateId)}
                  >
                    재시도
                  </button>
                ) : (
                  <>
                    <button
                      className="play-button"
                      onClick={() => handlePlay(result)}
                      disabled={playingId === result.templateId}
                    >
                      {playingId === result.templateId ? '⏸ 정지' : '▶ 미리듣기'}
                    </button>
                    <button
                      onClick={() => onCopy && onCopy(result.text)}
                    >
                      복사
                    </button>
                    <button
                      onClick={() => onSave && onSave(result)}
                    >
                      저장
                    </button>
                  </>
                )}
              </div>
            </div>

            {result.error ? (
              <div className="template-result-error">
                오류: {result.error}
              </div>
            ) : (
              <div className="template-result-text">
                {result.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateResults;

