import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafetyCheck } from '../types';
import './SafetyWarning.css';

interface SafetyWarningProps {
  safety: SafetyCheck;
}

const SafetyWarning: React.FC<SafetyWarningProps> = ({ safety }) => {
  const { t } = useTranslation();
  
  if (!safety.blocked) {
    return null;
  }

  return (
    <div className="safety-warning">
      <div className="warning-icon">⚠️</div>
      <div className="warning-content">
        <div className="warning-title">{t('safety.warning')}</div>
        <div className="warning-message">{safety.reason}</div>
        {safety.suggestedAlternative && (
          <div className="warning-suggestion">
            {t('safety.suggestion')}: {safety.suggestedAlternative}
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyWarning;

