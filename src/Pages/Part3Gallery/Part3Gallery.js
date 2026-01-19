import React, { useEffect, useState, useRef } from 'react';
import ProgressBar from '../../Components/ProgressBar';
import { useCursorStore } from '../../store';

// 导入拆分后的组件
import BackgroundCanvas from './BackgroundCanvas';
import PixelEffectCanvas from './PixelEffectCanvas';
import GalleryImages from './GalleryImages';
import ImageDetailModal from './ImageDetailModal';
import HeaderUI from './HeaderUI';
import FooterUI from './FooterUI';
import SystemIndicators from './SystemIndicators';
import Rock from './Rock';

// 获取当前年份+100年
const getFutureYear = () => {
  return new Date().getFullYear() + 100;
};

// 加载中组件
const LoadingScreen = ({ progress }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  }}>
    <div style={{
      color: '#FF732C',
      fontSize: '20px',
      fontFamily: 'monospace',
      marginBottom: '20px'
    }}>
      MARTOVER 自动化生产系统 // 资源加载中
    </div>
    <div style={{
      width: '300px',
      height: '8px',
      background: 'rgba(255, 115, 44, 0.2)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '10px'
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        background: '#FF732C',
        transition: 'width 0.3s'
      }}></div>
    </div>
    <div style={{
      color: '#FF732C',
      fontSize: '14px',
      fontFamily: 'monospace',
    }}>
      {Math.round(progress)}% 完成
    </div>
    <div style={{
      width: '15px',
      height: '15px',
      background: '#FF732C',
      borderRadius: '50%',
      marginTop: '20px',
      animation: 'pulse 2s infinite'
    }}></div>
  </div>
);

// 主画廊组件
function Part3Gallery() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(null); // 记录当前激活的图片
  const [hoverIndex, setHoverIndex] = useState(null); // 记录当前悬停的图片
  const containerRef = useRef(null);
  const setCursorType = useCursorStore(state => state.setType); // 引用Cursor状态
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  const imgCount = 6;
  const imgs = Array.from({ length: imgCount }, (_, i) => `/imgs/part3/${i + 1}.jpg`);

  // 预加载所有图片
  useEffect(() => {
    // 确保 localStorage 设置为第3步
    localStorage.setItem('mars-progress-step', '3');

    // 预加载所有图片和资源
    const preloadImages = async () => {
      let loadedCount = 0;
      
      // 创建加载承诺数组
      const imagePromises = imgs.map((src) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            loadedCount++;
            setLoadingProgress((loadedCount / imgs.length) * 100);
            resolve();
          };
          img.onerror = (err) => reject(err);
        });
      });
      
      try {
        await Promise.all(imagePromises);
        // 所有图片加载完成
        setImagesLoaded(true);
        // 稍等一下再显示内容，让用户看到100%加载完成的状态
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('图片预加载错误:', error);
        // 即使有错误也允许进入，但显示警告
        alert('部分资源加载失败，页面可能无法正常显示。');
        setIsLoading(false);
      }
    };

    // 检查是否为移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    preloadImages();

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 处理图片点击事件
  const handleImageClick = (index) => {
    if (activeImageIndex === index) {
      // 如果点击的是已经激活的图片，则关闭它
      setActiveImageIndex(null);
    } else {
      // 否则激活这张图片
      setActiveImageIndex(index);
    }
  };

  // 关闭激活的图片
  const handleCloseActiveImage = () => {
    setActiveImageIndex(null);
    // 恢复页面原始滚动状态
    document.body.style.overflow = 'hidden';
  };

  // 鼠标悬停处理函数
  const handlePointerOver = (index) => {
    setCursorType('hover');
    setHoverIndex(index);
  };

  const handlePointerOut = () => {
    setCursorType('default');
    setHoverIndex(null);
  };

  // 如果还在加载中，显示加载界面
  if (isLoading) {
    return <LoadingScreen progress={loadingProgress} />;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
      }}
    >
      {/* 背景元素 */}
      <BackgroundCanvas />
      <PixelEffectCanvas />
      
      {/* Rock着色器作为背景 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.4, zIndex: 1 }}>
        <Rock />
      </div>

      {/* 界面UI元素 */}
      <HeaderUI />
      <ProgressBar currentStep={3} isDarkMode={true} />

      {/* 图片画廊 */}
      <GalleryImages 
        imgs={imgs}
        hoverIndex={hoverIndex}
        handleImageClick={handleImageClick}
        handlePointerOver={handlePointerOver}
        handlePointerOut={handlePointerOut}
      />

      {/* 图片详情模态窗 */}
      {activeImageIndex !== null && (
        <ImageDetailModal
          activeImageIndex={activeImageIndex}
          imgs={imgs}
          handleCloseActiveImage={handleCloseActiveImage}
          handlePointerOver={handlePointerOver}
          handlePointerOut={handlePointerOut}
          getFutureYear={getFutureYear}
        />
      )}

      {/* 底部UI */}
      <FooterUI />
      <SystemIndicators getFutureYear={getFutureYear} />

      {/* CSS动画 */}
      <style>
        {`
        @keyframes pulse {
            0% { opacity: 0.6; box-shadow: 0 0 5px #FF732C; }
            50% { opacity: 1; box-shadow: 0 0 15px #FF732C; }
            100% { opacity: 0.6; box-shadow: 0 0 5px #FF732C; }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 0.9; }
        }
        
        @keyframes blink {
            0% { opacity: 0.4; }
            50% { opacity: 1; }
            100% { opacity: 0.4; }
        }
        
        @keyframes moveLight {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
        }
        
        @keyframes scan {
            0% { transform: translateY(-100%); opacity: 0; }
            50% { opacity: 0.8; }
            100% { transform: translateY(100%); opacity: 0; }
        }
        
        @keyframes fadeInOut {
            0% { opacity: 0.3; }
            50% { opacity: 1; }
            100% { opacity: 0.3; }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* 自定义滚动条样式 */
        *::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        
        *::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.3);
        }
        
        *::-webkit-scrollbar-thumb {
            background: #FF732C;
            border-radius: 3px;
        }
        
        *::-webkit-scrollbar-thumb:hover {
            background: #F57435;
        }
        `}
      </style>
    </div>
  );
}

export default Part3Gallery;