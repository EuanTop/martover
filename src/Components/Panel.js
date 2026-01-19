import React, { useState, forwardRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import VisShape from './VisShape/VisShape';
import { OverlayBackground } from './OverlayLayers';
import { FigCrater, FigCraterIntMorph } from './Illustrations';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import RdOverlaySvg from './RdOverlay/RdOverlaySvg';
import Button from './common/Button/Button';

// 优化后的退化程度可视化组件 - 使用圆形进度指示器
const DegradationIndicator = ({ value, label, isDarkMode }) => {
  const numValue = parseInt(value) || 0;
  const maxValue = 5;
  
  return (
    <div className="flex flex-col items-center space-y-1">
      <div className="font-medium" style={{ color: isDarkMode ? 'white' : '#562913' }}>
        {label}
      </div>
      <div className="font-medium" style={{ color: isDarkMode ? 'white' : '#562913' }}>
        {value || '0'}
      </div>
    </div>
  );
};

// 优化后的确认对话框组件 - 与Panel样式保持一致
const ConfirmDialog = ({ visible, onConfirm, onCancel, craterName, isDarkMode }) => {
  if (!visible) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-[1100]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      
      {/* 对话框主体 - 平面风格 */}
      <div className="relative border max-w-sm mx-4 bg-[#F57535]"
           style={{ borderColor: '#000000' }}>
        <div className="p-6">
          <div className="text-center">
            <h3 className="text-lg mb-4" 
                style={{ color: '#000000' }}>
              确认选择陨石坑
            </h3>
            <p className="mb-6" style={{ color: '#000000' }}>
              您确定要选择陨石坑 <strong>{craterName}</strong> 吗？
            </p>
            
            <div className="flex space-x-4 justify-center">
              <button
                onClick={onCancel}
                className="px-4 py-2 border hover:opacity-80 transition-opacity bg-[#EA7036]"
                style={{ 
                  borderColor: '#000000',
                  color: '#000000'
                }}
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 border hover:opacity-90 transition-opacity"
                style={{ 
                  backgroundColor: '#F58753',
                  color: '#000000',
                  borderColor: '#000000'
                }}
              >
                确认选择
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

// 独立弹窗组件（使用Portal）
const CustomModal = ({ visible, onClose, isDarkMode }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;

  if (!visible) return null;

  const arrowStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '24px',
    color: isDarkMode ? 'white' : '#562913',
    cursor: 'pointer',
    zIndex: 1001
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-[1000]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 弹窗主体 */}
      <div className={`w-[50vw] min-w-[480px] h-[50vh] rounded-lg border ${
        isDarkMode ? 'bg-gray-800 border-white' : 'bg-[#FF722C]'
      } p-5 flex flex-col relative overflow-hidden`}
      style={{ borderColor: isDarkMode ? 'white' : '#562913' }}>
        
        {/* 翻页箭头 */}
        {currentPage > 1 && (
          <LeftOutlined 
            style={{ ...arrowStyle, left: 20 }}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          />
        )}
        {currentPage < totalPages && (
          <RightOutlined 
            style={{ ...arrowStyle, right: 20 }}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          />
        )}

        {/* 头部 */}
        <div className="flex justify-between items-center mb-5">
          <h2 className={`text-lg ${isDarkMode ? 'text-white' : ''}`}
              style={{ color: isDarkMode ? 'white' : '#562913' }}>
            图例 {currentPage}
          </h2>
          <button
            onClick={onClose}
            className="hover:opacity-80 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: isDarkMode ? 'white' : '#562913' }}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-grow flex items-center justify-center overflow-auto">
          {currentPage === 1 ? (
            <FigCrater isDarkMode={isDarkMode} disableAnimations={false} />
          ) : (
            <div className="w-full h-[90%] p-4">
              <FigCraterIntMorph isDarkMode={isDarkMode} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

// 修改后的 Panel 组件，拆分成三个独立的框
const Panel = forwardRef(({ isDarkMode, onClose, selectedCrater, onSelectCrater, canSelectCrater, disableClose = false, isHomePage = false }, ref) => {
  const [showLegend, setShowLegend] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSelectClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmSelect = () => {
    setShowConfirm(false);
    if (onSelectCrater) {
      onSelectCrater();
    }
  };

  const handleCancelSelect = () => {
    setShowConfirm(false);
  };

  return (
    <div 
      ref={ref}
      className="fixed top-5 right-5 z-50 w-[50vw] md:w-[35vw] lg:w-[25vw] xl:w-[20vw]"
    >
      {/* 外层大框 - #562913 描边 */}
      <div className="border p-1 flex flex-col space-y-2 bg-transparent"
           style={{ borderColor: '#562913',
           backgroundColor: isDarkMode ? 'white' : (isHomePage ? 'transparent' : '#F57535') // 主页LightMode透明，其他页面保持原色
            }}>
        
        {/* 第一个框：基本信息 */}
        <div className={`relative`}
             style={{ borderColor: isDarkMode ? 'white' : '#562913' }}>
          {/* 关闭按钮 - 当disableClose为true时隐藏 */}
          {!disableClose && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("[Panel] 点击关闭按钮，调用onClose回调");
                if (typeof onClose === 'function') {
                  onClose();
                } else {
                  console.error("[Panel] onClose 不是一个有效的函数");
                }
              }}
              className="absolute top-0 right-1 z-20 p-2 hover:opacity-80 transition-opacity"
              aria-label="关闭"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: isDarkMode ? '#e5e5e5' : '#562913' }}
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* ID显示 - 左上角大字体 */}
          <div className="absolute top-2 left-2 z-20">
            <div className="text-xl"
                 style={{ color: isDarkMode ? '#e5e5e5' : '#562913' }}>
              ID: {selectedCrater.id}
            </div>
          </div>

          <div className="p-4 pt-12">
            <div className="space-y-3 text-sm" style={{ color: isDarkMode ? 'white' : '#562913' }}>
                位置: {selectedCrater.latitude.toFixed(2)}°N, {selectedCrater.longitude.toFixed(2)}°E <br/>
                直径: {selectedCrater.diameter?.toFixed(2)} km ± {selectedCrater.diameterSD?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 第二个框：可视化 */}
        <div className={`border backdrop-blur-lg relative ${isDarkMode ? 'border-white' : ''}`}
             style={{ borderColor: isDarkMode ? 'white' : '#562913' }}>
          {/* 图例按钮 - 移至中间框左上角 */}
          <button
            onClick={() => setShowLegend(true)}
            className="absolute top-2 left-2 z-20 p-2 hover:opacity-80 transition-opacity"
            aria-label="图例"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: isDarkMode ? '#e5e5e5' : '#562913' }}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </button>

          <div className="relative w-full p-4">
            <OverlayBackground />
            <RdOverlaySvg visible={selectedCrater.hasRd} />

            <div className={`w-full ${selectedCrater.internalMorph?.[0] === 'Bsn' ? 'aspect-[2/1]' : 'aspect-square'
              } flex items-center justify-center relative`}>
              <div className="w-[85%] h-[85%] relative z-0">
                <VisShape crater={selectedCrater} />
              </div>
            </div>
          </div>
        </div>

        {/* 第三个框：详细数据 */}
        <div className={`border relative ${isDarkMode ? 'border-white' : ''}`}
             style={{ borderColor: isDarkMode ? 'white' : '#562913' }}>
          <div className="p-4">
            <div className="space-y-3 text-sm" style={{ color: isDarkMode ? 'white' : '#562913' }}>
              {selectedCrater.layerNumber && (
                <div className="flex justify-between">
                  <span>层数:</span>
                  <span className="font-medium">{selectedCrater.layerNumber}</span>
                </div>
              )}

              {selectedCrater.layerMorph?.length > 0 && (
                <div className="flex justify-between">
                  <span>溅射物形态:</span>
                  <span className="font-medium">{selectedCrater.layerMorph.join(', ')}</span>
                </div>
              )}

              {selectedCrater.internalMorph?.length > 0 && (
                <div className="flex justify-between">
                  <span>坑内形态:</span>
                  <span className="font-medium">{selectedCrater.internalMorph.join(', ')}</span>
                </div>
              )}
              
              {selectedCrater.hasRd !== undefined && (
                <div className="flex justify-between">
                  <span>射线坑:</span>
                  <span className="font-medium">{selectedCrater.hasRd ? '是' : '否'}</span>
                </div>
              )}

              {/* 退化程度 - 紧凑单行 */}
              <div className="flex justify-between text-xs pt-2">
                <span>边缘退化: {selectedCrater.rimDegradation || '0'}</span>
                <span>溅射物: {selectedCrater.ejectaDegradation || '0'}</span>
                <span>底部: {selectedCrater.floorDegradation || '0'}</span>
              </div>

              {selectedCrater.layerNotes && (
                <div className="pt-2 text-xs">
                  <span className="opacity-70">备注: </span>
                  <span className="opacity-90 italic">{selectedCrater.layerNotes}</span>
                </div>
              )}
            </div>

            {/* 优化后的选坑按钮 - 移除黑线，使用黑色字体 */}
            {canSelectCrater && (
              <div
                className="w-full mt-4 cursor-pointer transition-all duration-200"
                style={{ 
                  backgroundColor: '#F2A888',
                  border: '1px solid #562913',
                }}
                onClick={handleSelectClick}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#F58753';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#FFBB97';
                }}
              >
                <div className="py-4 text-center">
                  <div className="text-xl tracking-wide hover:scale-105 transition-transform duration-200"
                       style={{ 
                         pointerEvents: 'none',
                         color: '#562913'  // 改为深棕色字体
                       }}>
                    选择此陨石坑
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomModal
        visible={showLegend}
        onClose={() => setShowLegend(false)}
        isDarkMode={isDarkMode}
      />

      <ConfirmDialog
        visible={showConfirm}
        onConfirm={handleConfirmSelect}
        onCancel={handleCancelSelect}
        craterName={selectedCrater.id}
        isDarkMode={isDarkMode}
      />
    </div>
  );
});

Panel.displayName = 'Panel';

export default Panel;