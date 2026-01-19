import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

const GalleryImages = ({ imgs, hoverIndex, handleImageClick, handlePointerOver, handlePointerOut }) => {
  const imageRefs = useRef([]);

  // 定义图片在屏幕上的位置 - 使用相对于视口的百分比
  const getImagePosition = (index) => {
    // 为不同位置定义固定的坐标，并减小图片尺寸
    const positions = [
      { left: '10%', top: '15%', width: '14%' },    // 左上 - 更小
      { left: '65%', top: '10%', width: '13%' },    // 右上 - 更小
      { left: '75%', top: '45%', width: '12%' },    // 左中 - 更小
      { left: '55%', top: '36%', width: '12%' },    // 中间 - 更小
      { left: '5%', top: '55%', width: '11%' },     // 右中 - 更小
      { left: '18%', top: '70%', width: '15%' }     // 下方中央 - 更小
    ];

    return positions[index % positions.length];
  };

  // GLSL模拟效果的滤镜，用于图片
  const getGlslEffectFilter = (index) => {
    // 每个图片使用略微不同的效果，增加变化
    const hueOffset = index * 5;
    const contrast = 1.05 + (index % 3) * 0.05;
    
    return `brightness(0.9) contrast(${contrast}) sepia(0.2) hue-rotate(${hueOffset}deg)`;
  };

  // 图片显现动画效果
  useEffect(() => {
    const timeouts = [];

    // 为每张图片设置一个延迟显现的定时器
    imageRefs.current.forEach((el, index) => {
      if (!el) return;

      const timeout = setTimeout(() => {
        // 先设置为可见但透明
        gsap.set(el, {
          scale: 0.95,
          opacity: 0,
          y: 20,
        });

        // 创建像素化动画效果
        const img = el.querySelector('img');
        if (img) {
          // 克隆图片并创建像素化效果的容器
          const pixelContainer = document.createElement('div');
          pixelContainer.style.position = 'absolute';
          pixelContainer.style.top = '0';
          pixelContainer.style.left = '0';
          pixelContainer.style.width = '100%';
          pixelContainer.style.height = '100%';
          pixelContainer.style.overflow = 'hidden';
          pixelContainer.style.zIndex = '5';
          el.appendChild(pixelContainer);

          // 创建更多像素粒子，更好地呼应GLSL的岩石纹理
          const particleCount = 60 + Math.floor(Math.random() * 40); // 增加粒子数量
          const particles = [];

          // 创建更多不同形状的粒子
          for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const size = 1 + Math.random() * 4;
            const isRound = Math.random() > 0.3; // 随机形状

            particle.style.position = 'absolute';
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.backgroundColor = '#FF732C';
            particle.style.borderRadius = isRound ? '50%' : `${Math.floor(Math.random() * 2) + 1}px`;
            
            // 使粒子分布更加集中在图片轮廓
            const centerBias = Math.random() > 0.7;
            const top = centerBias 
              ? 30 + Math.random() * 40 // 集中在中间区域
              : Math.random() * 100;
            const left = centerBias 
              ? 30 + Math.random() * 40 // 集中在中间区域
              : Math.random() * 100;
            
            particle.style.top = `${top}%`;
            particle.style.left = `${left}%`;
            particle.style.opacity = '0';
            particle.style.boxShadow = `0 0 ${3 + Math.random() * 4}px 1px rgba(255, 115, 44, 0.6)`;
            particle.style.transform = `rotate(${Math.random() * 360}deg)`;

            pixelContainer.appendChild(particle);
            particles.push(particle);
          }

          // 顺序动画：粒子显现 -> 图片淡入 -> 移除粒子
          // 1. 粒子汇聚动画 - 模拟像素化过程
          particles.forEach((particle, i) => {
            // 先从四周向图片中心汇聚
            gsap.fromTo(particle, 
              {
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 200,
                opacity: 0
              },
              {
                x: 0,
                y: 0,
                opacity: Math.random() * 0.7 + 0.3,
                delay: 0.02 * i,
                duration: 0.6,
                ease: "power2.out"
              }
            );

            // 然后添加微小抖动，更呼应火星岩石表面的不稳定感
            gsap.to(particle, {
              x: (Math.random() - 0.5) * 10,
              y: (Math.random() - 0.5) * 10,
              repeat: -1,
              duration: 0.5 + Math.random() * 1.5,
              yoyo: true,
              ease: "sine.inOut",
              delay: 0.6 + 0.02 * i
            });
          });

          // 2. 图片淡入 - 添加一些微小的扭曲效果
          gsap.to(el, {
            scale: 1,
            opacity: 1,
            y: 0,
            delay: 0.7, // 等待粒子汇聚
            duration: 0.8,
            ease: "power2.out",
            onComplete: () => {
              // 弹出后添加轻微的悬浮动画
              gsap.to(el, {
                y: '+=5',
                duration: 1.5 + Math.random(),
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
              });

              // 3. 移除粒子效果 - 让它们向外散开
              gsap.to(particles, {
                opacity: 0,
                x: (i) => (Math.random() - 0.5) * 100,
                y: (i) => (Math.random() - 0.5) * 100,
                stagger: 0.01,
                duration: 0.8,
                delay: 0.8,
                ease: "power1.in",
                onComplete: () => {
                  // 动画结束后移除粒子容器
                  setTimeout(() => pixelContainer.remove(), 500);
                }
              });
            }
          });
        }

        // 添加弹出音效
        const popSound = new Audio('/sounds/pop.mp3'); // 如果有音效文件
        popSound.volume = 0.3;
        try {
          popSound.play().catch(e => console.log('音频播放被阻止：', e));
        } catch (error) {
          console.log('音频播放错误：', error);
        }

      }, 800 * index); // 每隔0.8秒弹出一个

      timeouts.push(timeout);
    });

    // 清理函数
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      padding: '80px 20px',
      zIndex: 5
    }}>
      {imgs.map((src, index) => {
        const position = getImagePosition(index);
        const isHovered = hoverIndex === index;

        return (
          <div
            key={src}
            ref={el => imageRefs.current[index] = el}
            onClick={() => handleImageClick(index)}
            onMouseEnter={() => handlePointerOver(index)}
            onMouseLeave={handlePointerOut}
            style={{
              position: 'absolute',
              left: position.left,
              top: position.top,
              width: position.width,
              margin: 0,
              boxShadow: isHovered
                ? '0 0 25px rgba(255, 115, 44, 0.7), 0 0 10px rgba(255, 115, 44, 0.9) inset'
                : '0 4px 16px rgba(0,0,0,0.6)',
              background: '#111',
              overflow: 'hidden',
              border: `1px solid ${isHovered ? 'rgba(255, 115, 44, 0.9)' : '#333'}`,
              borderRadius: '4px',
              opacity: 0, // 初始不可见，通过动画显示
              cursor: 'none',
              zIndex: 1,
              transition: 'box-shadow 0.3s, border 0.3s',
            }}
          >
            {/* 系统风格边框装饰 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '12px',
              height: '12px',
              borderTop: '2px solid #FF732C',
              borderLeft: '2px solid #FF732C',
              zIndex: 2
            }}></div>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '12px',
              height: '12px',
              borderTop: '2px solid #FF732C',
              borderRight: '2px solid #FF732C',
              zIndex: 2
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '12px',
              height: '12px',
              borderBottom: '2px solid #FF732C',
              borderLeft: '2px solid #FF732C',
              zIndex: 2
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '12px',
              height: '12px',
              borderBottom: '2px solid #FF732C',
              borderRight: '2px solid #FF732C',
              zIndex: 2
            }}></div>

            {/* 图片内容 - 添加滤镜与GLSL呼应 */}
            <img
              src={src}
              alt={`Mars Gallery ${index + 1}`}
              style={{
                width: '100%',
                display: 'block',
                height: 'auto',
                filter: isHovered 
                  ? `brightness(1.2) contrast(1.1)` 
                  : getGlslEffectFilter(index),
                transition: 'filter 0.3s'
              }}
            />

            {/* 左上角标号 - 更系统化设计 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              background: 'rgba(0,0,0,0.8)',
              color: '#FF732C',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              borderBottomRightRadius: '4px',
              borderRight: '1px solid #FF732C',
              borderBottom: '1px solid #FF732C',
              boxShadow: isHovered ? '0 0 8px rgba(255, 115, 44, 0.6)' : 'none',
              transition: 'box-shadow 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FF732C',
                animation: isHovered ? 'blink 1s infinite' : 'none'
              }}></div>
              AUTO{index + 1}
            </div>

            {/* 系统化悬停效果 */}
            {isHovered && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '8px',
                background: 'rgba(0,0,0,0.8)',
                borderTop: '1px solid #FF732C',
                color: '#FF732C',
                fontSize: '8px',
                fontFamily: 'monospace',
                opacity: 0.9,
                animation: 'fadeIn 0.3s ease-in'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span>ID: AUTO{(index + 1).toString().padStart(1, '0')}</span>
                  <span>STATUS: ACTIVE</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '2px',
                  background: 'rgba(255, 115, 44, 0.2)',
                  position: 'relative',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    height: '100%',
                    width: `${70 + index * 5}%`,
                    background: '#FF732C',
                    animation: 'pulse 2s infinite'
                  }}></div>
                </div>
                <div style={{ textAlign: 'center' }}>点击以查看详情</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GalleryImages;