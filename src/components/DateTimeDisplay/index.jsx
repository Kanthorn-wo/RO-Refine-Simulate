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

  const getRandomColor = () => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '15px 20px',
      borderRadius: '12px',
      margin: '10px 0',
      textAlign: 'center',
      color: 'white',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      border: '2px solid rgba(255,255,255,0.1)'
    }}>
      <div style={{
        fontSize: '1.2em',
        fontWeight: 'bold',
        marginBottom: '5px',
        color: getRandomColor()
      }}>
        📅 {formatDate(currentDateTime)}
      </div>
      <div style={{
        fontSize: '1.4em',
        fontWeight: 'bold',
        color: '#ffeb3b',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        ⏰ {formatTime(currentDateTime)}
      </div>
      <div style={{
        fontSize: '0.9em',
        marginTop: '8px',
        opacity: 0.8,
        color: '#e1f5fe'
      }}>
        🎮 Ragnarok Online Refine Simulator
      </div>
    </div>
  );
};

export default DateTimeDisplay;
