import React, { useEffect, useRef } from 'react';

const BackgroundCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    // 创建橙色科幻网格背景
    const drawGrid = () => {
      ctx.clearRect(0, 0, width, height);

      // 网格线颜色 - 橙色暗色调
      ctx.strokeStyle = 'rgba(255, 115, 44, 0.1)';
      ctx.lineWidth = 1;

      // 绘制水平线
      const gridSize = 40;
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 绘制垂直线
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 添加十字形点位和数据流动效果
      const time = Date.now() * 0.001;
      const points = 12;

      for (let i = 0; i < points; i++) {
        const x = Math.sin(time * 0.3 + i * 0.7) * width * 0.45 + width * 0.5;
        const y = Math.cos(time * 0.2 + i * 0.6) * height * 0.45 + height * 0.5;

        const size = 3 + Math.sin(time + i) * 1.5;

        // 绘制十字形点位
        ctx.fillStyle = `rgba(255, 115, 44, ${0.6 - i * 0.04})`;
        ctx.beginPath();
        // 水平线
        ctx.fillRect(x - size * 2, y - size / 3, size * 4, size / 1.5);
        // 垂直线
        ctx.fillRect(x - size / 3, y - size * 2, size / 1.5, size * 4);

        // 连接点 - 数据流动效果
        if (i > 0) {
          const prevX = Math.sin(time * 0.3 + (i - 1) * 0.7) * width * 0.45 + width * 0.5;
          const prevY = Math.cos(time * 0.2 + (i - 1) * 0.6) * height * 0.45 + height * 0.5;

          ctx.strokeStyle = `rgba(255, 115, 44, ${0.15 - i * 0.01})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // 添加流动的数据点
          const flowPoints = 5;
          for (let f = 0; f < flowPoints; f++) {
            const progress = (time * 0.5 + f / flowPoints) % 1;
            const flowX = prevX + (x - prevX) * progress;
            const flowY = prevY + (y - prevY) * progress;

            ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - progress)})`;
            ctx.beginPath();
            ctx.arc(flowX, flowY, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 添加一些随机的数据指标和标记
      ctx.font = '10px monospace';
      for (let i = 0; i < 8; i++) {
        const x = Math.sin(time * 0.2 + i * 8.1) * width * 0.4 + width * 0.5;
        const y = Math.cos(time * 0.3 + i * 7.7) * height * 0.4 + height * 0.5;

        ctx.fillStyle = `rgba(255, 115, 44, ${0.3 + Math.sin(time + i) * 0.1})`;
        ctx.fillText(`MARS-${i.toString(16).toUpperCase()}${Math.floor(time + i) % 100}`, x, y);

        // 绘制小方块标记
        ctx.strokeStyle = `rgba(255, 115, 44, ${0.4 + Math.sin(time + i) * 0.1})`;
        ctx.strokeRect(x - 15, y - 15, 30, 30);

        // 绘制角标记
        ctx.beginPath();
        ctx.moveTo(x - 20, y - 20);
        ctx.lineTo(x - 15, y - 20);
        ctx.lineTo(x - 15, y - 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 20, y - 20);
        ctx.lineTo(x + 15, y - 20);
        ctx.lineTo(x + 15, y - 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - 20, y + 20);
        ctx.lineTo(x - 15, y + 20);
        ctx.lineTo(x - 15, y + 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 20, y + 20);
        ctx.lineTo(x + 15, y + 20);
        ctx.lineTo(x + 15, y + 15);
        ctx.stroke();
      }
    };

    // 动画循环
    const animate = () => {
      drawGrid();
      requestAnimationFrame(animate);
    };

    animate();

    // 清理函数
    return () => {
      cancelAnimationFrame(animate);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: 0.8
      }}
    />
  );
};

export default BackgroundCanvas;