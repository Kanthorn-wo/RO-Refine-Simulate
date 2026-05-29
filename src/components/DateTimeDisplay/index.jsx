import React, { useState, useEffect } from 'react';

const DateTimeDisplay = () => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000); // อัพเดตทุกวินาที

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500 to-purple-700 px-5 py-4 text-center text-white shadow-lg shadow-black/30">
      <div className="mb-1 text-lg font-bold text-sky-100">
        📅 {formatDate(currentDateTime)}
      </div>
      <div className="text-2xl font-bold text-yellow-300 [text-shadow:0_2px_4px_rgba(0,0,0,0.3)]">
        ⏰ {formatTime(currentDateTime)}
      </div>
      <div className="mt-2 text-sm text-sky-100/80">
        🎮 Ragnarok Online Refine Simulator
      </div>
    </div>
  );
};

export default DateTimeDisplay;
