import React, { useState, useEffect } from 'react';

const TimestampDisplay = ({ isDarkMode }) => {
  const [date, setDate] = useState("2125.07.21 00:00:00");
  const [timestamp, setTimestamp] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      // 构建未来日期
      const futureDate = `2125.07.${String(now.getDate()).padStart(2, '0')} ${
        String(now.getHours()).padStart(2, '0')}:${
        String(now.getMinutes()).padStart(2, '0')}:${
        String(now.getSeconds()).padStart(2, '0')}`;
      
      setDate(futureDate);
      setTimestamp(prev => prev + 1000); // 每秒增加1000毫秒
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
      <div className={`text-xl ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
        {date}
      </div>
      <div className={`font-mono text-lg ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
        {timestamp}
      </div>
    </div>
  );
};

export default TimestampDisplay;