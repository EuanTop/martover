import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const PotatoGrid = ({ potatoes = [] }) => {
  const { isDarkMode } = useTheme();
  const [filter, setFilter] = useState('');
  const [showSpecialOnly, setShowSpecialOnly] = useState(false);

  // 过滤土豆
  const filteredPotatoes = potatoes
    .filter(potato => 
      !showSpecialOnly || potato.hasSpecialFeature
    )
    .filter(potato => 
      filter === '' || 
      potato.specialParam.toLowerCase().includes(filter.toLowerCase()) ||
      potato.englishDescription.toLowerCase().includes(filter.toLowerCase())
    );

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-orange-50 text-gray-800'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">火星土豆品种库</h1>
          <Link 
            to="/" 
            className={`px-4 py-2 rounded-lg ${
              isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
            } text-white transition-colors`}
          >
            返回火星
          </Link>
        </div>
        
        {/* 过滤控件 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="搜索参数或描述..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            } border`}
          />
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showSpecialOnly}
              onChange={() => setShowSpecialOnly(!showSpecialOnly)}
              className="w-5 h-5"
            />
            <span>仅显示特殊品种</span>
          </label>
        </div>
        
        {/* 土豆网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredPotatoes.map(potato => (
            <div 
              key={potato.id}
              className={`p-5 rounded-lg ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              } shadow-md ${
                potato.hasSpecialFeature ? 
                  isDarkMode ? 'border-2 border-yellow-500' : 'border-2 border-orange-500' : ''
              }`}
            >
              <h3 className="text-xl font-semibold mb-2">{potato.specialParam}</h3>
              
              {potato.hasSpecialFeature && (
                <div className={`inline-block px-2 py-1 rounded text-xs mb-3 ${
                  isDarkMode ? 'bg-yellow-600 text-white' : 'bg-orange-500 text-white'
                }`}>
                  特殊品种
                </div>
              )}
              
              <p className="mb-4 text-sm">
                {potato.specialParamDetails || '无详细描述'}
              </p>
              
              <div className={`mt-4 pt-4 border-t ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h4 className="text-sm font-medium mb-1">英文描述</h4>
                <p className="text-sm italic opacity-80">
                  {potato.englishDescription}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {filteredPotatoes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xl">没有找到匹配的土豆品种</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PotatoGrid;