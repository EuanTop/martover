import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import VisShape from '../../Components/VisShape/VisShape';
import html2canvas from 'html2canvas';
import { generateCraterImages } from '../../CraterImageGenerator';
import { Spin, Pagination } from 'antd'; 
import { OverlayBackground } from '../../Components/OverlayLayers';
import Panel from '../../Components/Panel'; // 新增导入
import RdOverlaySvg from '../../Components/RdOverlay/RdOverlaySvg';
import ProgressBar from '../../Components/ProgressBar';
import Button from '../../Components/common/Button/Button';

const CraterGrid = ({ craters, isDarkMode }) => {
  const [selectedCrater, setSelectedCrater] = useState(null);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [progressStep] = useState(1); // 固定显示第一关

    // 计算当前页数据
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentCraters = craters.slice(startIndex, endIndex);
  
    // 分页变化处理
    const handlePageChange = (page, size) => {
      setCurrentPage(page);
      setPageSize(size);
      setSelectedCrater(null); // 切换分页时重置选中状态
    };

  useEffect(() => {
    if (isFirstVisit) {
      const timer = setTimeout(() => {
        setLoading(false);
        setIsFirstVisit(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [isFirstVisit]);

  const handleDownload = async (event) => {
    event.preventDefault();
    
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    document.body.appendChild(notification);

    try {
      notification.textContent = '正在生成图片...';
      await generateCraterImages(craters);
      notification.textContent = '导出完成！';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    } catch (error) {
      console.error('Export error:', error);
      notification.textContent = '导出失败，请检查控制台';
    }
  };

  const handleCraterClick = (crater) => {
    setSelectedCrater(selectedCrater?.id === crater.id ? null : crater);
  };

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? 'bg-black text-white' : 'bg-[#F57435] text-black'}`}>
      <ProgressBar currentStep={progressStep} />
      {/* 顶层蒙版 */}
      <OverlayBackground />

      {/* 返回按钮 */}
      <Link 
        to="/?skipIntro=true" 
        className="fixed top-5 left-5 z-50"
        aria-label="返回"
      >
        <Button variant="glass" size="icon" isDarkMode={isDarkMode}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Button>
      </Link>

      {/* 下载按钮 */}
      {/* <button
        onClick={handleDownload}
        className={`fixed top-5 right-5 z-50 p-2 ${isDarkMode ? 'text-white' : 'text-black'} 
                    bg-gray-500/25 backdrop-blur-lg rounded-lg transition-colors`}
        aria-label="下载所有图片"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button> */}

      {/* 选中的陨石坑信息面板 */}
      {selectedCrater && (
        <Panel isDarkMode={isDarkMode} onClose={() => setSelectedCrater(null)} selectedCrater={selectedCrater} />
      )}

      {/* 网格布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-16">
        {currentCraters.map((crater, index) => (
          <div 
            key={index}
            className={`relative aspect-square ${isDarkMode ? 'bg-gray-900/50 border border-white' : 'bg-[#F16B28] border border-black'} rounded-lg p-4 backdrop-blur-lg `}
            onClick={() => handleCraterClick(crater)}
          >
            <RdOverlaySvg visible={crater.hasRd} />

            {/* 溅射物形态和坑内形态 */}
            <div className="absolute top-2 left-2 text-xs" style={{ color: isDarkMode ? 'white' : 'black' }}>
              {crater.layerMorph?.length > 0 && (
                <div>
                  {/* 溅射物形态 */}
                  <span className="font-medium">
                    {crater.layerMorph.join(', ')}
                  </span>
                </div>
              )}
              {crater.internalMorph?.length > 0 && (
                <div>
                  {/* 坑内形态 */}
                  <div>{crater.internalMorph.join(', ')}</div>
                </div>
              )}
            </div>

            {/* 层数显示 */}
            {crater.layerNumber && (
              <div className="absolute top-2 right-2 text-2xl font-cursive" style={{ color: isDarkMode ? 'white' : 'black' }}>
                {crater.layerNumber}
              </div>
            )}

            <div className="absolute bottom-1 left-2 text-xs" style={{ color: isDarkMode ? 'white' : 'black' }}>
              <div style={{ marginBottom: '-2px' }}>ID: {crater.id}</div>
              <div style={{ marginBottom: '-2px' }}>Location: {crater.latitude.toFixed(2)}°N, {crater.longitude.toFixed(2)}°E</div>
              <div style={{ marginBottom: '-2px' }}>Diameter: {crater.diameter?.toFixed(2)} km</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <VisShape crater={crater} disableAnimations={true} isDarkMode={isDarkMode} size={0.8} />
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className={`fixed inset-0 flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-[#F57435]'}`}>
          <Spin size="large" style={{ color: isDarkMode ? 'white' : 'black' }} />
        </div>
      )}

<div className={`flex justify-center mt-6 ${isDarkMode ? 'bg-black p-2 rounded-lg' : ''}`}>
  <Pagination
    current={currentPage}
    pageSize={pageSize}
    total={craters.length}
    onChange={handlePageChange}
    showSizeChanger={false}
    className={`[&_.ant-pagination-item]:mx-1 [&_.ant-pagination-item]:min-w-[32px]
      [&_.ant-pagination-item]:rounded [&_.ant-pagination-item]:border
      [&_.ant-pagination-item]:border-opacity-100 
      ${
        isDarkMode 
          ? `[&_.ant-pagination-item]:border-white
             hover:[&_.ant-pagination-item]:border-white/80
             [&_.ant-pagination-item]:bg-black
             [&_.ant-pagination-item]:text-white
             hover:[&_.ant-pagination-item]:bg-gray-700` 
          : `[&_.ant-pagination-item]:border-black
             hover:[&_.ant-pagination-item]:border-black/80
             [&_.ant-pagination-item]:bg-[#FF722C]
             [&_.ant-pagination-item]:text-black
             hover:[&_.ant-pagination-item]:bg-[#FF8F5E]`
      }`}
    itemRender={(current, type, element) => (
      <div className={`${
        isDarkMode
          ? '[&_.ant-pagination-item-active]:bg-[#585858]'
          : '[&_.ant-pagination-item-active]:bg-[#FFEDCB]'
      }`}>
        {type === 'page' ? current : element}
      </div>
    )}
  />
</div>
    </div>
  );
};

export default CraterGrid;