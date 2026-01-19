import React, { useState, useEffect } from 'react';
import PotatoPlanet from '../PotatoPages/PotatoPlanet';
import VisShape from '../../Components/VisShape/VisShape';
import RdOverlaySvg from '../../Components/RdOverlay/RdOverlaySvg';
import { OverlayBackground } from '../../Components/OverlayLayers';

// 浮现水滴组件 - 从火星坑底部浮现出类似土豆的变化小圆球，向上融入土豆
const RisingDroplets = () => {
  // 生成多个水滴，每个有不同的延迟和位置
  const droplets = [
    { id: 0, delay: 0, x: -30, size: 12 },
    { id: 1, delay: 0.8, x: 20, size: 10 },
    { id: 2, delay: 1.6, x: -10, size: 14 },
    { id: 3, delay: 2.4, x: 35, size: 11 },
    { id: 4, delay: 3.2, x: -25, size: 9 },
    { id: 5, delay: 0.4, x: 5, size: 13 },
  ];

  return (
    <>
      {/* 水滴容器 - 定位在火星坑第二层（坑底）位置 */}
      <div style={{
        position: 'absolute',
        bottom: '22vh', // 对应火星坑第二层扁椭圆的位置
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        height: '300px',
        zIndex: 19,
        pointerEvents: 'none',
      }}>
        {droplets.map((droplet) => (
          <div
            key={droplet.id}
            style={{
              position: 'absolute',
              bottom: '0',
              left: `calc(50% + ${droplet.x}px)`,
              width: `${droplet.size}px`,
              height: `${droplet.size}px`,
              borderRadius: '50%',
              // 深橙色，类似土豆的颜色
              background: 'radial-gradient(ellipse at 30% 30%, rgba(255,180,120,0.9) 0%, rgba(200,100,50,0.8) 50%, rgba(150,70,30,0.7) 100%)',
              boxShadow: '0 0 8px rgba(200,100,50,0.4)',
              animation: `risingDroplet 4s ease-out infinite`,
              animationDelay: `${droplet.delay}s`,
              // 模拟土豆的变形效果
              transform: 'scale(1)',
            }}
          />
        ))}
      </div>
      
      <style>{`
        @keyframes risingDroplet {
          0% {
            transform: translateY(0) scale(0.3);
            opacity: 0;
            border-radius: 50%;
          }
          10% {
            opacity: 0.8;
            transform: translateY(-20px) scale(0.6);
          }
          30% {
            transform: translateY(-80px) scale(0.9) scaleX(1.1);
            border-radius: 45%;
          }
          50% {
            transform: translateY(-150px) scale(1) scaleX(0.9);
            border-radius: 50%;
          }
          70% {
            transform: translateY(-220px) scale(0.8) scaleX(1.05);
            opacity: 0.6;
            border-radius: 48%;
          }
          90% {
            transform: translateY(-280px) scale(0.4);
            opacity: 0.2;
          }
          100% {
            transform: translateY(-300px) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

const Step2TestPage = ({ potatoData, craterData, selectedCrater, setSelectedCrater }) => {
  // 当前选中的陨石坑索引
  const [craterIndex, setCraterIndex] = useState(0);

  // 使用传入的 selectedCrater，或者从 craterData 中选择
  const currentCrater = selectedCrater || (craterData && craterData[craterIndex]);

  // 切换陨石坑
  const handleCraterChange = (index) => {
    setCraterIndex(index);
    if (setSelectedCrater && craterData) {
      setSelectedCrater(craterData[index]);
    }
  };


  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#F57435', overflow: 'hidden' }}>
      {/* 火星坑 SVG 动态视觉背景 - 放在外层，不受土豆切换影响 */}
      {currentCrater && (
        <div style={{
          position: 'absolute',
          bottom: '-70vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150vw',
          height: '150vw',
          maxWidth: '1200px',
          maxHeight: '1200px',
          zIndex: 1,
          opacity: 0.85,
          pointerEvents: 'none',
          perspective: '800px',
          perspectiveOrigin: '50% 30%',
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            transform: 'rotateX(55deg)',
            transformStyle: 'preserve-3d',
          }}>
            {/* 火星坑主体 */}
            <VisShape crater={currentCrater} isDarkMode={false} size={1} />
          </div>
        </div>
      )}

      {/* 射线坑覆盖层 - 当 hasRd 为 true 时显示烫金效果 */}
      {currentCrater?.hasRd && (
        <RdOverlaySvg visible={true} />
      )}

      {/* 顶层颜色蒙版 - 统一颜色为橙色调 */}
      <OverlayBackground />

      {/* 浮现水滴效果 - 从火星坑底部浮现出类似土豆的小圆球，向上融入土豆 */}
      <RisingDroplets />

      {/* 陨石坑选择器面板 */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        padding: 16,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 280,
        border: '1px solid #FF722C',
        fontFamily: 'Inter, sans-serif',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ color: '#FF722C', margin: 0, fontSize: 14, fontWeight: 'bold' }}>
          Step2 测试 - 选择陨石坑
        </h3>
        
        {/* 陨石坑选择下拉框 */}
        {craterData && craterData.length > 0 && (
          <div>
            <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>
              选择陨石坑 ({craterData.length} 个可用)
            </label>
            <select 
              value={craterIndex}
              onChange={(e) => handleCraterChange(parseInt(e.target.value))}
              style={{ 
                width: '100%', 
                padding: 8, 
                borderRadius: 4, 
                border: '1px solid #444', 
                background: '#1a1a1a', 
                color: '#fff', 
                fontSize: 12 
              }}
            >
              {craterData.map((crater, idx) => (
                <option key={crater.id || idx} value={idx}>
                  {crater.id} - Ø{crater.diameter?.toFixed(1)}km @ {crater.latitude?.toFixed(1)}°
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 当前陨石坑属性显示 */}
        {currentCrater && (
          <div style={{ 
            background: '#111', 
            padding: 12, 
            borderRadius: 6, 
            fontSize: 11, 
            color: '#ccc',
            lineHeight: 1.6
          }}>
            <div style={{ color: '#FF722C', fontWeight: 'bold', marginBottom: 8 }}>
              当前陨石坑属性
            </div>
            <div><span style={{ color: '#888' }}>ID:</span> {currentCrater.id}</div>
            <div><span style={{ color: '#888' }}>纬度:</span> {currentCrater.latitude?.toFixed(2)}°</div>
            <div><span style={{ color: '#888' }}>经度:</span> {currentCrater.longitude?.toFixed(2)}°</div>
            <div><span style={{ color: '#888' }}>直径:</span> {currentCrater.diameter?.toFixed(2)} km</div>
            <div><span style={{ color: '#888' }}>内部形态:</span> {currentCrater.internalMorph?.join(', ') || '无'}</div>
            <div><span style={{ color: '#888' }}>溅射层数:</span> {currentCrater.layerNumber || 0}</div>
            <div><span style={{ color: '#888' }}>溅射层形态:</span> {currentCrater.layerMorph?.join(', ') || '无'}</div>
            <div><span style={{ color: '#888' }}>溅射层SVG:</span> {currentCrater.ejcSvg?.join(', ') || '无'}</div>
            <div><span style={{ color: '#888' }}>边缘退化:</span> {currentCrater.rimDegradation}</div>
            <div><span style={{ color: '#888' }}>溅射物退化:</span> {currentCrater.ejectaDegradation}</div>
            <div><span style={{ color: '#888' }}>底部退化:</span> {currentCrater.floorDegradation}</div>
            <div><span style={{ color: '#888' }}>射线坑:</span> {currentCrater.hasRd ? '是' : '否'}</div>
          </div>
        )}

        {/* 无数据提示 */}
        {(!craterData || craterData.length === 0) && (
          <div style={{ color: '#ff6b6b', fontSize: 12 }}>
            未加载陨石坑数据，请确保 CraterDataProvider 正常工作
          </div>
        )}
      </div>

      {/* 主内容区域 - PotatoPlanet（3D土豆在上层） */}
      <div style={{ position: 'relative', zIndex: 20, width: '100%', height: '100%' }}>
        <PotatoPlanet 
          potatoData={potatoData} 
          selectedCrater={currentCrater} 
        />
      </div>
    </div>
  );
};

export default Step2TestPage;
