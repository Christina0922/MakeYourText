import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan, RewriteResult, Strength } from './types';
import { api } from './services/api';
import RewriteForm from './components/RewriteForm';
import RewriteResultComponent from './components/RewriteResult';
import SafetyWarning from './components/SafetyWarning';
import PlanBadge from './components/PlanBadge';
import LanguageSelector from './components/LanguageSelector';
import './App.css';

function App() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<Plan>(Plan.FREE);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (request: {
    text: string;
    tonePresetId: string;
    audienceLevelId: string;
    relationshipId?: string;
    purposeTypeId: string;
    strength: Strength;
    resultOptions?: any;
  }) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const rewriteRequest = {
        ...request,
        plan
      };
      const response = await api.rewrite(rewriteRequest);
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.reason || err.message || '리라이트 중 오류가 발생했습니다.');
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

  const handleUpgrade = () => {
    // 업그레이드 페이지로 이동 또는 모달 표시
    alert(t('common.upgrade'));
  };

  return (
    <div className="App">
      <LanguageSelector />
      <header className="App-header">
        <h1>{t('common.appName')}</h1>
        <p className="subtitle">{t('common.subtitle')}</p>
      </header>

      <main className="App-main">
        <PlanBadge plan={plan} onUpgrade={handleUpgrade} />

        <RewriteForm
          plan={plan}
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
            plan={plan}
            onCopy={handleCopy}
            onSave={handleSave}
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

