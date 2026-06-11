import React, { useState, useRef, Suspense, lazy } from 'react';
import { useLang } from '../../contexts/LangContext';
import { STONE_META, getEffectiveStone } from '../../utils/stones';
import { ORE_IMAGES, ORE_COLORS } from '../../constants/ores';
import { simulateRound, summarize, MAX_ATTEMPTS_PER_ROUND } from '../../utils/simulate';
import { trackEvent } from '../../utils/analytics';

// lazy load กราฟ (recharts) — โหลดเฉพาะตอนมีผลจำลองให้แสดง main bundle ไม่บวม
const DistChart = lazy(() => import('./DistChart'));

// สีหลักของแต่ละชนิดหิน (ปุ่มเลือก)
const STONE_BTN_ACTIVE = {
  normal: 'border-sky-400 bg-sky-500/20 text-sky-200',
  enriched: 'border-amber-400 bg-amber-400/20 text-amber-200',
  hd: 'border-orange-400 bg-orange-500/20 text-orange-200',
};

const ROUND_PRESETS = [100, 300, 500, 1000];
const CHUNK_SIZE = 50;

// metric สรุปต่อรอบ — ใช้ทั้งการ์ดสรุปและปุ่มสลับกราฟ
const METRIC_CARDS = [
  { key: 'attempts', label: 'sim_avg_attempts', unit: 'sim_unit_times', accent: 'border-slate-700/60 bg-[#0f1117] text-amber-300' },
  { key: 'successes', label: 'sim_avg_success', unit: 'sim_unit_times', accent: 'border-emerald-700/40 bg-emerald-950/20 text-emerald-400' },
  { key: 'fails', label: 'sim_avg_fail', unit: 'sim_unit_times', accent: 'border-rose-700/40 bg-rose-950/20 text-rose-400' },
  { key: 'itemsLost', label: 'sim_avg_lost', unit: 'sim_unit_items', accent: 'border-rose-700/40 bg-rose-950/20 text-rose-300' },
  { key: 'oresTotal', label: 'sim_avg_stone', unit: 'sim_unit_pcs', accent: 'border-sky-700/40 bg-sky-950/20 text-sky-300' },
  { key: 'bsbUsed', label: 'sim_avg_bsb', unit: 'sim_unit_pcs', accent: 'border-amber-700/40 bg-amber-950/20 text-amber-300' },
];

// metric ที่ให้สลับดูบนกราฟ (ติด/ล้ม derive จากตีอยู่แล้ว เลยไม่ใส่)
const CHART_METRIC_KEYS = ['attempts', 'oresTotal', 'bsbUsed', 'itemsLost'];


const StatChip = ({ label, value }) => (
  <div className="rounded-lg border border-slate-700/60 bg-[#0f1117] px-3 py-2 text-center">
    <div className="text-[0.65rem] text-slate-500">{label}</div>
    <div className="text-sm font-bold text-slate-200">{value}</div>
  </div>
);

// การ์ดสรุป 1 metric: ค่าเฉลี่ยตัวใหญ่ + Min/Max แถวเล็กในการ์ดเดียว (ไม่แยก 3 แถวซ้ำซ้อน)
const AvgCard = ({ label, value, unit, minValue, maxValue, accent }) => (
  <div className={`rounded-xl border px-2 py-3 text-center ${accent}`}>
    <div className="text-xs font-semibold text-slate-400">{label}</div>
    <div className="text-xl font-bold">{value}</div>
    <div className="text-[0.65rem] text-slate-500">{unit}</div>
    <div className="mt-1.5 flex items-center justify-center gap-1 border-t border-slate-700/40 pt-1.5 text-[0.65rem] leading-none">
      <span className="text-slate-500">Min</span>
      <b className="text-slate-300">{minValue}</b>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500">Max</span>
      <b className="text-slate-300">{maxValue}</b>
    </div>
  </div>
);

