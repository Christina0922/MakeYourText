import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// @ts-ignore
import ko from './locales/ko.json';
// @ts-ignore
import en from './locales/en.json';
// @ts-ignore
import ja from './locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja }
    },
    fallbackLng: 'ko',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

