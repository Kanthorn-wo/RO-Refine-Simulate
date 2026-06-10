import React, { useState, useRef } from 'react';
import { useLang } from '../../contexts/LangContext';
import { STONE_META, getEffectiveStone } from '../../utils/stones';
import { ORE_IMAGES, ORE_COLORS } from '../../constants/ores';
import { simulateRound, summarize, buildHistogram, MAX_ATTEMPTS_PER_ROUND } from '../../utils/simulate';

// สีหลักของแต่ละชนิดหิน (ปุ่มเลือก)
const STONE_BTN_ACTIVE = {
  normal: 'border-sky-400 bg-sky-500/20 text-sky-200',
  enriched: 'border-amber-400 bg-amber-400/20 text-amber-200',
  hd: 'border-orange-400 bg-orange-500/20 text-orange-200',
};

const ROUND_PRESETS = [100, 300, 500, 1000];
const CHUNK_SIZE = 50;

// Histogram SVG: แท่งการกระจาย + แถบ Mean±1SD + เส้น Mean
const Histogram = ({ values, stats }) => {
  const binCount = Math.min(24, Math.max(8, Math.ceil(Math.sqrt(values.length))));
  const bins = buildHistogram(values, binCount);
  if (!bins.length) return null;
  const W = 600, H = 170, PB = 20, PT = 8, PX = 6;
  const lo = bins[0].x0;
  const hi = bins[bins.length - 1].x1;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const x = (v) => PX + ((v - lo) / (hi - lo || 1)) * (W - PX * 2);
  const barY = (c) => PT + (1 - c / maxCount) * (H - PT - PB);
  const bandX0 = x(Math.max(lo, stats.mean - stats.sd));
  const bandX1 = x(Math.min(hi, stats.mean + stats.sd));
  const meanX = x(stats.mean);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="histogram">
      {/* แถบ Mean ± 1SD */}
      <rect x={bandX0} y={PT} width={Math.max(0, bandX1 - bandX0)} height={H - PT - PB} fill="rgb(56 189 248 / 0.12)" />
      {bins.map((b, i) => {
        const bx = x(b.x0);
        const bw = Math.max(1, x(b.x1) - bx - 1.5);
        return (
          <rect key={i} x={bx} y={barY(b.count)} width={bw} height={H - PB - barY(b.count)}
            rx="2" fill="rgb(251 191 36 / 0.55)" stroke="rgb(251 191 36 / 0.8)" strokeWidth="0.5" />
        );
      })}
      {/* เส้น Mean */}
      <line x1={meanX} y1={PT} x2={meanX} y2={H - PB} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* แกน X: ต่ำสุด / mean / สูงสุด */}
      <text x={PX} y={H - 6} fontSize="10" fill="#64748b">{Math.round(lo)}</text>
      <text x={meanX} y={H - 6} fontSize="10" fill="#fbbf24" textAnchor="middle">{stats.mean.toFixed(1)}</text>
      <text x={W - PX} y={H - 6} fontSize="10" fill="#64748b" textAnchor="end">{Math.round(hi)}</text>
    </svg>
  );
};

const StatChip = ({ label, value }) => (
  <div className="rounded-lg border border-slate-700/60 bg-[#0f1117] px-3 py-2 text-center">
    <div className="text-[0.65rem] text-slate-500">{label}</div>
    <div className="text-sm font-bold text-slate-200">{value}</div>
  </div>
);

const AvgCard = ({ label, value, unit, accent }) => (
  <div className={`rounded-xl border px-3 py-3 text-center ${accent}`}>
    <div className="text-xs font-semibold text-slate-400">{label}</div>
    <div className="text-xl font-bold">{value}</div>
    <div className="text-[0.65rem] text-slate-500">{unit}</div>
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
        const avgOf = (sel) => all.reduce((a, r) => a + sel(r), 0) / all.length;
        setResults({
          runs: all,
          stats: summarize(attempts),
          attempts,
          avg: {
            attempts: avgOf((r) => r.attempts),
            successes: avgOf((r) => r.successes),
            fails: avgOf((r) => r.fails),
            itemsLost: avgOf((r) => r.itemsLost),
            oresTotal: avgOf((r) => r.oresTotal),
            bsbUsed: avgOf((r) => r.bsbUsed),
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
        onClick={() => setOpen((o) => !o)}
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
              <div className="ml-auto flex items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-400">{t('sim_rounds_label')}</span>
                  <div className="flex gap-1">
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
                  </div>
                </label>
                <button
                  type="button"
                  onClick={runSimulation}
                  disabled={running}
                  className="rounded-lg border border-violet-400/60 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 px-4 py-1.5 text-sm font-bold text-violet-100 transition-colors hover:from-violet-500/50 hover:to-fuchsia-500/50 disabled:cursor-not-allowed disabled:opacity-50"
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

                {/* ค่าเฉลี่ยต่อรอบ — ครบทุกตัว */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">{t('sim_summary')} ({results.runs.length} {t('sim_rounds_unit')})</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <AvgCard label={t('sim_avg_attempts')} value={fmt(results.avg.attempts)} unit={t('sim_unit_times')} accent="border-slate-700/60 bg-[#0f1117] text-amber-300" />
                    <AvgCard label={t('sim_avg_success')} value={fmt(results.avg.successes)} unit={t('sim_unit_times')} accent="border-emerald-700/40 bg-emerald-950/20 text-emerald-400" />
                    <AvgCard label={t('sim_avg_fail')} value={fmt(results.avg.fails)} unit={t('sim_unit_times')} accent="border-rose-700/40 bg-rose-950/20 text-rose-400" />
                    <AvgCard label={t('sim_avg_lost')} value={fmt(results.avg.itemsLost)} unit={t('sim_unit_items')} accent="border-rose-700/40 bg-rose-950/20 text-rose-300" />
                    <AvgCard label={t('sim_avg_stone')} value={fmt(results.avg.oresTotal)} unit={t('sim_unit_pcs')} accent="border-sky-700/40 bg-sky-950/20 text-sky-300" />
                    <AvgCard label={t('sim_avg_bsb')} value={fmt(results.avg.bsbUsed)} unit={t('sim_unit_pcs')} accent="border-amber-700/40 bg-amber-950/20 text-amber-300" />
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

                {/* สถิติ + Histogram */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">{t('sim_dist_title')}</div>
                  <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <StatChip label={t('sim_stat_mean')} value={fmt(results.stats.mean)} />
                    <StatChip label={t('sim_stat_sd')} value={fmt(results.stats.sd)} />
                    <StatChip label={t('sim_stat_median')} value={fmt(results.stats.median, 0)} />
                    <StatChip label="P90" value={fmt(results.stats.p90, 0)} />
                    <StatChip label={t('sim_stat_minmax')} value={`${results.stats.min}–${results.stats.max}`} />
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-[#0f1117] p-3">
                    <Histogram values={results.attempts} stats={results.stats} />
                    <div className="mt-1 text-center text-[0.65rem] text-slate-500">{t('sim_dist_note')}</div>
                  </div>
                </div>

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
