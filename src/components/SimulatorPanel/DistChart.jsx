import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useLang } from '../../contexts/LangContext';
import { buildHistogram } from '../../utils/simulate';

// กราฟการกระจาย (Recharts) — แท่ง histogram + เส้นโอกาสสะสม (CDF) + เส้นอ้างอิง Mean/P50/P90
// แยกไฟล์เพื่อ lazy load: recharts จะถูกโหลดเฉพาะตอนเปิด panel จำลอง
const DistChart = ({ values, stats }) => {
  const { t } = useLang();
  const binCount = Math.min(24, Math.max(8, Math.ceil(Math.sqrt(values.length))));
  const bins = buildHistogram(values, binCount);
  if (!bins.length) return null;
  const total = values.length;
  let cum = 0;
  const data = bins.map((b) => {
    cum += b.count;
    return {
      name: `${Math.round(b.x0)}–${Math.round(b.x1)}`,
      mid: (b.x0 + b.x1) / 2,
      count: b.count,
      cdf: (cum / total) * 100,
    };
  });
  // หา bin ที่ค่าอ้างอิงตกอยู่ (ReferenceLine บนแกน category ต้องชี้ด้วยชื่อ bin)
  const binNameOf = (v) => {
    const idx = Math.max(0, bins.findIndex((b) => v >= b.x0 && v <= b.x1));
    return data[idx === -1 ? data.length - 1 : idx].name;
  };
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 18, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} width={34}
          tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#38bdf8' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#0f1117', border: '1px solid #334155', borderRadius: 10, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8', fontWeight: 700 }}
          itemStyle={{ padding: 0 }}
          formatter={(value, name) => name === t('sim_tt_cdf') ? [`${value.toFixed(1)}%`, name] : [value, name]}
        />
        <Bar yAxisId="left" dataKey="count" name={t('sim_tt_rounds')} fill="#fbbf24" fillOpacity={0.65}
          stroke="#fbbf24" strokeOpacity={0.9} radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cdf" name={t('sim_tt_cdf')} stroke="#38bdf8"
          strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <ReferenceLine yAxisId="left" x={binNameOf(stats.mean)} stroke="#fbbf24" strokeDasharray="4 3"
          label={{ value: `Mean ${stats.mean.toFixed(1)}`, position: 'top', fill: '#fbbf24', fontSize: 10, fontWeight: 700 }} />
        <ReferenceLine yAxisId="left" x={binNameOf(stats.median)} stroke="#34d399" strokeDasharray="2 2"
          label={{ value: `P50 ${Math.round(stats.median)}`, position: 'insideTopLeft', fill: '#34d399', fontSize: 10, fontWeight: 700 }} />
        <ReferenceLine yAxisId="left" x={binNameOf(stats.p90)} stroke="#fb7185" strokeDasharray="2 2"
          label={{ value: `P90 ${Math.round(stats.p90)}`, position: 'insideTopRight', fill: '#fb7185', fontSize: 10, fontWeight: 700 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DistChart;
