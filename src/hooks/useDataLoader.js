import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as THREE from 'three';
import { createCraterCatalog } from '../game/data/craterCatalog';
import { normalizeCraterRows } from '../game/data/craterRows';

export const useDataLoader = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('正在准备加载数据...');
  const [loadError, setLoadError] = useState(null);
  const [craterData, setCraterData] = useState({ available: [], totalCount: 0 });
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
              resolve(createCraterCatalog(normalizeCraterRows(results.data)));
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
