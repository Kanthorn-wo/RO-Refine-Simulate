import React, { createContext, useContext, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('ro_refine_lang') || 'th'; } catch { return 'th'; }
  });

  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('ro_refine_lang', l); } catch { /* ignore */ }
  };

  const t = (key, params) => {
    let val = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['th']?.[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, v);
      });
    }
    return val;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => useContext(LangContext);
