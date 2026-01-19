import React, { useEffect, useRef } from 'react';
import { TypeShuffle } from './utils/typeShuffle'; // 路径按实际调整
import 'splitting/dist/splitting.css';
import 'splitting/dist/splitting-cells.css';

const TypeShuffleText = ({ text, effect = 'fx1', className = '' }) => {
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const ts = new TypeShuffle(textRef.current);
      ts.trigger(effect);

      // 动画后还原内容，防止溢出
      const timer = setTimeout(() => {
        if (textRef.current) {
          textRef.current.innerHTML = text;
        }
      }, 1200); // 动画时长可根据实际调整

      return () => clearTimeout(timer);
    }
  }, [text, effect]);

  return (
    <div
      ref={textRef}
      className={`type-shuffle-text ${className}`}
      style={{ display: 'block', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
};

export default TypeShuffleText;