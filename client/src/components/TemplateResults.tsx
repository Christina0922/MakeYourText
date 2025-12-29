import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateResult, VoicePreset, VoiceControls, EnglishHelperMode } from '../types';
import { ttsProvider } from '../services/tts';
import './TemplateResults.css';

interface TemplateResultsProps {
  results: TemplateResult[];
  englishHelperMode?: EnglishHelperMode;
  onCopy?: (text: string) => void;
  onSave?: (result: TemplateResult) => void;
  onRetry?: (templateId: string) => void;
}

const TemplateResults: React.FC<TemplateResultsProps> = ({
  results,
  englishHelperMode = EnglishHelperMode.OFF,
  onCopy,
  onSave,
  onRetry
}) => {
  const { t } = useTranslation();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceControls, setVoiceControls] = useState<Record<string, VoiceControls>>({});
  const [selectedVoices, setSelectedVoices] = useState<Record<string, VoicePreset>>({});

  const handlePlay = async (result: TemplateResult) => {
    if (playingId === result.templateId) {
      ttsProvider.stop();
      setPlayingId(null);
      return;
    }

    setPlayingId(result.templateId);
    
    const controls = voiceControls[result.templateId] || {
      rate: 1.0,
      pitch: 0,
      emotion: 50
    };
    
    const voice = selectedVoices[result.templateId] || {
      id: 'cultured-voice',
      label: '교양/격식',
      gender: 'neutral',
      age: 'mid',
      style: 'formal'
    };

    try {
      await ttsProvider.speak(result.text, voice, controls, englishHelperMode);
      setPlayingId(null);
    } catch (error: any) {
      console.error('TTS error:', error);
      alert('음성 재생에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
      setPlayingId(null);
    }
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
        <h3>템플릿별 결과 ({successCount}개 성공{errorCount > 0 ? `, ${errorCount}개 실패` : ''})</h3>
        <div className="template-results-actions">
          <button onClick={handleCopyAll}>전체 복사</button>
          <button onClick={handleSaveAll}>전체 저장</button>
        </div>
      </div>

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

