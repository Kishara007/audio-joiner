import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import ja from './ja.json';
import pt from './pt.json';
import ru from './ru.json';
import zh from './zh.json';

export type LocaleCode = 'en' | 'es' | 'pt' | 'de' | 'fr' | 'ja' | 'zh' | 'ru';

export type TranslationDictionary = typeof en;

export interface LocaleOption {
  code: LocaleCode;
  label: string;
}

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '简体中文' },
  { code: 'ru', label: 'Русский' },
] as const;

export const DICTIONARIES: Record<LocaleCode, TranslationDictionary> = {
  en,
  es,
  pt,
  de,
  fr,
  ja,
  zh,
  ru,
};

export const LOCALE_STORAGE_KEY = 'audio-joiner-locale';
export const LOCALE_CHANGE_EVENT = 'audio-joiner:locale-change';

export function isSupportedLocale(value: string | null | undefined): value is LocaleCode {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(DICTIONARIES, value);
}

export function getDictionary(locale: LocaleCode): TranslationDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}

export function resolveKey(dict: TranslationDictionary, dottedKey: string): string | null {
  const parts = dottedKey.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

export function getStoredLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get('lang');
    if (isSupportedLocale(paramLang)) {
      return paramLang;
    }
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  return DEFAULT_LOCALE;
}

/**
 * Applies translations to static Astro DOM elements marked with [data-i18n] and page meta tags.
 */
export function applyDomTranslations(locale: LocaleCode): void {
  if (typeof document === 'undefined') return;
  const dict = getDictionary(locale);
  document.documentElement.lang = locale;

  const nodes = document.querySelectorAll<HTMLElement>('[data-i18n]');
  for (const node of nodes) {
    const key = node.getAttribute('data-i18n');
    if (!key) continue;
    const translated = resolveKey(dict, key);
    if (translated !== null) {
      node.textContent = translated;
    }
  }

  const ariaNodes = document.querySelectorAll<HTMLElement>('[data-i18n-aria]');
  for (const node of ariaNodes) {
    const key = node.getAttribute('data-i18n-aria');
    if (!key) continue;
    const translated = resolveKey(dict, key);
    if (translated !== null) {
      node.setAttribute('aria-label', translated);
    }
  }

  const pageKey = document.documentElement.getAttribute('data-page-meta');
  if (pageKey === 'home' || pageKey === 'howTo' || pageKey === 'hire') {
    const titleKey = `meta.${pageKey}Title`;
    const descKey = `meta.${pageKey}Description`;
    const title = resolveKey(dict, titleKey);
    const desc = resolveKey(dict, descKey);
    if (title) document.title = title;
    if (desc) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', desc);
    }
  }
}

export function setStoredLocale(locale: LocaleCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage access errors.
  }
  applyDomTranslations(locale);
  window.dispatchEvent(new CustomEvent<LocaleCode>(LOCALE_CHANGE_EVENT, { detail: locale }));
}
