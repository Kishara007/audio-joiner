import { Check, Copy, Mail } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from '../lib/useLocale';

const DEVELOPER_EMAIL = 'kisharadilshan007@gmail.com';

export function HireContactActions() {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(DEVELOPER_EMAIL);
    } catch {
      // Clipboard API may fail in restricted non-secure contexts; email remains visible to copy manually.
    }

    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2400);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`mailto:${DEVELOPER_EMAIL}`}
        className="inline-flex min-h-[48px] items-center gap-2.5 rounded-full bg-[#167D8D] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#126977] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D] sm:text-base"
      >
        <Mail className="h-5 w-5 text-[#B9E4E8]" aria-hidden="true" />
        <span>{t.hire.emailButton}</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex min-h-[48px] items-center gap-2.5 rounded-full border border-[#071B2B]/18 bg-white px-6 py-3 text-sm font-bold text-[#071B2B] shadow-xs transition hover:border-[#167D8D] hover:text-[#167D8D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D] dark:border-[#B9E4E8]/25 dark:bg-[#071B2B] dark:text-[#EEEEEE] dark:hover:border-[#B9E4E8] sm:text-base"
      >
        {copied ? (
          <Check className="h-5 w-5 text-[#167D8D] dark:text-[#B9E4E8]" aria-hidden="true" />
        ) : (
          <Copy className="h-5 w-5 text-[#167D8D] dark:text-[#B9E4E8]" aria-hidden="true" />
        )}
        <span>{copied ? t.hire.copiedButton : t.hire.copyButton}</span>
      </button>

      <span className="font-mono text-xs text-[#455B6E] dark:text-[#B9E4E8]/85 sm:text-sm">
        {DEVELOPER_EMAIL}
      </span>
    </div>
  );
}
