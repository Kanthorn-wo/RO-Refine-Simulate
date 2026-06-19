import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { useLang } from '../../contexts/LangContext';
import { STONE_META, getEffectiveStone } from '../../utils/stones';
import { ORE_IMAGES, ORE_COLORS, ITEM_TYPE_LABELS } from '../../constants/ores';
import { simulateRound, summarize, MAX_ATTEMPTS_PER_ROUND } from '../../utils/simulate';
import { trackEvent } from '../../utils/analytics';
import { recordAction } from '../../utils/usageStats';

// lazy load กราฟ (recharts) — โหลดเฉพาะตอนมีผลจำลองให้แสดง main bundle ไม่บวม
const DistChart = lazy(() => import('./DistChart'));

// สีหลักของแต่ละชนิดหิน (ปุ่มเลือก)
const STONE_BTN_ACTIVE = {
  normal: 'border-sky-400 bg-sky-500/20 text-info',
  enriched: 'border-amber-400 bg-amber-400/20 text-warn',
  hd: 'border-orange-400 bg-orange-500/20 text-warn',
};

const ROUND_PRESETS = [100, 300, 500, 1000];
const CHUNK_SIZE = 50;
const COOLDOWN_SEC = 3; // กันกดรัว ๆ — ต้องรอ 3 วิ จึงกดจำลองใหม่ได้
const MIN_RUN_MS = 500; // เวลาขั้นต่ำให้ loading โชว์ก่อนผลลัพธ์ (กันผลโผล่มาทันทีจนเหมือนกระพริบ)

// metric สรุปต่อรอบ — ใช้ทั้งการ์ดสรุปและปุ่มสลับกราฟ (bg=sunken token ปรับตามธีม, ขอบ+ข้อความสีระบุชนิด)
const METRIC_CARDS = [
  { key: 'attempts', label: 'sim_avg_attempts', unit: 'sim_unit_times', accent: 'border-line-soft bg-sunken text-amber-500' },
  { key: 'successes', label: 'sim_avg_success', unit: 'sim_unit_times', accent: 'border-emerald-500/30 bg-sunken text-emerald-500' },
  { key: 'fails', label: 'sim_avg_fail', unit: 'sim_unit_times', accent: 'border-rose-500/30 bg-sunken text-rose-500' },
  { key: 'itemsLost', label: 'sim_avg_lost', unit: 'sim_unit_items', accent: 'border-rose-500/30 bg-sunken text-rose-400' },
  { key: 'oresTotal', label: 'sim_avg_stone', unit: 'sim_unit_pcs', accent: 'border-sky-500/30 bg-sunken text-sky-500' },
  { key: 'bsbUsed', label: 'sim_avg_bsb', unit: 'sim_unit_pcs', accent: 'border-amber-500/30 bg-sunken text-amber-500' },
];

// metric ที่ให้สลับดูบนกราฟ (ติด/ล้ม derive จากตีอยู่แล้ว เลยไม่ใส่)
const CHART_METRIC_KEYS = ['attempts', 'oresTotal', 'bsbUsed', 'itemsLost'];


const StatChip = ({ label, value }) => (
  <div className="rounded-lg border border-line-soft bg-sunken px-3 py-2 text-center">
    <div className="text-[0.65rem] text-faint">{label}</div>
    <div className="text-sm font-bold text-body">{value}</div>
  </div>
);

// การ์ดสรุป 1 metric: ค่าเฉลี่ยตัวใหญ่ + Min/Max แถวเล็กในการ์ดเดียว (ไม่แยก 3 แถวซ้ำซ้อน)
const AvgCard = ({ label, value, unit, minValue, maxValue, accent }) => (
  <div className={`rounded-xl border px-2 py-3 text-center ${accent}`}>
    <div className="text-xs font-semibold text-dim">{label}</div>
    <div className="text-xl font-bold">{value}</div>
    <div className="text-[0.65rem] text-faint">{unit}</div>
    <div className="mt-1.5 flex items-center justify-center gap-1 border-t border-line-soft pt-1.5 text-[0.65rem] leading-none">
      <span className="text-faint">Min</span>
      <b className="text-body">{minValue}</b>
      <span className="text-faint">·</span>
      <span className="text-faint">Max</span>
      <b className="text-body">{maxValue}</b>
    </div>
  </div>
);

