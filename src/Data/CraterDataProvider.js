import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { normalizeCraterRows } from '../game/data/craterRows';

const LoadingMessage = ({ children }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-black/70 text-white/90 px-4 py-2 rounded-lg backdrop-blur-sm">
      {children}
    </div>
  </div>
);

const CraterDataProvider = ({ children, onDataLoaded }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Papa.parse('/descending_after_processed_sorted.csv', {
      download: true,
      header: true,
      preview: 30,
      complete: (results) => {
        onDataLoaded(normalizeCraterRows(results.data));
        setIsLoading(false);
      },
      error: (error) => {
        setError(error);
        setIsLoading(false);
      }
    });
  }, [onDataLoaded]);

  if (isLoading || error) {
    return <LoadingMessage>
      {error ? `数据加载失败: ${error.message}` : '正在加载火星坑数据...'}
    </LoadingMessage>;
  }

  return children;
};

export default CraterDataProvider;