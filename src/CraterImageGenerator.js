import React from 'react';
import { renderToString } from 'react-dom/server';
import VisShape from './Components/VisShape/VisShape';

export const generateCraterImages = async (craters) => {
  for (let i = 0; i < craters.length; i++) {
    const crater = craters[i];
    
    // 创建一个新的 SVG 元素
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('width', '800');
    svgElement.setAttribute('height', '800');
    svgElement.setAttribute('viewBox', '0 0 800 800');
    
    // 添加背景
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#1a1a1a');
    svgElement.appendChild(rect);

    // 创建一个 foreignObject 来包含 React 组件
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', '100%');
    foreignObject.setAttribute('height', '100%');
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');

    // 创建一个 div 来包含 React 组件
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.position = 'relative';
    
    // 渲染 VisShape 组件
    const visShapeComponent = <VisShape 
      crater={crater} 
      disableAnimations={true} 
      disableWaveEffect={true}
    />;
    
    // 将组件渲染到 div 中
    div.innerHTML = renderToString(visShapeComponent);
    foreignObject.appendChild(div);
    svgElement.appendChild(foreignObject);

    // 添加文本信息
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('transform', 'translate(20, 700)');
    
    const textContent = [
      `ID: ${crater.id}`,
      `位置: ${crater.latitude.toFixed(2)}°N, ${crater.longitude.toFixed(2)}°E`,
      `直径: ${crater.diameter?.toFixed(2)} km`
    ];

    textContent.forEach((text, index) => {
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textElement.setAttribute('x', '0');
      textElement.setAttribute('y', index * 30);
      textElement.setAttribute('fill', 'white');
      textElement.setAttribute('font-size', '24');
      textElement.textContent = text;
      textGroup.appendChild(textElement);
    });

    svgElement.appendChild(textGroup);

    try {
      // 将 SVG 转换为 base64 字符串
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

      // 创建图片元素
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => {
          console.error('Image load error:', e);
          reject(e);
        };
        img.src = dataUrl;
      });

      // 创建 canvas 并绘制图片
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 导出为高清 JPEG
      const jpegUrl = canvas.toDataURL('image/jpeg', 1.0);
      const link = document.createElement('a');
      link.download = `crater-${crater.id}.jpg`;
      link.href = jpegUrl;
      link.click();

      // 等待一小段时间再继续下一个
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error processing crater:', crater.id, error);
      throw error;
    }
  }
};