import { Coffee, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../lib/useLocale';

const SUPPORT_URL = 'https://kisharadilshan.gumroad.com/coffee';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const { t } = useLocale();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIframeLoaded(false);
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 20);

    // Ensure skeleton clears if browser blocks framing silently without firing onLoad.
    const loadFallbackTimer = window.setTimeout(() => {
      setIframeLoaded(true);
    }, 2500);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(loadFallbackTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#071B2B]/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="animate-modal-in relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#167D8D]/30 bg-white text-[#071B2B] shadow-2xl dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#EEEEEE]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#071B2B]/10 bg-[#EEEEEE]/60 px-5 py-4 dark:border-[#B9E4E8]/15 dark:bg-[#051320]/70 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#167D8D] text-[#B9E4E8] shadow-sm">
              <Coffee className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="support-modal-title"
                className="text-base font-bold tracking-tight sm:text-lg"
              >
                {t.supportModal.title}
              </h2>
              <p className="text-xs text-[#455B6E] dark:text-[#A9C2D1] sm:text-sm">
                {t.supportModal.subtitle}
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t.supportModal.closeAria}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#071B2B]/70 transition hover:bg-[#071B2B]/10 hover:text-[#071B2B] focus-visible:outline-2 focus-visible:outline-[#167D8D] dark:text-[#EEEEEE]/80 dark:hover:bg-[#B9E4E8]/15 dark:hover:text-[#EEEEEE]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Embedded Responsive Iframe with Loading Skeleton */}
        <div className="relative h-[340px] w-full bg-[#071B2B]/5 dark:bg-[#051320] sm:h-[420px]">
          {!iframeLoaded && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/95 p-6 dark:bg-[#0C273D]/95"
              aria-live="polite"
            >
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-[#167D8D]/20 dark:bg-[#B9E4E8]/15" />
              <div className="w-full max-w-xs space-y-2.5">
                <div className="h-3.5 w-3/4 mx-auto animate-pulse rounded-full bg-[#071B2B]/10 dark:bg-[#B9E4E8]/15" />
                <div className="h-3 w-1/2 mx-auto animate-pulse rounded-full bg-[#071B2B]/10 dark:bg-[#B9E4E8]/10" />
              </div>
              <p className="text-xs font-medium text-[#455B6E] dark:text-[#B9E4E8]/80">
                {t.supportModal.loadingText}
              </p>
            </div>
          )}

          <iframe
            src={SUPPORT_URL}
            title={t.supportModal.title}
            onLoad={() => setIframeLoaded(true)}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        {/* Clean In-Modal Fallback Card (for browsers blocking third-party X-Frame-Options) */}
        <div className="flex flex-col gap-3 border-t border-[#071B2B]/10 bg-[#EEEEEE]/80 px-5 py-4 dark:border-[#B9E4E8]/15 dark:bg-[#071B2B] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#071B2B] dark:text-[#EEEEEE]">
              {t.supportModal.fallbackTitle}
            </p>
            <p className="text-xs text-[#455B6E] dark:text-[#A9C2D1]">
              {t.supportModal.fallbackBody}
            </p>
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#167D8D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#126977] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D]"
          >
            <span>{t.supportModal.fallbackButton}</span>
            <ExternalLink className="h-4 w-4 text-[#B9E4E8]" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
