import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as THREE from 'three';

export const useDataLoader = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('正在准备加载数据...');
  const [loadError, setLoadError] = useState(null);
  const [craterData, setCraterData] = useState({ preview: [], full: [] });
  const [potatoData, setPotatoData] = useState([]);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        
        // 加载火星坑数据
        setLoadingStatus('正在加载火星坑数据...');
        const cratersPromise = new Promise((resolve, reject) => {
          Papa.parse('/descending_after_processed_sorted.csv', {
            download: true,
            header: true,
            complete: (results) => {
              const allCraters = results.data
                .map(row => ({
                  id: row.CRATER_ID,
                  latitude: parseFloat(row.LAT_CIRC_IMG),
                  longitude: parseFloat(row.LON_CIRC_IMG),
                  diameter: parseFloat(row.DIAM_CIRC_IMG),
                  diameterSD: parseFloat(row.DIAM_CIRC_SD_IMG),
                  arc: parseFloat(row.ARC_IMG),
                  layerNumber: parseInt(row.LAY_NUMBER),
                  layerMorph: [row.LAY_MORPH1, row.LAY_MORPH2, row.LAY_MORPH3].filter(Boolean),
                  layerNotes: row.LAY_NOTES,
                  internalMorph: [row.INT_MORPH1].filter(Boolean),
                  rimDegradation: row.DEG_RIM,
                  ejectaDegradation: row.DEG_EJC,
                  floorDegradation: row.DEG_FLR,
                  ejcSvg: [row.ejc_svg_1, row.ejc_svg_2, row.ejc_svg_3].filter(Boolean),
                  hasRd: row.hasRd === "1" || row.hasRd === 1 || row.hasRd === "true" || row.hasRd === true,
                }))
                .filter(crater => !isNaN(crater.latitude) && !isNaN(crater.longitude));
              
              const previewCraters = allCraters.slice(0, 38);
              const fullCraters = allCraters.slice(0, 101);
              
              resolve({ preview: previewCraters, full: fullCraters });
            },
            error: reject
          });
        });

        // 加载土豆数据
        setLoadingStatus('正在加载土豆数据...');
        const potatoesPromise = new Promise((resolve, reject) => {
          Papa.parse('/mars_potato_properties.csv', {
            download: true,
            header: true,
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
              resolve(potatoes);
            },
            error: reject
          });
        });

        // 预加载纹理
        setLoadingStatus('正在加载资源...');
        const preloadTextures = new Promise((resolve) => {
          const manager = new THREE.LoadingManager();
          manager.onLoad = () => resolve();
          
          const textureLoader = new THREE.TextureLoader(manager);
          
          textureLoader.load('/marsmap_normal.jpg', (texture) => {
            window.__PRELOADED_TEXTURES = window.__PRELOADED_TEXTURES || {};
            window.__PRELOADED_TEXTURES.marsTexture = texture;
          });
          
          textureLoader.load('/mars_normal.jpg', (texture) => {
            window.__PRELOADED_TEXTURES = window.__PRELOADED_TEXTURES || {};
            window.__PRELOADED_TEXTURES.normalMap = texture;
          });
        });
        
        // 等待所有数据加载完成
        const [cratersData, potatoes] = await Promise.all([
          cratersPromise, 
          potatoesPromise,
          preloadTextures
        ]);
        
        setCraterData(cratersData);
        setPotatoData(potatoes);
        setLoadingStatus('加载完成！');
        setAppReady(true);
        
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('数据加载错误:', error);
        setLoadError(error);
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []);

  return {
    isLoading,
    loadingStatus,
    loadError,
    craterData,
    potatoData,
    appReady
  };
};