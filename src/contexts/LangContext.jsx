import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from '../i18n/translations';

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('ro_refine_lang');
      if (saved) return saved;
      // First visit: auto-detect from browser language (th → Thai, others → English)
      return (navigator.language || 'th').toLowerCase().startsWith('th') ? 'th' : 'en';
    } catch { return 'th'; }
  });

  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('ro_refine_lang', l); } catch { /* ignore */ }
  };

  // Sync document title + SEO meta tags with the selected language
  // (crawlers without JS still see the static Thai defaults in index.html)
  useEffect(() => {
    const tr = TRANSLATIONS[lang] || TRANSLATIONS.th;
    document.title = tr.seo_title;
    document.documentElement.lang = lang;
    const setMeta = (selector, content) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', tr.seo_description);
    setMeta('meta[property="og:title"]', tr.seo_title);
    setMeta('meta[property="og:description"]', tr.seo_og_description);
    setMeta('meta[property="og:locale"]', lang === 'en' ? 'en_US' : 'th_TH');
    setMeta('meta[name="twitter:title"]', tr.seo_title);
    setMeta('meta[name="twitter:description"]', tr.seo_og_description);
  }, [lang]);

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
