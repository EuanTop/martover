import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// 将 LoadingMessage 组件移到 Canvas 外部使用
const LoadingMessage = ({ children }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-black/70 text-white/90 px-4 py-2 rounded-lg backdrop-blur-sm">
      {children}
    </div>
  </div>
);

const PotatoDataProvider = ({ children, onDataLoaded }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Papa.parse('/mars_potato_properties.csv', {
      download: true,
      header: true,
      // preview: 30,
      complete: (results) => {
        const potatoes = results.data
          .filter(row => {
            if (!row || Object.keys(row).length <= 1) return false;
            return row.specialParam && row.englishDescription;
          })
          .map((row, index) => ({
            id: index + 1,
            specialParam: row.specialParam || '未知参数',
            specialParamDetails: row.specialParamDetails || '',
            specialParamEn: row.specialParamEn || '',
            specialParamDetailsEn: row.specialParamDetailsEn || '',
            englishDescription: row.englishDescription || 'No description available',
            hasSpecialFeature: row.hasSpecialFeature === "1" || 
                             row.hasSpecialFeature === 1 || 
                             row.hasSpecialFeature === "true" || 
                             row.hasSpecialFeature === true
          }))
          .filter(potato => potato.specialParam && potato.englishDescription);

        onDataLoaded(potatoes);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('CSV解析错误:', error);
        setError(error);
        setIsLoading(false);
      }
    });
  }, [onDataLoaded]);

  if (isLoading || error) {
    return <LoadingMessage>
      {error ? `数据加载失败: ${error.message}` : '正在加载土豆数据...'}
    </LoadingMessage>;
  }

  return children;
};

export default PotatoDataProvider;