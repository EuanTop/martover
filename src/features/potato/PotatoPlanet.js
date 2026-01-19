import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from '../../context/ThemeContext';

const PotatoPlanet = ({ potatoData, selectedCrater }) => {
  const { isDarkMode } = useTheme();
  const [selectedPotato, setSelectedPotato] = useState(null);
  
  // 根据选择的陨石坑匹配土豆
  useEffect(() => {
    if (selectedCrater && potatoData?.length > 0) {
      // 这里可以添加匹配逻辑，例如根据陨石坑特性选择合适的土豆
      const matchedPotato = potatoData[Math.floor(Math.random() * potatoData.length)];
      setSelectedPotato(matchedPotato);
    }
  }, [selectedCrater, potatoData]);

  return (
    <div className="w-full h-full bg-gradient-to-b from-orange-500 to-orange-700">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">
          火星土豆培育计划
        </h1>
        
        {selectedPotato ? (
          <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg">
            <h2 className="text-2xl font-semibold text-white mb-4">
              {selectedPotato.specialParam}
            </h2>
            <p className="text-white/90 mb-4">
              {selectedPotato.specialParamDetails}
            </p>
            <div className="mt-8">
              <h3 className="text-xl font-medium text-white mb-2">
                英文描述
              </h3>
              <p className="text-white/80 italic">
                {selectedPotato.englishDescription}
              </p>
            </div>
            
            {/* 3D土豆渲染 */}
            <div className="w-full h-64 mt-6">
              <Canvas>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <mesh>
                  <sphereGeometry args={[1.5, 16, 16]} />
                  <meshStandardMaterial 
                    color="#C28B4B" 
                    roughness={0.8} 
                    metalness={0.1} 
                  />
                </mesh>
              </Canvas>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-white text-xl">加载土豆数据中...</p>
          </div>
        )}
        
        <div className="mt-8 flex justify-center">
          <button 
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            onClick={() => window.history.back()}
          >
            返回火星
          </button>
        </div>
      </div>
    </div>
  );
};

export default PotatoPlanet;