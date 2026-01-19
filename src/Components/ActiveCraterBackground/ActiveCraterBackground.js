import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

const ActiveCraterBackground = ({ visualParams }) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);

  // 默认参数
  const params = useMemo(() => ({
    color: new THREE.Vector3(0.9, 0.4, 0.2), // 默认火星橙
    speed: 1.0,
    ...visualParams
  }), [visualParams]);

  // 将十六进制颜色转换为 Vector3
  const colorVec = useMemo(() => {
    const c = new THREE.Color(params.color || '#E56A2E');
    return new THREE.Vector3(c.r, c.g, c.b);
  }, [params.color]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    rendererRef.current = renderer;

    // 保持屏幕宽高比
    const aspectRatio = window.innerWidth / window.innerHeight;
    const renderHeight = 480; 
    const renderWidth = Math.round(renderHeight * aspectRatio);
    
    renderer.setSize(renderWidth, renderHeight);
    renderer.setPixelRatio(1);
    
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    // 清除旧内容
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(renderWidth, renderHeight) },
        uColor: { value: colorVec },
        uSpeed: { value: params.speed || 1.0 }
      },
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        // --- 变量定义 ---
        uniform float iTime;       // 时间变量，驱动动画
        uniform vec2 iResolution;  // 渲染分辨率
        uniform vec3 uColor;       // 传入的颜色参数 (来自环境影响)
        uniform float uSpeed;      // 传入的速度参数 (来自环境影响)
        
        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
            vec2 r = iResolution.xy;
            vec2 FC = fragCoord.xy;
            
            float t = iTime * uSpeed * 0.05; 
            
            vec4 o = vec4(0,0,0,1);
            
            // 背景色 - Step1的橙色
            vec3 bgColor = vec3(0.96, 0.45, 0.21); 
            // 陨石坑岩石颜色
            vec3 craterColor = vec3(0.7, 0.3, 0.1); 
            
            float i, e, R, s;
            
            // --- 关键修改：通过几何变换实现陨石坑在下半部分 ---
            // 1. 调整视角：让摄像机"俯视"陨石坑
            vec2 uv = (fragCoord.xy - 0.5 * r.xy) / r.y;
            
            // 2. 垂直偏移：将视角中心向上移动，这样陨石坑自然出现在下方
            uv.y += 0.3; // 向上偏移30%，让坑出现在下半部分
            
            // 3. 缩放调整：让陨石坑大小合适
            uv *= 0.8; // 稍微缩小，让坑不会太大
            
            // 4. 射线方向计算
            vec3 q, p, d = vec3(uv.x, uv.y, 1.0);
            
            // 5. 判断是否在陨石坑区域内
            float distFromCenter = length(uv);
            bool inCraterArea = distFromCenter < 0.6; // 陨石坑影响半径
            
            if (inCraterArea) {
                // 在陨石坑区域内，进行raymarching计算
                for(q--; i++ < 118.; i > 89. ? d /= -d : d) {
                    e += i / 3e3;
                    o.rgb += e * e / 25. * craterColor;
                    s = 1.;
                    p = q += d * e * R * .16;
                    p = vec3(log2(R = length(p) * 1.5) - 2. - t * .05, 
                           -p.z / R, 
                           atan(p.x, p.y));
                    
                    for(e = --p.y; s < 1e5; s += s)
                        e += cos(dot(cos(p.zyy * s), cos(p.xyx * s))) / s;
                }
                
                // 后处理陨石坑颜色
                o.rgb *= 1.3 + 0.4 * sin(e * 2.0);
                o.rgb = mix(o.rgb, vec3(0.2, 0.05, 0.0), 0.2);
                
                // 边缘柔化
                float edgeFade = smoothstep(0.5, 0.6, distFromCenter);
                o.rgb = mix(o.rgb, bgColor, edgeFade);
                
                fragColor = vec4(o.rgb, 1.0);
            } else {
                // 在陨石坑区域外，显示纯背景色
                fragColor = vec4(bgColor, 1.0);
            }
        }
        
        void main() {
          vec4 color;
          mainImage(color, gl_FragCoord.xy);
          gl_FragColor = color;
        }
      `
    });
    materialRef.current = shaderMaterial;

    const plane = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(plane, shaderMaterial);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let animationFrameId;
    let lastUpdateTime = 0;
    const updateInterval = 33; 

    const animate = (timestamp) => {
      animationFrameId = requestAnimationFrame(animate);
      if (timestamp - lastUpdateTime < updateInterval) return;
      lastUpdateTime = timestamp;
      
      shaderMaterial.uniforms.iTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    animate(0);

    const handleResize = () => {
      const newAspectRatio = window.innerWidth / window.innerHeight;
      const newRenderWidth = Math.round(renderHeight * newAspectRatio);
      renderer.setSize(newRenderWidth, renderHeight);
      shaderMaterial.uniforms.iResolution.value.set(newRenderWidth, renderHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      plane.dispose();
      shaderMaterial.dispose();
      renderer.dispose();
    };
  }, []); // 只在挂载时初始化，参数更新通过下面的 useEffect 处理

  // 监听参数变化更新 Uniforms
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value = colorVec;
      materialRef.current.uniforms.uSpeed.value = params.speed || 1.0;
    }
  }, [colorVec, params.speed]);

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0, 
        pointerEvents: 'none', 
        overflow: 'hidden', 
        backgroundColor: '#F57435', // 使用 Step 1 的橙色作为默认背景
      }}
    />
  );
};

export default ActiveCraterBackground;
