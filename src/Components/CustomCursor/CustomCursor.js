import { useEffect, useState } from 'react';
import { useCursorStore } from '../../store';
import './CustomCursor.css';

export const CustomCursor = () => {
  const type = useCursorStore(state => state.type);
  const [position, setPosition] = useState({ x: -100, y: -100 });

  useEffect(() => {
    const move = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div 
      className={`cursor-container ${type}`} 
      style={{ left: position.x, top: position.y }}
    >
      <div className="cursor-ring"></div>
    </div>
  );
};