const SimulatorPanel = ({ itemType, isEventRate, bsbTable }) => {
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
  const cancelRef = useRef(false);

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
    if (running) return;
    trackEvent('sim_run', {
      item_type: itemType,
      start: startLevel,
      target: targetLevel,
      stone,
      rounds: clampedRounds,
      bsb: useBSB && bsbRelevant ? 1 : 0,
      event_rate: isEventRate ? 1 : 0,
    });
    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    setResults(null);
    const cfg = { itemType, startLevel, targetLevel, stone, useBSB: useBSB && bsbRelevant, isEventRate, bsbTable };
    const all = [];
    const step = () => {
      if (cancelRef.current) { setRunning(false); return; }
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
      }
    };
    setTimeout(step, 0);
  };

  const fmt = (n, d = 1) => Number(n.toFixed(d)).toLocaleString();

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-[#181a20]/90">
      {/* Header — กดเพื่อ slide เปิด/ปิด */}
      <button
        type="button"
        onClick={() => setOpen((o) => {
          if (!o) trackEvent('sim_open');
          return !o;
        })}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-violet-500/10"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-violet-300" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="9" width="3" height="6" rx="0.5" /><rect x="6.5" y="5" width="3" height="10" rx="0.5" /><rect x="12" y="1" width="3" height="14" rx="0.5" />
          </svg>
          <span className="text-sm font-bold text-violet-200">{t('sim_toggle')}</span>
          <span className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/15 px-2 py-0.5 text-[0.6rem] font-bold tracking-wider text-fuchsia-300">BETA</span>
        </span>
        <svg className={`h-4 w-4 text-violet-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* เนื้อหา slide (grid-rows trick) */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4">
            <p className="text-[0.7rem] leading-relaxed text-slate-500">
              {t('sim_beta_remark')} — {t('sim_desc')}
            </p>

            {/* สถานะเรทที่ใช้จำลอง — อิงสวิตช์ Event ของหน้าหลัก */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-400">{t('sim_rate_mode')}:</span>
              <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-bold ${
                isEventRate
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                  : 'border-slate-600 bg-slate-700/30 text-slate-300'
              }`}>
                {isEventRate ? t('event_rate_up') : t('no_event')}
              </span>
              <span className="text-[0.65rem] text-slate-500">{t('sim_rate_hint')}</span>
            </div>

            {/* Config */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-400">{t('sim_from')}</span>
                <select
                  value={startLevel}
                  onChange={(e) => handleStartChange(Number(e.target.value))}
                  disabled={running}
                  className="w-full rounded-lg border border-slate-600 bg-[#0f1117] px-2 py-2 text-sm text-slate-200"
                >
                  {Array.from({ length: 20 }, (_, i) => <option key={i} value={i}>+{i}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-400">{t('sim_to')}</span>
                <select
                  value={targetLevel}
                  onChange={(e) => { setTargetLevel(Number(e.target.value)); setResults(null); }}
                  disabled={running}
                  className="w-full rounded-lg border border-slate-600 bg-[#0f1117] px-2 py-2 text-sm text-slate-200"
                >
                  {Array.from({ length: 20 - startLevel }, (_, i) => startLevel + 1 + i).map((v) => (
                    <option key={v} value={v}>+{v}</option>
                  ))}
                </select>
              </label>
              <div className="col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-400">{t('sim_stone_label')}</span>
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
                          stone === s ? STONE_BTN_ACTIVE[s] : 'border-slate-600 text-slate-400 hover:border-slate-400'
                        } ${!usable ? 'cursor-not-allowed opacity-30' : ''}`}
                      >
                        {STONE_META[s].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {stonePartial && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.7rem] text-amber-300">
                {t('sim_stone_partial_warn')}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              {bsbRelevant && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-300">
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
              )}
              {/* mobile: เต็มความกว้าง ปุ่มรันอยู่บรรทัดของตัวเอง (กันโดนบีบ/โดน FAB ทับ) — ≥sm ค่อยชิดขวาแถวเดียว */}
              <div className="flex w-full flex-wrap items-end gap-2 sm:ml-auto sm:w-auto">
                <label className="block w-full sm:w-auto">
                  <span className="mb-1 block text-xs font-semibold text-slate-400">{t('sim_rounds_label')} (10–1000)</span>
                  <div className="flex flex-wrap gap-1">
                    {ROUND_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={running}
                        onClick={() => { setRounds(p); setResults(null); }}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
                          rounds === p ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-slate-600 text-slate-400 hover:border-slate-400'
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
                      className="w-20 min-w-0 flex-1 rounded-lg border border-slate-600 bg-[#0f1117] px-2 py-1.5 text-center text-xs font-bold text-slate-200 [appearance:textfield] focus:border-violet-400 focus:outline-none sm:flex-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={runSimulation}
                  disabled={running}
                  className="w-full whitespace-nowrap rounded-lg border border-violet-400/60 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 px-4 py-2 text-sm font-bold text-violet-100 transition-colors hover:from-violet-500/50 hover:to-fuchsia-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-1.5"
                >
                  {running ? t('sim_running', { done: progress, total: clampedRounds }) : t('sim_run')}
                </button>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="space-y-4 border-t border-slate-700/60 pt-4">
                {results.hasAborted && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.7rem] text-rose-300">
                    {t('sim_aborted_warn', { cap: MAX_ATTEMPTS_PER_ROUND.toLocaleString() })}
                  </p>
                )}

                {/* สรุปต่อรอบ — การ์ดเดียวต่อ metric: เฉลี่ยตัวใหญ่ + Min/Max ในตัว */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                    <span>{t('sim_summary')} ({results.runs.length} {t('sim_rounds_unit')})</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-bold ${
                      results.cfgUsed.isEventRate
                        ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                        : 'border-slate-600 bg-slate-700/30 text-slate-300'
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
                    <div className="mb-2 text-xs font-semibold text-slate-400">{t('sim_ore_avg_title')}</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(results.oreAvg).map(([name, avg]) => (
                        <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-[#0f1117] px-2.5 py-1 text-xs text-slate-300">
                          {ORE_IMAGES[name]
                            ? <img src={ORE_IMAGES[name]} alt="" className="h-4 w-4 object-contain" />
                            : <span className={`h-2 w-2 rounded-full ${ORE_COLORS[name] || 'bg-slate-400'}`} />}
                          {name}
                          <b className="text-slate-100">{fmt(avg)}</b>
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
                        <span className="text-xs font-semibold text-slate-400">{t('sim_dist_title')}</span>
                        <div className="flex gap-1">
                          {available.map((k) => {
                            const c = METRIC_CARDS.find((m) => m.key === k);
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setChartMetric(k)}
                                className={`rounded-lg border px-2 py-1 text-[0.68rem] font-bold transition-colors ${
                                  metricKey === k ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-slate-600 text-slate-400 hover:border-slate-400'
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
                      <div className="rounded-xl border border-slate-700/60 bg-[#0f1117] p-2">
                        <Suspense fallback={<div className="flex h-[230px] items-center justify-center text-xs text-slate-500">{t('loading_text')}</div>}>
                          <DistChart values={chartValues} stats={chartStats} />
                        </Suspense>
                        <div className="mt-1 text-center text-[0.65rem] text-slate-500">{t('sim_dist_note')}</div>
                      </div>
                      {/* ประโยคสรุปอ่านง่ายใต้กราฟ */}
                      <p className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-center text-[0.72rem] text-sky-200">
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
                  <div className="mb-2 text-xs font-semibold text-slate-400">{t('sim_rounds_detail')}</div>
                  <div className="max-h-[240px] overflow-y-auto rounded-xl border border-slate-700/60 bg-[#0f1117]">
                    <table className="w-full text-center text-xs">
                      <thead className="sticky top-0 bg-[#181a20]">
                        <tr className="text-slate-400">
                          <th className="px-2 py-2 font-semibold">{t('sim_col_round')}</th>
                          <th className="px-2 py-2 font-semibold">{t('sim_col_attempts')}</th>
                          <th className="px-2 py-2 font-semibold text-emerald-400">{t('sim_col_success')}</th>
                          <th className="px-2 py-2 font-semibold text-rose-400">{t('sim_col_fail')}</th>
                          <th className="px-2 py-2 font-semibold text-sky-300">{t('sim_col_stone')}</th>
                          <th className="px-2 py-2 font-semibold text-amber-300">BSB</th>
                          <th className="px-2 py-2 font-semibold text-rose-300">{t('sim_col_lost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.runs.map((r, i) => (
                          <tr key={i} className="border-t border-slate-800/60 text-slate-300">
                            <td className="px-2 py-1.5 text-slate-500">#{i + 1}</td>
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
  );
};

export default SimulatorPanel;
