import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
import { setFormatLanguage } from '../utils/format';

const STORAGE_KEY = 'sitesync_lang';
const LanguageContext = createContext(null);

function savedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(savedLanguage);
  // Dates and money read the language from format.js, so keep it in step before children render
  setFormatLanguage(lang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ur' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }, [lang]);

  // t('key', { name: 'Ali' }) → translated text with {name} filled in; falls back to English, then the key
  const t = useCallback(
    (key, vars) => {
      const text = translations[lang][key] ?? translations.en[key] ?? key;
      return vars ? text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString()) : text;
    },
    [lang]
  );

  const toggle = useCallback(() => setLang((l) => (l === 'ur' ? 'en' : 'ur')), []);

  const value = useMemo(() => ({ lang, t, toggle, setLang, isRtl: lang === 'ur' }), [lang, t, toggle]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);
