import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan, RewriteResult, Strength, LengthOption, FormatOption, EnglishHelperMode, TemplateResult } from './types';
import { api } from './services/api';
import RewriteForm from './components/RewriteForm';
import RewriteResultComponent from './components/RewriteResult';
import TemplateSelector from './components/TemplateSelector';
import TemplateResults from './components/TemplateResults';
import SafetyWarning from './components/SafetyWarning';
import PlanBadge from './components/PlanBadge';
import LanguageSelector from './components/LanguageSelector';
import './App.css';

// DEV 모드: 개발/테스트 단계에서는 항상 PRO로 동작
const IS_DEV = process.env.NODE_ENV === 'development' || 
               (typeof process !== 'undefined' && process.env?.REACT_APP_DEV_MODE === 'true');

function App() {
  const { t } = useTranslation();
  // DEV 모드에서는 항상 PRO로 시작
  const [plan, setPlan] = useState<Plan>(IS_DEV ? Plan.PRO : Plan.FREE);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [englishHelperMode, setEnglishHelperMode] = useState<EnglishHelperMode>(EnglishHelperMode.OFF);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templateResults, setTemplateResults] = useState<TemplateResult[]>([]);
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const handleSubmit = async (request: {
    text: string;
    tonePresetId: string;
    purposeTypeId: string;
    audienceLevelId: string;
    relationshipId?: string;
    length: LengthOption;
    format: FormatOption;
    strength: Strength;
    resultOptions?: any;
    language?: string;
    englishHelperMode?: EnglishHelperMode;
  }) => {
    // ✅ 템플릿 일괄 생성 모드
    if (selectedTemplates.length > 0) {
      setIsGeneratingTemplates(true);
      setError(null);
      setTemplateResults([]);
      setGenerationProgress(0);
      
      // englishHelperMode를 request에서 받아서 state에 저장 (최신 값 보장)
      if (request.englishHelperMode !== undefined) {
        setEnglishHelperMode(request.englishHelperMode);
      }

      try {
        // DEV 모드에서는 항상 PRO로 요청
        const effectivePlan = IS_DEV ? Plan.PRO : plan;
        const rewriteRequest = {
          ...request,
          plan: effectivePlan,
          englishHelperMode: request.englishHelperMode || EnglishHelperMode.OFF,
          selectedTemplates // ✅ 템플릿 ID 배열 포함
        };
        
        // 진행률 업데이트를 위한 시뮬레이션
        const progressInterval = setInterval(() => {
          setGenerationProgress(prev => Math.min(prev + 2, 90));
        }, 100);
        
        const response = await api.rewrite(rewriteRequest);
        
        clearInterval(progressInterval);
        setGenerationProgress(100);
        
        if (response.templateResults) {
          setTemplateResults(response.templateResults);
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.reason || err.message || t('error.rewriteFailed');
        setError(errorMessage);
        alert(errorMessage || '템플릿 생성에 실패했습니다');
      } finally {
        setIsGeneratingTemplates(false);
        setGenerationProgress(0);
      }
      return;
    }
    
    // 기존 단일 생성 모드
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    // englishHelperMode를 request에서 받아서 state에 저장 (최신 값 보장)
    if (request.englishHelperMode !== undefined) {
      setEnglishHelperMode(request.englishHelperMode);
    }

    try {
      // DEV 모드에서는 항상 PRO로 요청
      const effectivePlan = IS_DEV ? Plan.PRO : plan;
      const rewriteRequest = {
        ...request,
        plan: effectivePlan,
        // ✅ englishHelperMode를 payload에 반드시 포함
        englishHelperMode: request.englishHelperMode || EnglishHelperMode.OFF
      };
      const response = await api.rewrite(rewriteRequest);
      setResult(response);
    } catch (err: any) {
      // 400 에러 처리 (text가 비어있는 경우)
      const errorMessage = err.response?.data?.reason || err.message || t('error.rewriteFailed');
      setError(errorMessage);
      
      // 토스트 메시지 표시 (간단한 alert로 구현)
      if (err.response?.status === 400) {
        alert(errorMessage || '문장을 입력해 주세요');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTemplateRetry = async (templateId: string) => {
    // 재시도 로직 (필요시 구현)
    console.log('Retry template:', templateId);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(t('error.copySuccess'));
    }).catch(() => {
      alert(t('error.copyFailed'));
    });
  };

  const handleSave = (text: string) => {
    // 즐겨찾기 저장 로직 (로컬 스토리지 또는 API)
    const saved = JSON.parse(localStorage.getItem('savedTexts') || '[]');
    saved.push({ text, timestamp: new Date().toISOString() });
    localStorage.setItem('savedTexts', JSON.stringify(saved));
    alert(t('error.saveSuccess'));
  };

  // Upgrade 버튼을 토글로 변경 (DEV 모드에서만 동작)
  const handleUpgrade = () => {
    if (IS_DEV) {
      // DEV 모드: FREE ↔ PRO 토글
      setPlan(plan === Plan.FREE ? Plan.PRO : Plan.FREE);
    } else {
      // 프로덕션: 업그레이드 페이지로 이동 또는 모달 표시
      alert(t('common.upgrade'));
    }
  };

  // 초기화면으로 이동 (결과 초기화)
  const handleReset = () => {
    setResult(null);
    setTemplateResults([]);
    setSelectedTemplates([]);
    setError(null);
    setIsLoading(false);
    setIsGeneratingTemplates(false);
    setGenerationProgress(0);
    // 스크롤을 맨 위로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // DEV 모드에서는 항상 PRO로 표시
  const effectivePlan = IS_DEV ? Plan.PRO : plan;

  return (
    <div className="App">
      <LanguageSelector />
      <header className="App-header">
        <h1 className="app-title" onClick={handleReset} style={{ cursor: 'pointer' }}>
          {t('common.appName')}
        </h1>
        <p className="subtitle" onClick={handleReset} style={{ cursor: 'pointer' }}>
          {t('common.subtitle')}
        </p>
        {IS_DEV && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            [DEV 모드: 모든 기능 활성화]
          </p>
        )}
      </header>

      <main className="App-main">
        <PlanBadge plan={effectivePlan} onUpgrade={handleUpgrade} isDev={IS_DEV} />

        <RewriteForm
          plan={effectivePlan}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {result && result.safety.blocked && (
          <SafetyWarning safety={result.safety} />
        )}

        {result && !result.safety.blocked && result.variants.length > 0 && (
          <RewriteResultComponent
            variants={result.variants}
            plan={effectivePlan}
            onCopy={handleCopy}
            onSave={handleSave}
            isDev={IS_DEV}
            englishHelperMode={englishHelperMode}
          />
        )}

        {result && !result.safety.blocked && result.variants.length === 0 && (
          <div className="no-results">
            {t('error.noResults')}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
