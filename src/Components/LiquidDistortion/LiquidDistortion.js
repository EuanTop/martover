import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const LiquidDistortion = ({ imageUrl, width = '100%', height = '600px', intensity = 0.3, border = true }) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current; // 保存当前ref
    
    // 先加载图片以获取其自然宽高比
    const img = new Image();
    img.onload = () => {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      setNaturalAspectRatio(imgAspect);
      initThreeJS(imgAspect);
    };
    img.src = imageUrl;
    
    // 初始化 Three.js 场景
    function initThreeJS(imageAspect) {
      const container = containerRef.current;
      if (!container) return;
      
      // 清理之前的渲染器
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      
      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rendererRef.current = renderer;
      
      const containerWidth = container.clientWidth;
      
      // 使用图片的自然宽高比来设置容器高度，确保图片不被压缩
      const calculatedHeight = containerWidth / imageAspect;
      container.style.height = `${calculatedHeight}px`;
      
      renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
      renderer.setSize(containerWidth, calculatedHeight);
      container.appendChild(renderer.domElement);
      
      // 创建场景和相机
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      camera.position.z = 1;
      
      // 加载纹理
      const texture = new THREE.TextureLoader().load(imageUrl);
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      
      // 创建着色器材质 - 使用原始intensity的30%来减弱效果
      const uniforms = {
        uTime: { value: 0.0 },
        uTexture: { value: texture },
        uIntensity: { value: intensity * 0.3 },// 减弱扭曲效果
        uNoiseScale: { value: 5.0 }
      };
      
      // 顶点着色器
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      
      // 片元着色器
      const fragmentShader = `
        uniform float uTime;
        uniform sampler2D uTexture;
        uniform float uIntensity;
        varying vec2 vUv;
        
        void main() {
          vec2 uv = vUv;
          
          // 添加更细微的扭曲效果
          float waveX = sin(uv.y * 8.0 + uTime) * uIntensity * 0.03;
          float waveY = sin(uv.x * 8.0 + uTime * 0.6) * uIntensity * 0.03;
          
          uv.x += waveX;
          uv.y += waveY;
          
          // 处理越界情况
          vec2 clampedUv = clamp(uv, 0.0, 1.0);
          vec4 color = texture2D(uTexture, clampedUv);
          
          gl_FragColor = color;
        }
      `;
      
      // 创建材质和几何体
      const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader,
        fragmentShader,
      });
      
      // 使用平面几何体
      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      // 动画循环
      let animationFrameId;
      function animate() {
        animationFrameId = requestAnimationFrame(animate);
        uniforms.uTime.value += 0.02; // 减慢动画速度
        renderer.render(scene, camera);
      }
      
      animate();
      
      // 处理窗口大小变化
      const handleResize = () => {
        if (!container) return;
        
        const newContainerWidth = container.clientWidth;
        const newHeight = newContainerWidth / imageAspect;
        
        // 更新容器高度
        container.style.height = `${newHeight}px`;
        
        // 更新渲染器大小
        renderer.setSize(newContainerWidth, newHeight);
      };
      
      window.addEventListener('resize', handleResize);
      
      // 清理函数
      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        if (container && renderer.domElement) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        texture.dispose();
        renderer.dispose();
      };
    }
    
    // 组件卸载时清理
    return () => {
      // if (rendererRef.current && containerRef.current) {
      //   containerRef.current.removeChild(rendererRef.current.domElement);
      //   rendererRef.current.dispose();
      // }

    if (rendererRef.current && container) {
      container.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
    };
  }, [imageUrl, intensity, border]);
  
  // 初始渲染，容器高度可能会在加载图片后动态调整
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width, 
        height: naturalAspectRatio ? 'auto' : height,
        position: 'relative',
        overflow: 'hidden',
        border: border ? '1px solid #000' : 'none', // 添加黑色细边框
      }} 
    />
  );
};

export default LiquidDistortion;