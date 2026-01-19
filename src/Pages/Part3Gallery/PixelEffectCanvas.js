import React, { useEffect, useRef } from 'react';

const PixelEffectCanvas = () => {
  const pixelCanvasRef = useRef(null);

  useEffect(() => {
    if (!pixelCanvasRef.current) return;

    const canvas = pixelCanvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 生成与GLSL火星岩石图像呼应的纹理点
    const generateNoise = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const pixelSize = 3;
      const columns = Math.ceil(canvas.width / pixelSize);
      const rows = Math.ceil(canvas.height / pixelSize);
      
      for (let i = 0; i < columns; i++) {
        for (let j = 0; j < rows; j++) {
          if (Math.random() > 0.998) { // 非常稀疏的点
            const x = i * pixelSize;
            const y = j * pixelSize;
            const size = 1 + Math.random() * 2;
            
            // 使用与GLSL颜色相似的暖橙色系
            ctx.fillStyle = `rgba(${255}, ${115 + Math.random() * 30}, ${44 + Math.random() * 20}, ${0.2 + Math.random() * 0.4})`;
            ctx.fillRect(x, y, size, size);
            
            // 偶尔添加一些十字形状，与背景网格呼应
            if (Math.random() > 0.7) {
              const crossSize = 3 + Math.random() * 4;
              ctx.fillRect(x - crossSize/2, y, crossSize, 1);
              ctx.fillRect(x, y - crossSize/2, 1, crossSize);
            }
          }
        }
      }
    };
    
    // 每300ms更新一次噪点
    const interval = setInterval(() => {
      generateNoise(Date.now() * 0.001);
    }, 300);
    
    // 初始生成
    generateNoise(0);

    // 清理函数
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <canvas
      ref={pixelCanvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        opacity: 0.6,
        mixBlendMode: 'screen' // 使点与背景更好地融合
      }}
    />
  );
};

export default PixelEffectCanvas;