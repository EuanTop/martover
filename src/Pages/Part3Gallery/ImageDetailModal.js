import React, { useRef, useCallback, useEffect, useState, lazy, Suspense } from 'react';
import LiquidDistortion from '../../Components/LiquidDistortion/LiquidDistortion';

// 懒加载 GaussianViewer 以优化初始加载
const GaussianViewer = lazy(() => import('../../Components/GaussianViewer/GaussianViewer'));

const ImageDetailModal = ({
  activeImageIndex,
  imgs,
  handleCloseActiveImage,
  handlePointerOver,
  handlePointerOut,
  getFutureYear
}) => {
  const distortionWrapperRef = useRef(null);
  const activeImageContainerRef = useRef(null);
  // 添加状态以跟踪容器尺寸和位置
  const [containerRect, setContainerRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  // 在组件顶部添加一个状态来存储点击时间
  const [clickTime] = useState(new Date()); // 记录用户点击进入图片的时间

  // 当大图被滚动时阻止冒泡，避免关闭模态窗
  const handleScroll = useCallback((e) => {
    e.stopPropagation();

    // 非常重要：当内容滚动时，重新计算容器的边界位置
    if (distortionWrapperRef.current) {
      const rect = distortionWrapperRef.current.getBoundingClientRect();
      setContainerRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }
  }, []);

  // 使用 useEffect 来获取和更新容器的尺寸和位置信息
  useEffect(() => {
    if (distortionWrapperRef.current) {
      const updateRect = () => {
        const rect = distortionWrapperRef.current.getBoundingClientRect();
        setContainerRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      };

      // 初始更新
      updateRect();

      // 短暂延迟再次更新以确保图片完全加载后正确计算尺寸
      const timer = setTimeout(updateRect, 300);

      // 添加事件监听器，在窗口大小变化和滚动时更新
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect); // 监听全局滚动
      distortionWrapperRef.current.addEventListener('scroll', updateRect);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
        if (distortionWrapperRef.current) {
          distortionWrapperRef.current.removeEventListener('scroll', updateRect);
        }
      };
    }
  }, []);

  // 格式化未来日期时间的辅助函数
  const getFutureDateTimeStr = (baseDate = new Date()) => {
    const futureDate = new Date(baseDate);
    futureDate.setFullYear(futureDate.getFullYear() + 100);
    return {
      date: futureDate.toLocaleDateString(),
      time: futureDate.toLocaleTimeString(),
      fullDateTime: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')} ${String(futureDate.getHours()).padStart(2, '0')}:${String(futureDate.getMinutes()).padStart(2, '0')}:${String(futureDate.getSeconds()).padStart(2, '0')}`
    };
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.9)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '40px',
        overflowY: 'auto',
      }}
      onClick={handleCloseActiveImage}
      ref={activeImageContainerRef}
    >
      {/* 系统风格顶部栏 */}
      // 修改系统风格顶部栏部分
      {/* 系统风格顶部栏 - 与HeaderUI.js保持一致 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px', // 统一为60px与HeaderUI.js保持一致
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.7))', // 更接近HeaderUI的渐变
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        color: '#FF732C',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 53,
        borderBottom: '1px solid rgba(255, 115, 44, 0.3)' // 透明度与HeaderUI保持一致
      }}>
        <div style={{
          width: '15px', // 与HeaderUI.js保持一致的大小
          height: '15px', // 与HeaderUI.js保持一致的大小
          background: '#FF732C',
          borderRadius: '50%',
          boxShadow: '0 0 10px #FF732C', // 添加与HeaderUI.js一致的阴影
          marginRight: '10px',
          animation: 'pulse 2s infinite'
        }} />
        <div style={{ flex: 1 }}>
          MARTOVER 自动化生产系统 // 详细视图 // ID: AUTO{(activeImageIndex + 1).toString().padStart(1, '0')}
        </div>

        {/* 系统化时间标记 */}
        <div style={{
          color: '#FF732C',
          fontSize: '12px',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <span>{getFutureDateTimeStr().date}</span>
          <span style={{
            width: '1px',
            height: '14px',
            background: '#FF732C'
          }}></span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 可滚动的图片容器 - 使用相对定位 */}
      <div
        ref={distortionWrapperRef}
        style={{
          width: activeImageIndex === 0 ? '90%' : '90%',
          maxWidth: activeImageIndex === 0 ? '1200px' : '1200px',
          height: activeImageIndex === 0 ? 'calc(100vh - 200px)' : 'auto', // 点云窗口高度，保留底部间距
          maxHeight: activeImageIndex === 0 ? 'none' : '80vh',
          minHeight: activeImageIndex === 0 ? 'calc(100vh - 200px)' : 'auto',
          position: 'relative',
          zIndex: 51,
          margin: '60px 0 80px 0',
          cursor: activeImageIndex === 0 ? 'grab' : 'none',
          border: '1px solid #FF732C',
          borderRadius: '4px',
          overflow: activeImageIndex === 0 ? 'hidden' : 'auto',
          scrollbarColor: '#FF732C #333',
          scrollbarWidth: 'thin',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => handlePointerOver(activeImageIndex)}
        onMouseLeave={handlePointerOut}
        onScroll={handleScroll}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* 根据图片索引显示不同内容 */}
        {activeImageIndex === 0 ? (
          /* 高斯溅射点云渲染 - 仅用于 Auto1 */
          <Suspense fallback={
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#111',
              color: '#FF732C',
              fontFamily: 'monospace'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid #FF732C',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 15px'
                }}></div>
                正在加载点云模型...
              </div>
            </div>
          }>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%'
            }}>
              <GaussianViewer
                plyUrl="/ply/scene1.ply"
                modelScale={1.0}
                autoRotate={false}
                backgroundColor={0x111111}
              />
            </div>
          </Suspense>
        ) : (
          /* 液体扭曲效果 - 其他图片 */
          <div style={{
            position: 'relative',
            zIndex: 4,
            width: '100%'
          }}>
            <LiquidDistortion
              imageUrl={imgs[activeImageIndex]}
              intensity={0.35}
              border={false}
            />

            {/* 添加一层与GLSL呼应的滤镜效果 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle, transparent 80%, rgba(20, 0, 0, 0.2))',
              mixBlendMode: 'multiply',
              zIndex: 5,
              pointerEvents: 'none'
            }}></div>
          </div>
        )}
      </div>

      {/* 系统化边框装饰 - 改为固定在容器四角 */}
      {/* 左上角 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top,
        left: containerRect.left,
        width: '30px',
        height: '30px',
        borderTop: '3px solid #FF732C',
        borderLeft: '3px solid #FF732C',
        zIndex: 52,
        pointerEvents: 'none'
      }}></div>
      {/* 右上角 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top,
        left: containerRect.left + containerRect.width - 30,
        width: '30px',
        height: '30px',
        borderTop: '3px solid #FF732C',
        borderRight: '3px solid #FF732C',
        zIndex: 52,
        pointerEvents: 'none'
      }}></div>
      {/* 左下角 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top + containerRect.height - 30,
        left: containerRect.left,
        width: '30px',
        height: '30px',
        borderBottom: '3px solid #FF732C',
        borderLeft: '3px solid #FF732C',
        zIndex: 52,
        pointerEvents: 'none'
      }}></div>
      {/* 右下角 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top + containerRect.height - 30,
        left: containerRect.left + containerRect.width - 30,
        width: '30px',
        height: '30px',
        borderBottom: '3px solid #FF732C',
        borderRight: '3px solid #FF732C',
        zIndex: 52,
        pointerEvents: 'none'
      }}></div>

      {/* 左上角系统标记 - 改为固定位置 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top,
        left: containerRect.left,
        background: 'rgba(0,0,0,0.8)',
        color: '#FF732C',
        padding: '10px 16px',
        fontSize: '16px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        borderBottomRightRadius: '8px',
        borderRight: '2px solid #FF732C',
        borderBottom: '2px solid #FF732C',
        // boxShadow: '0 0 15px rgba(255, 115, 44, 0.3)',
        zIndex: 52,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none'
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#FF732C',
          animation: 'pulse 2s infinite'
        }}></div>
        MARTOVER-AUTO{activeImageIndex + 1}
      </div>

      {/* 右下角系统化数据面板 - 改为固定位置 */}
      <div style={{
        position: 'fixed',
        top: containerRect.top + containerRect.height - 170, // 预估高度
        left: containerRect.left + containerRect.width - 270, // 预估宽度
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid #FF732C',
        padding: '15px',
        color: '#FF732C',
        fontFamily: 'monospace',
        borderRadius: '4px',
        maxWidth: '250px',
        // boxShadow: '0 0 15px rgba(255, 115, 44, 0.3)',
        fontSize: '12px',
        zIndex: 52,
        pointerEvents: 'none'
      }}>
        {/* 系统化数据面板顶部 */}
        <div style={{
          position: 'absolute',
          top: '-1px',
          left: '15px',
          right: '15px',
          height: '4px',
          background: '#000',
          zIndex: 1
        }}>
          <div style={{
            position: 'absolute',
            top: '0',
            left: '10px',
            color: '#FF732C',
            fontSize: '10px',
            background: '#000',
            padding: '0 8px',
            transform: 'translateY(-50%)'
          }}>系统数据</div>
        </div>

        {/* 数据指标 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: '15px 0 10px 0',
          alignItems: 'center'
        }}>
          <span>生产效率</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <div style={{
              width: '80px',
              height: '8px',
              background: 'rgba(255, 115, 44, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, 70 + activeImageIndex * 5)}%`, // 限制最大值为100%
                height: '100%',
                background: '#FF732C'
              }}></div>
            </div>
            <span>{Math.min(100, 70 + activeImageIndex * 5)}%</span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: '8px 0',
          alignItems: 'center'
        }}>
          <span>能源状态</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#FF732C',
              animation: 'pulse 2s infinite'
            }}></div>
            <span>稳定</span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: '8px 0',
          alignItems: 'center'
        }}>
          <span>生物活性</span>
          <span>{Math.min(100, 90 + activeImageIndex)}%</span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: '8px 0',
          alignItems: 'center'
        }}>
          <span>系统温度</span>
          <span>{21 + activeImageIndex}°C</span>
        </div>

        {/* 系统化装饰线 */}
        <div style={{
          width: '100%',
          height: '1px',
          background: '#FF732C',
          margin: '12px 0',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '30%',
            height: '100%',
            background: '#fff',
            animation: 'moveLight 3s infinite linear'
          }}></div>
        </div>

        <div style={{
          fontSize: '10px',
          textAlign: 'right',
          opacity: 0.7
        }}>
          最后更新: {(() => {
            const futureDate = new Date(clickTime);
            futureDate.setFullYear(futureDate.getFullYear() + 100);
            return `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')} ${String(futureDate.getHours()).padStart(2, '0')}:${String(futureDate.getMinutes()).padStart(2, '0')}:${String(futureDate.getSeconds()).padStart(2, '0')}`;
          })()}
        </div>
      </div>

      {/* 滚动提示 */}
      <div style={{
        position: 'fixed', // 改为fixed以确保始终在可视区域
        bottom: '100px', // 离底部更近
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#FF732C', // 使用统一的橙色
        fontSize: '12px',
        fontFamily: 'monospace',
        padding: '8px 15px',
        borderRadius: '15px',
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid #FF732C', // 使用统一的橙色边框
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInOut 3s infinite',
        zIndex: 55,
        pointerEvents: 'none'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#FF732C', // 使用统一的橙色
          animation: 'pulse 2s infinite'
        }}></div>
        <span>SCROLL TO VIEW CONTENT</span>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={handleCloseActiveImage}
        style={{
          position: 'fixed',
          top: '70px', // 调整为距离顶部70px，因为顶部栏现在是60px高
          right: '20px',
          background: 'rgba(0,0,0,0.8)',
          color: '#FF732C',
          border: '1px solid #FF732C',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 52,
          boxShadow: '0 0 15px rgba(255, 115, 44, 0.3)', // 添加阴影效果以与整体风格一致
        }}
      >
        ×
      </button>
    </div>
  );
};

export default ImageDetailModal;