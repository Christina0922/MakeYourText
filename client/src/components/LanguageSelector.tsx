import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-selector">
      <button
        className={`lang-btn ${i18n.language === 'ko' ? 'active' : ''}`}
        onClick={() => changeLanguage('ko')}
      >
        한국어
      </button>
      <button
        className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
        onClick={() => changeLanguage('en')}
      >
        English
      </button>
      <button
        className={`lang-btn ${i18n.language === 'ja' ? 'active' : ''}`}
        onClick={() => changeLanguage('ja')}
      >
        日本語
      </button>
    </div>
  );
};

export default LanguageSelector;

