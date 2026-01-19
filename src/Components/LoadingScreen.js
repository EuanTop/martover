import React from 'react';
import { Html } from '@react-three/drei';

const LoadingScreen = () => {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center bg-black/70 p-5 rounded-lg backdrop-blur-sm">
        <div className="text-white/90 text-lg mb-3">资源加载中...</div>
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full animate-loading-bar" />
        </div>
      </div>
    </Html>
  );
};

export default LoadingScreen;