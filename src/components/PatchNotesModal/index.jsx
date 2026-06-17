import React, { useEffect, useState } from 'react';
import { CHANGELOG, LATEST_CHANGELOG_VERSION } from '../../constants/changelog';
import { useLang } from '../../contexts/LangContext';

const STORAGE_KEY = 'ro_refine_patchnotes';
const SUPPRESS_DAYS = 7;
const SUPPRESS_MS = SUPPRESS_DAYS * 24 * 60 * 60 * 1000;

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (iso, lang) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (lang === 'en') return `${d} ${EN_MONTHS[m - 1]} ${y}`;
  return `${d} ${TH_MONTHS[m - 1]} ${y}`;
};

const hasValidSuppression = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Date.now() < data.until && data.version === LATEST_CHANGELOG_VERSION;
  } catch {
    return false;
  }
};

const CHANGE_TYPE_STYLE = {
  feature: 'bg-emerald-500/15 text-success border-emerald-500/30',
  fix: 'bg-rose-500/15 text-danger border-rose-500/30',
  improve: 'bg-sky-500/15 text-info border-sky-500/30',
};

const PatchNotesModal = ({ openTrigger = 0 }) => {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const { lang, t } = useLang();

  useEffect(() => {
    if (!hasValidSuppression()) {
      setAcknowledged(false);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (openTrigger > 0) {
      setAcknowledged(hasValidSuppression());
      setOpen(true);
    }
  }, [openTrigger]);

  const dismiss = () => {
    if (!acknowledged) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ until: Date.now() + SUPPRESS_MS, version: LATEST_CHANGELOG_VERSION })
        );
      } catch { /* ignore */ }
    }
    setOpen(false);
  };

  if (!open) return null;

  const getTypeLabel = (type) => {
    if (type === 'feature') return t('change_type_feature');
    if (type === 'fix') return t('change_type_fix');
    return t('change_type_improve');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line-soft/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-line-soft/60 bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-transparent px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-warn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-warn">{t('patch_title')}</h2>
            <p className="text-xs text-dim">
              {t('patch_subtitle')} {LATEST_CHANGELOG_VERSION ? `v${LATEST_CHANGELOG_VERSION}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('close_btn')}
            className="rounded-lg p-1.5 text-dim transition-colors hover:bg-line-soft/50 hover:text-body"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {CHANGELOG.map((release, ri) => (
            <div key={ri} className="relative pl-4">
              <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
              {ri < CHANGELOG.length - 1 && (
                <span className="absolute left-[3px] top-3.5 h-[calc(100%+0.75rem)] w-px bg-line-soft/60" />
              )}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-body">{formatDate(release.date, lang)}</span>
                {release.version ? (
                  <span className="rounded-md border border-line/60 bg-line-soft/30 px-1.5 py-0.5 text-[0.65rem] font-bold text-body">
                    v{release.version}
                  </span>
                ) : (
                  <span className="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/15 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-brand2">
                    Beta
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {release.items.map((it, ii) => (
                  <li key={ii} className="flex gap-2 text-sm leading-relaxed text-body">
                    <span className={`mt-0.5 h-fit shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-bold ${CHANGE_TYPE_STYLE[it.type] || CHANGE_TYPE_STYLE.improve}`}>
                      {getTypeLabel(it.type)}
                    </span>
                    <span>{(lang === 'en' && it.textEn) ? it.textEn : it.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft/60 px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-lg border border-amber-400/40 bg-amber-400/10 py-2.5 text-sm font-semibold text-warn transition-colors hover:bg-amber-400 hover:text-slate-900"
          >
            {acknowledged ? t('patch_close') : t('patch_acknowledge')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatchNotesModal;
