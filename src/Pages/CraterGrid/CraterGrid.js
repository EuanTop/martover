import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../Components/common/Button/Button';

const CraterGrid = ({ craters = [] }) => {
  const { isDarkMode } = useTheme();
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');

  // 过滤和排序陨石坑
  const filteredCraters = craters
    .filter(crater => 
      crater.id.toString().includes(filter) || 
      (crater.internalMorph && crater.internalMorph.some(morph => 
        morph.toLowerCase().includes(filter.toLowerCase())
      ))
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'id':
          comparison = parseInt(a.id) - parseInt(b.id);
          break;
        case 'diameter':
          comparison = a.diameter - b.diameter;
          break;
        case 'latitude':
          comparison = a.latitude - b.latitude;
          break;
        case 'longitude':
          comparison = a.longitude - b.longitude;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark-mode bg-black text-orange-100' : 'bg-orange-50 text-gray-800'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-orange-200 drop-shadow-lg' : ''}`}>
            火星陨石坑数据库
          </h1>
          <Link 
            to="/?skipIntro=true" 
            className=""
          >
            <Button variant="glass" size="default" isDarkMode={isDarkMode}>
              返回火星
            </Button>
          </Link>
        </div>
        
        {/* 过滤和排序控件 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="搜索ID或内部形态..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-gray-900/80 border-orange-400/30 text-orange-100 placeholder-orange-300/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30' 
                : 'bg-white border-gray-300'
            } border transition-all duration-200`}
          />
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-gray-900/80 border-orange-400/30 text-orange-100 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30' 
                : 'bg-white border-gray-300'
            } border transition-all duration-200`}
          >
            <option value="id">按ID排序</option>
            <option value="diameter">按直径排序</option>
            <option value="latitude">按纬度排序</option>
            <option value="longitude">按经度排序</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={`px-4 py-2 rounded-lg ${
              isDarkMode 
                ? 'bg-gray-900/80 border-orange-400/30 text-orange-100 hover:bg-orange-500/20 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            } border transition-all duration-200`}
          >
            {sortOrder === 'asc' ? '升序' : '降序'}
          </button>
        </div>
        
        {/* 陨石坑网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCraters.map(crater => (
            <div 
              key={crater.id}
              className={`p-4 rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-900/60 hover:bg-gray-800/80 border border-orange-400/20 hover:border-orange-400/40 shadow-lg shadow-black/20 hover:shadow-orange-500/10' 
                  : 'bg-white hover:bg-orange-100 shadow-md'
              } transition-all duration-200`}
            >
              <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-orange-200' : ''}`}>
                ID: {crater.id}
              </h3>
              <div className={`space-y-1 text-sm ${isDarkMode ? 'text-orange-100/80' : ''}`}>
                <p>位置: {crater.latitude.toFixed(2)}°N, {crater.longitude.toFixed(2)}°E</p>
                <p>直径: {crater.diameter?.toFixed(2)} km</p>
                {crater.internalMorph?.length > 0 && (
                  <p>内部形态: {crater.internalMorph.join(', ')}</p>
                )}
                {crater.hasRd && (
                  <p className={`font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-500'}`}>
                    射线坑
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {filteredCraters.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xl">没有找到匹配的陨石坑</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CraterGrid;