const SimulatorPanel = ({ itemType, isEventRate, bsbTable, apiItem }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [startLevel, setStartLevel] = useState(10);
  const [targetLevel, setTargetLevel] = useState(12);
  const [stone, setStone] = useState('normal');
  const [useBSB, setUseBSB] = useState(false);
  const [rounds, setRounds] = useState(100);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [chartMetric, setChartMetric] = useState('attempts');
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0); // วินาทีที่เหลือ (ทศนิยม) ก่อนกดจำลองใหม่ได้
  const cooldownEndRef = useRef(0);

  // นับถอยหลัง cooldown อิงเวลาจริง (cooldownEndRef = timestamp สิ้นสุด)
  // - เปิดแผง: rAF อัปเดตทุกเฟรมให้เลขวิ่งลื่น
  // - พับแผง: setTimeout ครั้งเดียวรอจนหมดเวลา ไม่ re-render ทุกเฟรมตอนมองไม่เห็น
  useEffect(() => {
    if (!cooldownActive) return;
    const finish = () => { setCooldownLeft(0); setCooldownActive(false); };
    if (!open) {
      const remaining = Math.max(0, cooldownEndRef.current - Date.now());
      const id = setTimeout(finish, remaining);
      return () => clearTimeout(id);
    }
    let raf;
    const tick = () => {
      const left = (cooldownEndRef.current - Date.now()) / 1000;
      if (left <= 0) { finish(); return; }
      setCooldownLeft(left);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cooldownActive, open]);

  const clampedRounds = Math.max(10, Math.min(1000, rounds || 0));

  // ระดับ (stack.length) ที่ simulation จะตีจริง: startLevel .. targetLevel-1
  const levelsInRange = [];
  for (let lv = startLevel; lv < targetLevel; lv++) levelsInRange.push(lv);
  const stoneUsableCount = (s) => levelsInRange.filter((lv) => getEffectiveStone(s, itemType, lv) === s).length;
  const stonePartial = stoneUsableCount(stone) < levelsInRange.length && stoneUsableCount(stone) > 0;
  const bsbRelevant = levelsInRange.some((lv) => lv >= 7 && lv <= 14 && (bsbTable[lv] || 0) > 0);

  const handleStartChange = (v) => {
    setStartLevel(v);
    if (targetLevel <= v) setTargetLevel(v + 1);
    setResults(null);
  };

  const runSimulation = () => {
    if (running || cooldownActive) return;
    const startedAt = Date.now();
    recordAction('simulate');
    trackEvent('sim_run', {
      item_type: itemType,
      start: startLevel,
      target: targetLevel,
      stone,
      rounds: clampedRounds,
      bsb: useBSB && bsbRelevant ? 1 : 0,
      event_rate: isEventRate ? 1 : 0,
    });
    setRunning(true);
    setProgress(0);
    setResults(null);
    const cfg = { itemType, startLevel, targetLevel, stone, useBSB: useBSB && bsbRelevant, isEventRate, bsbTable };
    const all = [];
    const step = () => {
      const todo = Math.min(CHUNK_SIZE, clampedRounds - all.length);
      for (let i = 0; i < todo; i++) all.push(simulateRound(cfg));
      setProgress(all.length);
      if (all.length < clampedRounds) {
        setTimeout(step, 0);
      } else {
        const attempts = all.map((r) => r.attempts);
        const oreAvg = {};
        all.forEach((r) => Object.entries(r.ores).forEach(([k, v]) => { oreAvg[k] = (oreAvg[k] || 0) + v; }));
        Object.keys(oreAvg).forEach((k) => { oreAvg[k] = oreAvg[k] / all.length; });
        // avg/min/max ของแต่ละ metric ต่อรอบ
        const metric = (sel) => {
          const vals = all.map(sel);
          return {
            avg: vals.reduce((a, b) => a + b, 0) / vals.length,
            min: Math.min(...vals),
            max: Math.max(...vals),
          };
        };
        const finalize = () => {
          setResults({
            runs: all,
            // เก็บ config ที่ใช้รันจริง — กัน state ปัจจุบันถูกเปลี่ยนหลังรันแล้วข้อความ/ป้ายเพี้ยน
            cfgUsed: { startLevel, targetLevel, isEventRate },
            stats: summarize(attempts),
            attempts,
            metrics: {
              attempts: metric((r) => r.attempts),
              successes: metric((r) => r.successes),
              fails: metric((r) => r.fails),
              itemsLost: metric((r) => r.itemsLost),
              oresTotal: metric((r) => r.oresTotal),
              bsbUsed: metric((r) => r.bsbUsed),
            },
            oreAvg,
            hasAborted: all.some((r) => r.aborted),
          });
          setRunning(false);
          cooldownEndRef.current = Date.now() + COOLDOWN_SEC * 1000;
          setCooldownLeft(COOLDOWN_SEC);
          setCooldownActive(true);
        };
        // โชว์ loading อย่างน้อย MIN_RUN_MS กันผลโผล่มาทันทีจนเหมือนกระพริบ
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_RUN_MS) setTimeout(finalize, MIN_RUN_MS - elapsed);
        else finalize();
      }
    };
    setTimeout(step, 0);
  };

  const fmt = (n, d = 1) => Number(n.toFixed(d)).toLocaleString();

  return (
    <div className="brand-border overflow-hidden rounded-2xl">
      {/* Header — กดเพื่อ slide เปิด/ปิด */}
      <button
        type="button"
        onClick={() => setOpen((o) => {
          if (!o) trackEvent('sim_open');
          return !o;
        })}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-accent-surface"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-accent" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="9" width="3" height="6" rx="0.5" /><rect x="6.5" y="5" width="3" height="10" rx="0.5" /><rect x="12" y="1" width="3" height="14" rx="0.5" />
          </svg>
          <span className="text-sm font-bold text-accent-fg">{t('sim_toggle')}</span>
          <span className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/15 px-2 py-0.5 text-[0.6rem] font-bold tracking-wider text-fuchsia-500">BETA</span>
        </span>
        <svg className={`h-4 w-4 text-accent transition-transform duration-300 ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* เนื้อหา slide (grid-rows trick) */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4">
            <p className="text-[0.7rem] leading-relaxed text-faint">
              {t('sim_beta_remark')} — {t('sim_desc')}
            </p>

            {/* (A) สรุปสิ่งที่จะจำลอง — read-only context อิงค่าจากหน้าหลัก */}
            <div className="rounded-xl border border-line-soft bg-sunken/40 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t('sim_section_context')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-surface px-2.5 py-1.5 text-xs font-bold text-accent-fg">
                  <img
                    src={apiItem ? apiItem.imageUrl : (itemType.startsWith('weapon') ? '/images/default_weapon.png' : '/images/default_armor.png')}
                    alt=""
                    className="h-5 w-5 flex-none object-contain"
                    onError={(e) => {
                      // รูปจาก API พัง (404) → ใช้รูป default ตามประเภท (กัน loop ด้วย flag)
                      if (e.currentTarget.dataset.fb) return;
                      e.currentTarget.dataset.fb = '1';
                      e.currentTarget.src = itemType.startsWith('weapon') ? '/images/default_weapon.png' : '/images/default_armor.png';
                    }}
                  />
                  <span className="flex flex-col leading-tight">
                    {apiItem && <span className="max-w-[180px] truncate">{apiItem.name}</span>}
                    <span className={apiItem ? 'text-[0.6rem] font-normal text-accent/70' : ''}>{ITEM_TYPE_LABELS[itemType]}</span>
                  </span>
                </span>
                <span className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-[0.7rem] font-bold ${
                  isEventRate
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-500'
                    : 'border-line bg-line-soft/50 text-dim'
                }`}>
                  {isEventRate ? t('event_rate_up') : t('no_event')}
                </span>
              </div>
              <p className="mt-1.5 text-[0.62rem] text-faint">{t('sim_rate_hint')}</p>
            </div>

            {/* (B) ตั้งค่า — ค่าที่ปรับได้ จัดเป็น label คอลัมน์ซ้าย + control ขวา */}
            <div className="rounded-xl border border-line-soft bg-sunken/40 p-3">
              <div className="mb-3 flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t('sim_section_settings')}
              </div>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
                {/* ช่วงตีบวก */}
                <span className="text-xs font-semibold text-dim">{t('sim_range_label')}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={startLevel}
                    onChange={(e) => handleStartChange(Number(e.target.value))}
                    disabled={running}
                    aria-label={t('sim_from')}
                    className="rounded-lg border border-line bg-sunken px-2 py-1.5 text-sm font-bold text-body"
                  >
                    {Array.from({ length: 20 }, (_, i) => <option key={i} value={i}>+{i}</option>)}
                  </select>
                  <svg className="h-3.5 w-3.5 flex-none text-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <select
                    value={targetLevel}
                    onChange={(e) => { setTargetLevel(Number(e.target.value)); setResults(null); }}
                    disabled={running}
                    aria-label={t('sim_to')}
                    className="rounded-lg border border-line bg-sunken px-2 py-1.5 text-sm font-bold text-body"
                  >
                    {Array.from({ length: 20 - startLevel }, (_, i) => startLevel + 1 + i).map((v) => (
                      <option key={v} value={v}>+{v}</option>
                    ))}
                  </select>
                </div>

                {/* หิน */}
                <span className="text-xs font-semibold text-dim">{t('sim_stone_label')}</span>
                <div className="flex gap-2">
                  {['normal', 'enriched', 'hd'].map((s) => {
                    const usable = stoneUsableCount(s) > 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!usable || running}
                        onClick={() => { setStone(s); setResults(null); }}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                          stone === s ? STONE_BTN_ACTIVE[s] : 'border-line text-dim hover:border-dim'
                        } ${!usable ? 'cursor-not-allowed opacity-30' : ''}`}
                      >
                        {STONE_META[s].label}
                      </button>
                    );
                  })}
                </div>

                {/* BSB (เฉพาะช่วงที่เกี่ยวข้อง) */}
                {bsbRelevant && (
                  <>
                    <span className="text-xs font-semibold text-dim">BSB</span>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-body">
                      <input
                        type="checkbox"
                        checked={useBSB}
                        onChange={(e) => { setUseBSB(e.target.checked); setResults(null); }}
                        disabled={running}
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <img src="/images/blacksmith_blessing.png" alt="" className="h-4 w-4 object-contain" />
                      {t('sim_use_bsb')}
                    </label>
                  </>
                )}

                {/* จำนวนรอบ */}
                <span className="text-xs font-semibold text-dim sm:pt-1.5">{t('sim_rounds_label')}</span>
                <div className="flex flex-wrap gap-1">
                  {ROUND_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={running}
                      onClick={() => { setRounds(p); setResults(null); }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                        rounds === p ? 'border-accent bg-accent-surface text-accent-fg' : 'border-line text-dim hover:border-dim'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={rounds}
                    disabled={running}
                    onChange={(e) => { setRounds(Number(e.target.value)); setResults(null); }}
                    onBlur={() => setRounds(clampedRounds)}
                    placeholder={t('sim_rounds_custom')}
                    aria-label={t('sim_rounds_label')}
                    className="w-20 rounded-lg border border-line bg-sunken px-2 py-1.5 text-center text-xs font-bold text-body [appearance:textfield] focus:border-accent focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>

            {stonePartial && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.7rem] text-amber-500">
                {t('sim_stone_partial_warn')}
              </p>
            )}

            {/* (C) ปุ่ม CTA หลัก — เต็มความกว้าง เด่นสุด (gradient ทึบ legible ทั้ง 2 ธีม) */}
            <button
              type="button"
              onClick={runSimulation}
              disabled={running || cooldownActive}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-violet-500 bg-violet-600 px-4 py-3 text-sm font-bold tabular-nums text-white shadow-lg shadow-black/30 transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!running && !cooldownActive && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4 3.5v9a.5.5 0 00.77.42l7-4.5a.5.5 0 000-.84l-7-4.5A.5.5 0 004 3.5z" />
                </svg>
              )}
              {running
                ? t('sim_running', { done: progress, total: clampedRounds })
                : cooldownActive
                  ? t('sim_cooldown', { sec: cooldownLeft.toFixed(2) })
                  : t('sim_run')}
            </button>

            {/* Results — slide ลงมา (grid-rows trick) + loading ระหว่างประมวลผล */}
            <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${(running || results) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
            {running && !results && (
              <div className="flex flex-col items-center justify-center gap-3 border-t border-line-soft py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                <div className="text-xs font-semibold text-accent-fg">{t('sim_loading')}</div>
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="bg-brand h-full rounded-full transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.round((progress / clampedRounds) * 100)}%` }}
                  />
                </div>
                <div className="text-[0.65rem] text-faint">{progress}/{clampedRounds}</div>
              </div>
            )}
            {results && (
              <div className="space-y-4 border-t border-line-soft pt-4">
                {results.hasAborted && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.7rem] text-rose-400">
                    {t('sim_aborted_warn', { cap: MAX_ATTEMPTS_PER_ROUND.toLocaleString() })}
                  </p>
                )}

                {/* สรุปต่อรอบ — การ์ดเดียวต่อ metric: เฉลี่ยตัวใหญ่ + Min/Max ในตัว */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-dim">
                    <span>{t('sim_summary')} ({results.runs.length} {t('sim_rounds_unit')})</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-bold ${
                      results.cfgUsed.isEventRate
                        ? 'border-amber-400/50 bg-amber-400/15 text-amber-500'
                        : 'border-line bg-line-soft/50 text-dim'
                    }`}>
                      {results.cfgUsed.isEventRate ? t('event_rate_up') : t('no_event')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {METRIC_CARDS.map((c) => (
                      <AvgCard
                        key={c.key}
                        label={t(c.label)}
                        value={fmt(results.metrics[c.key].avg)}
                        unit={t(c.unit)}
                        minValue={fmt(results.metrics[c.key].min, 0)}
                        maxValue={fmt(results.metrics[c.key].max, 0)}
                        accent={c.accent}
                      />
                    ))}
                  </div>
                </div>

                {/* แร่เฉลี่ยแยกชนิด */}
                {Object.keys(results.oreAvg).length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-dim">{t('sim_ore_avg_title')}</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(results.oreAvg).map(([name, avg]) => (
                        <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-sunken px-2.5 py-1 text-xs text-dim">
                          {ORE_IMAGES[name]
                            ? <img src={ORE_IMAGES[name]} alt="" className="h-4 w-4 object-contain" />
                            : <span className={`h-2 w-2 rounded-full ${ORE_COLORS[name] || 'bg-slate-400'}`} />}
                          {name}
                          <b className="text-body">{fmt(avg)}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* สถิติ + Histogram + CDF — สลับ metric ได้ */}
                {(() => {
                  // โชว์เฉพาะ metric ที่มีค่าจริง (เช่น ไม่เปิด BSB ก็ไม่ต้องมีปุ่ม BSB)
                  const available = CHART_METRIC_KEYS.filter(
                    (k) => k === 'attempts' || results.metrics[k].max > 0
                  );
                  const metricKey = available.includes(chartMetric) ? chartMetric : 'attempts';
                  const card = METRIC_CARDS.find((c) => c.key === metricKey);
                  const chartValues = results.runs.map((r) => r[metricKey]);
                  const chartStats = summarize(chartValues);
                  return (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-dim">{t('sim_dist_title')}</span>
                        <div className="flex gap-1">
                          {available.map((k) => {
                            const c = METRIC_CARDS.find((m) => m.key === k);
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setChartMetric(k)}
                                className={`rounded-lg border px-2 py-1 text-[0.68rem] font-bold transition-colors ${
                                  metricKey === k ? 'border-accent bg-accent-surface text-accent-fg' : 'border-line text-dim hover:border-dim'
                                }`}
                              >
                                {t(c.label)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        <StatChip label={t('sim_stat_mean')} value={fmt(chartStats.mean)} />
                        <StatChip label={t('sim_stat_sd')} value={fmt(chartStats.sd)} />
                        <StatChip label={t('sim_stat_median')} value={fmt(chartStats.median, 0)} />
                        <StatChip label="P90" value={fmt(chartStats.p90, 0)} />
                        <StatChip label={t('sim_stat_minmax')} value={`${chartStats.min}–${chartStats.max}`} />
                      </div>
                      <div className="rounded-xl border border-line-soft bg-sunken p-2">
                        <Suspense fallback={<div className="flex h-[230px] items-center justify-center text-xs text-faint">{t('loading_text')}</div>}>
                          <DistChart values={chartValues} stats={chartStats} />
                        </Suspense>
                        <div className="mt-1 text-center text-[0.65rem] text-faint">{t('sim_dist_note')}</div>
                      </div>
                      {/* ประโยคสรุปอ่านง่ายใต้กราฟ */}
                      <p className="mt-2 rounded-lg border border-line-soft bg-sunken/60 px-3 py-2 text-center text-[0.72rem] text-dim">
                        {t('sim_budget_note', {
                          label: t(card.label),
                          p90: fmt(chartStats.p90, 0),
                          median: fmt(chartStats.median, 0),
                          unit: t(card.unit),
                          start: results.cfgUsed.startLevel,
                          target: results.cfgUsed.targetLevel,
                        })}
                      </p>
                    </div>
                  );
                })()}

                {/* ตารางรายรอบ */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-dim">{t('sim_rounds_detail')}</div>
                  <div className="max-h-[240px] overflow-y-auto rounded-xl border border-line-soft bg-sunken">
                    <table className="w-full text-center text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-dim">
                          <th className="px-2 py-2 font-semibold">{t('sim_col_round')}</th>
                          <th className="px-2 py-2 font-semibold">{t('sim_col_attempts')}</th>
                          <th className="px-2 py-2 font-semibold text-emerald-500">{t('sim_col_success')}</th>
                          <th className="px-2 py-2 font-semibold text-rose-500">{t('sim_col_fail')}</th>
                          <th className="px-2 py-2 font-semibold text-sky-500">{t('sim_col_stone')}</th>
                          <th className="px-2 py-2 font-semibold text-amber-500">BSB</th>
                          <th className="px-2 py-2 font-semibold text-rose-400">{t('sim_col_lost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.runs.map((r, i) => (
                          <tr key={i} className="border-t border-line-soft text-dim">
                            <td className="px-2 py-1.5 text-faint">#{i + 1}</td>
                            <td className="px-2 py-1.5 font-semibold">{r.attempts}{r.aborted ? '*' : ''}</td>
                            <td className="px-2 py-1.5">{r.successes}</td>
                            <td className="px-2 py-1.5">{r.fails}</td>
                            <td className="px-2 py-1.5">{r.oresTotal}</td>
                            <td className="px-2 py-1.5">{r.bsbUsed}</td>
                            <td className="px-2 py-1.5">{r.itemsLost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatorPanel;
