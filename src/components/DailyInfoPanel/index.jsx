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
    <div style={{
      background: 'linear-gradient(45deg, #2c3e50, #34495e)',
      padding: '15px',
      borderRadius: '10px',
      margin: '10px 0',
      color: 'white',
      border: '1px solid #4a5568'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <h3 style={{ margin: 0, color: '#ffd700' }}>📊 ข้อมูลประจำวัน</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'transparent',
            border: '1px solid #ffd700',
            color: '#ffd700',
            padding: '5px 10px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {showDetails ? '▲ ซ่อน' : '▼ แสดง'}
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <span style={{ color: '#81c784' }}>{dailyData.randomTip}</span>
      </div>

      {dailyData.specialEvent && (
        <div style={{
          background: 'rgba(255, 215, 0, 0.1)',
          padding: '8px',
          borderRadius: '5px',
          margin: '8px 0',
          border: '1px solid #ffd700',
          color: '#ffd700'
        }}>
          {dailyData.specialEvent}
        </div>
      )}

      {showDetails && (
        <div style={{
          marginTop: '15px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
            <div style={{ color: '#90caf9' }}>🎯 การตีบวกวันนี้</div>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{stats.totalRefines}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
            <div style={{ color: '#a5d6a7' }}>✅ อัตราสำเร็จเฉลี่ย</div>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{stats.successRate}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
            <div style={{ color: '#ffab91' }}>🔥 ไอเทมยอดนิยม</div>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{stats.mostPopularItem}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
            <div style={{ color: '#f8bbd9' }}>🍀 ชั่วโมงมงคล</div>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{stats.luckyHour}</div>
          </div>
        </div>
      )}

      <div style={{
        marginTop: '10px',
        padding: '8px',
        background: 'rgba(76, 175, 80, 0.2)',
        borderRadius: '5px',
        textAlign: 'center',
        color: '#81c784'
      }}>
        {stats.dailyBonus}
      </div>

      <div style={{
        marginTop: '10px',
        textAlign: 'right',
        fontSize: '0.8em',
        color: '#bbb'
      }}>
        {dailyData.version} | อัพเดต: {new Date(dailyData.lastUpdated).toLocaleString('th-TH')}
      </div>
    </div>
  );
};

export default DailyInfoPanel;
