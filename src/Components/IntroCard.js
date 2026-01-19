import React from 'react';
import TypeShuffleText from './TypeShuffle/TypeShuffle';

const IntroCard = ({ content, isDarkMode, onNext, onPrev, isFirst, isLast, showExplore }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div 
        className="w-[80vw] max-w-2xl p-8 rounded-lg shadow-lg backdrop-blur-md"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          border: `1px solid ${isDarkMode ? '#ffffff33' : '#00000033'}`
        }}
      >
        <div className="whitespace-pre-line mb-8">
          <TypeShuffleText 
            text={content} 
            className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-800'}`}
          />
        </div>
        
        <div className="flex justify-between">
          {!isFirst ? (
            <button 
              onClick={onPrev}
              className={`px-4 py-2 rounded ${
                isDarkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              } transition-colors`}
            >
              上一页
            </button>
          ) : <div></div>}
          
          {!isLast ? (
            <button 
              onClick={onNext}
              className={`px-4 py-2 rounded ${
                isDarkMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-500' 
                  : 'bg-orange-500 text-white hover:bg-orange-400'
              } transition-colors`}
            >
              下一页
            </button>
          ) : (
            <button 
              onClick={onNext}
              className={`px-4 py-2 rounded ${
                isDarkMode 
                  ? 'bg-green-600 text-white hover:bg-green-500' 
                  : 'bg-orange-600 text-white hover:bg-orange-500'
              } transition-colors ${showExplore ? 'animate-pulse' : ''}`}
            >
              开始探索
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntroCard;