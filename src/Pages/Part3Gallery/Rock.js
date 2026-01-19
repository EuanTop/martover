import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const Rock = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    rendererRef.current = renderer;

    // 使用小尺寸渲染平面 - 保持屏幕宽高比
    const aspectRatio = window.innerWidth / window.innerHeight;
    const renderHeight = 480; // 固定高度为100px
    const renderWidth = Math.round(renderHeight * aspectRatio); // 宽度按比例计算
    
    renderer.setSize(renderWidth, renderHeight);
    // 不设置像素比，保持低分辨率
    renderer.setPixelRatio(1);
    
    // 将DOM元素样式设置为100%以拉伸到容器大小
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // 创建着色器材质
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(renderWidth, renderHeight) }
      },
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;
        
        vec3 hsv(float h,float s,float v){
            vec4 t=vec4(1.,2./3.,1./3.,3.);
            vec3 p=abs(fract(vec3(h)+t.xyz)*6.-vec3(t.w));
            return v*mix(vec3(t.x),clamp(p-vec3(t.x),0.,1.),s);
        }
        
        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
            vec2 r = iResolution.xy;
            vec2 FC = fragCoord.xy;
            float t = iTime;
            vec4 o = vec4(0,0,0,1);
            
            // 变量声明
            float i,e,R,s;
            
            // 保持原有ray direction计算
            vec3 q,p,d=vec3(-FC.yx/r.y*.8*(abs(cos(t*.3)*.3+.1+.8)),1);
            
            // 主循环
            for(q--;i++<118.;i>89.?d/=-d:d) {
                e+=i/5e3;
                
                // 修改颜色累积方式，使用更亮的红褐色调
                vec3 rockColor = vec3(0.9, 0.4, 0.2); // 更亮的基础岩石颜色
                o.rgb += e*e/20. * rockColor;
                
                s=1.;
                p=q+=d*e*R*.16;
                
                // 保持原有空间变换
                p=vec3(log2(R=length(p))-2.-t*.3,
                       -p.z/R,
                       atan(p.x,p.y));
                
                // 保持原有细节生成循环
                for(e=--p.y;s<1e5;s+=s)
                    e+=cos(dot(cos(p.zyy*s),cos(p.xyx*s)))/s;
            }
            
            // 增加整体亮度，减少暗部效果
            o.rgb *= 1.2 + 0.3*sin(e*2.0);
            
            fragColor = o;
        }
        
        void main() {
          vec4 color;
          mainImage(color, gl_FragCoord.xy);
          gl_FragColor = color;
        }
      `
    });

    // 创建平面
    const plane = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(plane, shaderMaterial);
    scene.add(mesh);

    // 动画循环 - 减少帧率以进一步优化
    const clock = new THREE.Clock();
    let animationFrameId;
    let lastUpdateTime = 0;
    const updateInterval = 33; // 约30fps

    const animate = (timestamp) => {
      animationFrameId = requestAnimationFrame(animate);
      
      // 限制更新频率
      if (timestamp - lastUpdateTime < updateInterval) return;
      lastUpdateTime = timestamp;
      
      // 更新shader时间参数
      shaderMaterial.uniforms.iTime.value = clock.getElapsedTime();
      
      // 渲染场景
      renderer.render(scene, camera);
    };

    animate(0);

    // 处理窗口大小变化
    const handleResize = () => {
      // 保持宽高比
      const newAspectRatio = window.innerWidth / window.innerHeight;
      const newRenderWidth = Math.round(renderHeight * newAspectRatio);
      
      renderer.setSize(newRenderWidth, renderHeight);
      shaderMaterial.uniforms.iResolution.value.set(newRenderWidth, renderHeight);
    };

    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      
      // 释放资源
      plane.dispose();
      shaderMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1, // 确保在页面内容的后面
        pointerEvents: 'none', // 防止背景拦截用户交互
        overflow: 'hidden', // 防止出现滚动条
        backgroundColor: '#331111', // 添加底色，避免在着色器加载时出现白闪
        imageRendering: 'auto' // 浏览器决定最佳的图像渲染方式
      }}
    />
  );
};

export default Rock;