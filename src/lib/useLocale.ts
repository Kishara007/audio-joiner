import { useEffect, useState } from 'react';
import {
  applyDomTranslations,
  DEFAULT_LOCALE,
  getDictionary,
  getStoredLocale,
  LOCALE_CHANGE_EVENT,
  type LocaleCode,
  type TranslationDictionary,
} from '../i18n';

export function useLocale(): { locale: LocaleCode; t: TranslationDictionary } {
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    const initial = getStoredLocale();
    if (initial !== DEFAULT_LOCALE) {
      setLocale(initial);
      applyDomTranslations(initial);
    }

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<LocaleCode>;
      if (customEvent.detail) {
        setLocale(customEvent.detail);
      }
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleChange);
  }, []);

  return { locale, t: getDictionary(locale) };
}
