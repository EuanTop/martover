import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

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
        const craters = results.data
          .map(row => ({
            id: row.CRATER_ID,
            latitude: parseFloat(row.LAT_CIRC_IMG),
            longitude: parseFloat(row.LON_CIRC_IMG),
            diameter: parseFloat(row.DIAM_CIRC_IMG),
            diameterSD: parseFloat(row.DIAM_CIRC_SD_IMG),
            arc: parseFloat(row.ARC_IMG),
            layerNumber: parseInt(row.LAY_NUMBER),  // 确保转换为数字
            layerMorph: [row.LAY_MORPH1, row.LAY_MORPH2, row.LAY_MORPH3].filter(Boolean),
            layerNotes: row.LAY_NOTES,
            internalMorph: [row.INT_MORPH1].filter(Boolean),
            rimDegradation: row.DEG_RIM,
            ejectaDegradation: row.DEG_EJC,
            floorDegradation: row.DEG_FLR,
            ejcSvg: [row.ejc_svg_1, row.ejc_svg_2, row.ejc_svg_3].filter(Boolean),
            hasRd: row.hasRd === "1" || row.hasRd === 1 || row.hasRd === "true" || row.hasRd === true, // 根据实际数据类型调整（布尔值或字符串）
          }))
          .filter(crater => !isNaN(crater.latitude) && !isNaN(crater.longitude));

        onDataLoaded(craters);
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