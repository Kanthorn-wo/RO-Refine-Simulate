import React, { useState, useEffect } from 'react';
import { dailyData, generateDailyStats } from '../../constants/dailyData';

const DailyInfoPanel = () => {
  const [stats, setStats] = useState(generateDailyStats());
  const [showDetails, setShowDetails] = useState(false);

  // อัพเดตสถิติทุก 5 นาที
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(generateDailyStats());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-600/60 bg-gradient-to-br from-slate-800 to-slate-700 p-4 text-white shadow-lg shadow-black/30">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="m-0 text-yellow-300">📊 ข้อมูลประจำวัน</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="rounded-md border border-yellow-300 bg-transparent px-2.5 py-1 text-sm text-yellow-300 transition-colors hover:bg-yellow-300/10"
        >
          {showDetails ? '▲ ซ่อน' : '▼ แสดง'}
        </button>
      </div>

      <div className="mb-2.5">
        <span className="text-green-300">{dailyData.randomTip}</span>
      </div>

      {dailyData.specialEvent && (
        <div className="my-2 rounded-md border border-yellow-300 bg-yellow-300/10 p-2 text-yellow-300">
          {dailyData.specialEvent}
        </div>
      )}

      {showDetails && (
        <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <div className="rounded-md bg-white/10 p-2.5">
            <div className="text-sky-300">🎯 การตีบวกวันนี้</div>
            <div className="text-lg font-bold">{stats.totalRefines}</div>
          </div>
          <div className="rounded-md bg-white/10 p-2.5">
            <div className="text-green-300">✅ อัตราสำเร็จเฉลี่ย</div>
            <div className="text-lg font-bold">{stats.successRate}</div>
          </div>
          <div className="rounded-md bg-white/10 p-2.5">
            <div className="text-orange-300">🔥 ไอเทมยอดนิยม</div>
            <div className="text-lg font-bold">{stats.mostPopularItem}</div>
          </div>
          <div className="rounded-md bg-white/10 p-2.5">
            <div className="text-pink-300">🍀 ชั่วโมงมงคล</div>
            <div className="text-lg font-bold">{stats.luckyHour}</div>
          </div>
        </div>
      )}

      <div className="mt-2.5 rounded-md bg-green-500/20 p-2 text-center text-green-300">
        {stats.dailyBonus}
      </div>

      <div className="mt-2.5 text-right text-xs text-slate-400">
        {dailyData.version} | อัพเดต: {new Date(dailyData.lastUpdated).toLocaleString('th-TH')}
      </div>
    </div>
  );
};

export default DailyInfoPanel;
