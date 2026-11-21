import {
  BookOpen,
  Briefcase,
  Coffee,
  Globe,
  Moon,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  setStoredLocale,
  SUPPORTED_LOCALES,
  type LocaleCode,
} from '../i18n';
import { applyTheme, getInitialTheme, type ThemeMode } from '../lib/theme';
import { useLocale } from '../lib/useLocale';
import { SupportModal } from './SupportModal';

interface NavbarProps {
  currentPath?: string;
}

function BrandLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#167D8D" />
      <path
        d="M8 19V13M12 22V10M16 24V8M20 20V12M24 18V14"
        stroke="#B9E4E8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M12 1.27a11 11 0 00-3.48 21.46c.55.1.73-.24.73-.53v-1.85c-3.03.66-3.67-1.45-3.67-1.45-.5-1.26-1.21-1.6-1.21-1.6-.99-.67.07-.66.07-.66 1.1.08 1.67 1.13 1.67 1.13.97 1.66 2.54 1.18 3.16.9.1-.7.38-1.18.69-1.45-2.42-.27-4.96-1.21-4.96-5.4 0-1.19.42-2.17 1.12-2.93-.11-.28-.49-1.39.11-2.89 0 0 .92-.29 3 1.12a10.4 10.4 0 015.46 0c2.08-1.41 3-1.12 3-1.12.6 1.5.22 2.61.11 2.89.7.76 1.12 1.74 1.12 2.93 0 4.2-2.55 5.12-4.98 5.39.39.34.74 1.01.74 2.04v3.02c0 .29.18.64.74.53A11 11 0 0012 1.27z" />
    </svg>
  );
}

