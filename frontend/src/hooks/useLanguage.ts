// src/hooks/useLanguage.ts
import { useState, useEffect } from 'react';
import { LanguageKey } from '../utils/languages';

export const useLanguage = () => {
  const [language, setLanguage] = useState<LanguageKey>(() => {
    return (localStorage.getItem('language') as LanguageKey) || 'pt-BR';
  });

  const changeLanguage = (newLanguage: LanguageKey) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    window.dispatchEvent(new Event('languageChanged'));
  };

  return { language, changeLanguage };
};