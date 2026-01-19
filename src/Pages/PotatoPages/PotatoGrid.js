import React, { useState, useEffect } from 'react';
import { Spin, Pagination } from 'antd';
import { OverlayBackground  } from '../../Components/OverlayLayers'
import PotatoPlanet from './PotatoPlanet';

import { Canvas } from '@react-three/fiber';

const PotatoContainer = React.memo(({ potato, isDarkMode, onClick }) => {
  // 添加一个独立的实例ID状态
  const instanceId = React.useId();
  
  return (
    <div 
      className={`relative ${
        isDarkMode ? 'bg-gray-900/50 border border-white' : 'bg-[#F16B28] border border-black'
      } rounded-lg p-4 backdrop-blur-lg cursor-pointer h-[300px]`}
      onClick={onClick}
    >
      <div className="absolute top-2 left-2 text-xs z-10" style={{ color: isDarkMode ? 'white' : 'black' }}>
        <div className="font-medium">{potato.specialParamEn}</div>
        <div>{potato.specialParamDetailsEn}</div>
      </div>

      <div className="absolute bottom-2 left-2 text-xs z-10" style={{ color: isDarkMode ? 'white' : 'black' }}>
        <div>ID: {potato.id}</div>
        <div>{potato.specialParam}</div>
        <div>{potato.specialParamDetails}</div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full" id={`container-${instanceId}`}>
          <React.Suspense fallback={null}>
            <PotatoPlanet 
              key={`potato-${potato.id}`}
              description={potato.englishDescription} 
            />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 添加比较函数来优化重渲染
  return (
    prevProps.potato.id === nextProps.potato.id &&
    prevProps.isDarkMode === nextProps.isDarkMode
  );
});

const PotatoGrid = ({ potatoes, isDarkMode }) => {
  const [selectedPotato, setSelectedPotato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // 计算当前页数据
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPotatoes = potatoes.slice(startIndex, endIndex);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 分页变化处理
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
    setSelectedPotato(null);
  };

  const handlePotatoClick = (potato) => {
    setSelectedPotato(selectedPotato?.id === potato.id ? null : potato);
  };

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? 'bg-black text-white' : 'bg-[#F57435] text-black'}`}>
      <OverlayBackground />

      {/* 网格布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pt-16">
        {currentPotatoes.map((potato, index) => (
          <PotatoContainer
            key={`potato-container-${potato.id}-${index}`}
            potato={potato}
            isDarkMode={isDarkMode}
            onClick={() => handlePotatoClick(potato)}
          />
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
          total={potatoes.length}
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
        />
      </div>
    </div>
  );
};

export default PotatoGrid;