export function Navbar({ currentPath = '/' }: NavbarProps) {
  const { locale, t } = useLocale();
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    setTheme(getInitialTheme());

    const handleOpenSupport = () => setSupportOpen(true);
    window.addEventListener('audio-joiner:open-support', handleOpenSupport);
    return () => {
      window.removeEventListener('audio-joiner:open-support', handleOpenSupport);
    };
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const handleLocaleChange = (nextLocale: LocaleCode) => {
    setStoredLocale(nextLocale);
  };

  const isHome = currentPath === '/';
  const isHowTo = currentPath.startsWith('/how-to-use');
  const isHire = currentPath.startsWith('/hire-me');

  const themeAria =
    theme === 'light' ? t.nav.themeToDarkAria : t.nav.themeToLightAria;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#071B2B]/10 bg-[#EEEEEE]/90 backdrop-blur-md dark:border-[#B9E4E8]/12 dark:bg-[#071B2B]/90">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-6xl items-center justify-between px-2 py-2 sm:px-6 lg:py-3"
        >
          {/* DESKTOP NAVBAR (>= lg) */}
          <div className="hidden w-full items-center justify-between gap-4 lg:flex">
            <div className="flex items-center gap-6">
              <a
                href="/"
                aria-label={t.nav.homeAria}
                className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-lg font-extrabold tracking-tight text-[#071B2B] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[#167D8D] dark:text-[#EEEEEE]"
              >
                <BrandLogo />
                <span>{t.nav.brand}</span>
              </a>

              <div className="flex items-center gap-1">
                <a
                  href="/how-to-use"
                  aria-current={isHowTo ? 'page' : undefined}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                    isHowTo
                      ? 'bg-[#167D8D]/15 text-[#167D8D] dark:bg-[#167D8D]/25 dark:text-[#B9E4E8]'
                      : 'text-[#071B2B]/80 hover:bg-[#071B2B]/6 hover:text-[#071B2B] dark:text-[#EEEEEE]/85 dark:hover:bg-[#B9E4E8]/10 dark:hover:text-[#EEEEEE]'
                  }`}
                >
                  {t.nav.howToUse}
                </a>
                <a
                  href="/hire-me"
                  aria-current={isHire ? 'page' : undefined}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                    isHire
                      ? 'bg-[#167D8D]/15 text-[#167D8D] dark:bg-[#167D8D]/25 dark:text-[#B9E4E8]'
                      : 'text-[#071B2B]/80 hover:bg-[#071B2B]/6 hover:text-[#071B2B] dark:text-[#EEEEEE]/85 dark:hover:bg-[#B9E4E8]/10 dark:hover:text-[#EEEEEE]'
                  }`}
                >
                  {t.nav.hireMe}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#167D8D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#126977] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D]"
              >
                <Coffee className="h-4 w-4 text-[#B9E4E8]" aria-hidden="true" />
                <span>{t.nav.support}</span>
              </button>

              <a
                href="https://github.com/Kishara007/audio-joiner"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.nav.githubAria}
                title={t.nav.githubAria}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#071B2B]/12 bg-white text-[#071B2B] transition hover:border-[#167D8D] hover:text-[#167D8D] focus-visible:outline-2 focus-visible:outline-[#167D8D] dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#EEEEEE] dark:hover:border-[#B9E4E8]"
              >
                <GithubIcon />
              </a>

              <div className="relative flex items-center">
                <Globe
                  className="pointer-events-none absolute left-3 h-4 w-4 text-[#167D8D] dark:text-[#B9E4E8]"
                  aria-hidden="true"
                />
                <select
                  value={locale}
                  onChange={(e) => handleLocaleChange(e.target.value as LocaleCode)}
                  aria-label={t.nav.languageAria}
                  className="h-10 cursor-pointer appearance-none rounded-xl border border-[#071B2B]/12 bg-white pl-9 pr-7 text-sm font-medium text-[#071B2B] transition hover:border-[#167D8D] focus-visible:outline-2 focus-visible:outline-[#167D8D] dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#EEEEEE]"
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.label}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-2.5 text-[10px] text-[#071B2B]/60 dark:text-[#EEEEEE]/60"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeAria}
                title={themeAria}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#071B2B]/12 bg-white text-[#071B2B] transition hover:border-[#167D8D] hover:text-[#167D8D] focus-visible:outline-2 focus-visible:outline-[#167D8D] dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#B9E4E8] dark:hover:border-[#B9E4E8]"
              >
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* MOBILE & TABLET ICONS-ONLY NAVBAR (< lg) — 44x44px touch targets */}
          <div className="flex w-full items-center justify-between lg:hidden">
            <a
              href="/"
              aria-label={t.nav.homeAria}
              aria-current={isHome ? 'page' : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                isHome
                  ? 'ring-2 ring-[#167D8D]/40 dark:ring-[#B9E4E8]/40'
                  : 'hover:bg-[#071B2B]/8 dark:hover:bg-[#B9E4E8]/10'
              }`}
            >
              <BrandLogo />
            </a>

            <div className="flex items-center gap-0.5 sm:gap-2">
              <a
                href="/how-to-use"
                aria-label={t.nav.howToUse}
                aria-current={isHowTo ? 'page' : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                  isHowTo
                    ? 'bg-[#167D8D]/15 text-[#167D8D] dark:bg-[#167D8D]/30 dark:text-[#B9E4E8]'
                    : 'text-[#071B2B] hover:bg-[#071B2B]/8 dark:text-[#EEEEEE] dark:hover:bg-[#B9E4E8]/10'
                }`}
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </a>

              <a
                href="/hire-me"
                aria-label={t.nav.hireMe}
                aria-current={isHire ? 'page' : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                  isHire
                    ? 'bg-[#167D8D]/15 text-[#167D8D] dark:bg-[#167D8D]/30 dark:text-[#B9E4E8]'
                    : 'text-[#071B2B] hover:bg-[#071B2B]/8 dark:text-[#EEEEEE] dark:hover:bg-[#B9E4E8]/10'
                }`}
              >
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                aria-label={t.nav.support}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#167D8D] text-[#B9E4E8] shadow-sm transition hover:bg-[#126977] focus-visible:outline-2 focus-visible:outline-[#167D8D]"
              >
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </button>

              <a
                href="https://github.com/Kishara007/audio-joiner"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.nav.githubAria}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#071B2B] transition hover:bg-[#071B2B]/8 dark:text-[#EEEEEE] dark:hover:bg-[#B9E4E8]/10"
              >
                <GithubIcon />
              </a>

              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[#071B2B] transition hover:bg-[#071B2B]/8 dark:text-[#EEEEEE] dark:hover:bg-[#B9E4E8]/10">
                <Globe className="h-5 w-5 text-[#167D8D] dark:text-[#B9E4E8]" aria-hidden="true" />
                <select
                  value={locale}
                  onChange={(e) => handleLocaleChange(e.target.value as LocaleCode)}
                  aria-label={t.nav.languageAria}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeAria}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#071B2B] transition hover:bg-[#071B2B]/8 dark:text-[#B9E4E8] dark:hover:bg-[#B9E4E8]/10"
              >
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </nav>
      </header>

      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
