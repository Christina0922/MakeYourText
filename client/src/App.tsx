import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan, RewriteResult, Strength, LengthOption, FormatOption } from './types';
import { api } from './services/api';
import RewriteForm from './components/RewriteForm';
import RewriteResultComponent from './components/RewriteResult';
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
  }) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // DEV 모드에서는 항상 PRO로 요청
      const effectivePlan = IS_DEV ? Plan.PRO : plan;
      const rewriteRequest = {
        ...request,
        plan: effectivePlan
      };
      const response = await api.rewrite(rewriteRequest);
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.reason || err.message || t('error.rewriteFailed'));
    } finally {
      setIsLoading(false);
    }
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

  // DEV 모드에서는 항상 PRO로 표시
  const effectivePlan = IS_DEV ? Plan.PRO : plan;

  return (
    <div className="App">
      <LanguageSelector />
      <header className="App-header">
        <h1>{t('common.appName')}</h1>
        <p className="subtitle">{t('common.subtitle')}</p>
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
