import React, { useRef } from 'react';
import { Sparkles, Cloud, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

export const EnvironmentEffects = ({ type }) => {
  const group = useRef();

  useFrame((state) => {
    if (group.current) {
      // 缓慢旋转环境效果
      group.current.rotation.y += 0.002;
    }
  });

  if (!type) return null;

  switch (type) {
    case 'COLD': // 极寒 - 冰晶飘落效果
      return (
        <group ref={group}>
          <Sparkles 
            count={200} 
            scale={10} 
            size={4} 
            speed={0.4} 
            opacity={0.8} 
            color="#A5F2F3" 
          />
          <Cloud 
            opacity={0.3} 
            speed={0.2} 
            width={10} 
            depth={1.5} 
            segments={20} 
            position={[0, -2, -5]}
            color="#E0F7FA"
          />
        </group>
      );

    case 'MUTATION': // 辐射 - 紫色能量粒子
      return (
        <group ref={group}>
          <Sparkles 
            count={300} 
            scale={8} 
            size={6} 
            speed={2} 
            opacity={1} 
            color="#A020F0" 
            noise={1}
          />
          <Stars 
            radius={10} 
            depth={50} 
            count={1000} 
            factor={4} 
            saturation={0} 
            fade 
            speed={2} 
          />
        </group>
      );

    case 'STABILITY': // 稳态 - 金色/绿色漂浮物
      return (
        <group ref={group}>
          <Sparkles 
            count={100} 
            scale={12} 
            size={3} 
            speed={0.2} 
            opacity={0.6} 
            color="#FFD700" 
          />
          {/* 添加一些漂浮的几何体增加稳定感? 暂时用粒子 */}
        </group>
      );

    case 'MINERAL': // 矿脉 - 结晶闪光
      return (
        <group ref={group}>
          <Sparkles
            count={150}
            scale={8}
            size={5}
            speed={0.5}
            opacity={0.9}
            color="#FFFFFF"
          />
          <Sparkles
            count={50}
            scale={6}
            size={8}
            speed={0.3}
            opacity={1}
            color="#C0C0C0"
          />
        </group>
      );

    case 'NORMAL': // 标准 - 微尘漂浮
    case 'default':
      return (
        <group ref={group}>
          <Sparkles
            count={50}
            scale={10}
            size={2}
            speed={0.5}
            opacity={0.5}
            color="#FF722C" // 火星橙
          />
        </group>
      );

    default:
      return null;
  }
};

// SVG 图标组件
export const EnvironmentIcon = ({ type, color }) => {
  const size = 32;
  const style = { width: size, height: size, fill: color, marginRight: '10px' };

  switch (type) {
    case 'NORMAL': // 标准
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill={color} />
        </svg>
      );
    case 'COLD': // 雪花
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <path d="M12,2L12,22M2,12L22,12M4.93,4.93L19.07,19.07M4.93,19.07L19.07,4.93" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M12,2 L10,5 M12,2 L14,5" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M12,22 L10,19 M12,22 L14,19" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M2,12 L5,10 M2,12 L5,14" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M22,12 L19,10 M22,12 L19,14" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'MUTATION': // 辐射/原子
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <circle cx="12" cy="12" r="2" />
          <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(0, 12, 12)" fill="none" stroke={color} strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(60, 12, 12)" fill="none" stroke={color} strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(120, 12, 12)" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case 'STABILITY': // 盾牌/稳定
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="none" stroke={color} strokeWidth="2" />
        </svg>
      );
    case 'MINERAL': // 钻石
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <path d="M6,2 L18,2 L22,9 L12,22 L2,9 L6,2 Z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M2,9 L22,9 M12,22 L6,9 M12,22 L18,9 M6,2 L12,9 L18,2" stroke={color} strokeWidth="1" />
        </svg>
      );
    default: // 默认圆圈
      return (
        <svg viewBox="0 0 24 24" style={style}>
          <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="2" />
        </svg>
      );
  }
};
