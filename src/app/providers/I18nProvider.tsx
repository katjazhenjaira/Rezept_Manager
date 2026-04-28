import { useEffect, type ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import ru from '@/locales/ru.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';

const STORAGE_KEY = 'rm_language';
export type AppLanguage = 'ru' | 'de' | 'en';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    de: { translation: de },
    en: { translation: en },
  },
  lng: (localStorage.getItem(STORAGE_KEY) as AppLanguage) ?? 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export function changeLanguage(lang: AppLanguage) {
  i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (saved && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
