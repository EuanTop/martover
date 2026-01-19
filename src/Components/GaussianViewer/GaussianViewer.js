import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 简化版高斯溅射点云查看器
 * 针对资源消耗进行了优化
 */
const GaussianViewer = ({ 
  plyUrl = '/ply/scene1.ply',
  modelScale = 1.0,
  autoRotate = true,
  backgroundColor = 0x111111
}) => {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const sparkRef = useRef(null);
  const splatMeshRef = useRef(null);
  const controlsRef = useRef(null);
  const animationIdRef = useRef(null);
  const isDisposedRef = useRef(false);

  // 清理函数
  const cleanup = useCallback(() => {
    isDisposedRef.current = true;
    
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
    }

    if (splatMeshRef.current && sparkRef.current) {
      sparkRef.current.remove(splatMeshRef.current);
      splatMeshRef.current = null;
    }

    if (controlsRef.current) {
      controlsRef.current.dispose();
    }

    if (mountRef.current && rendererRef.current?.domElement) {
      try {
        mountRef.current.removeChild(rendererRef.current.domElement);
      } catch (e) {
        // 忽略已移除的元素
      }
    }

    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    sparkRef.current = null;
    controlsRef.current = null;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    
    isDisposedRef.current = false;
    const mount = mountRef.current;

    // 获取容器的实际尺寸
    const rect = mount.getBoundingClientRect();
    const width = rect.width || mount.clientWidth || 800;
    const height = rect.height || mount.clientHeight || 600;

    // 创建渲染器 - 使用较低的像素比以节省资源
    const renderer = new THREE.WebGLRenderer({
      antialias: false, // 关闭抗锯齿以节省资源
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 限制像素比
    renderer.setSize(width, height);
    
    // 设置 canvas 样式确保填满容器
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    mount.appendChild(renderer.domElement);

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // 创建相机 - 第一人称视角，非常近
    const camera = new THREE.PerspectiveCamera(
      26, // 较大的 FOV 提供更沉浸的第一人称视角
      width / height,
      0.0001, // 极小的近裁剪面以支持极近的观察
      1000 // 远裁剪面
    );
    // 相机位置设置为很近但不为零，这样 OrbitControls 才能正常工作
    camera.position.set(0, 0, 0.15); // 非常近的初始距离

    // 创建 SparkRenderer
    const spark = new SparkRenderer({
      renderer,
      maxStdDev: 1.0,
      focalDistance: 0.15 // 调整焦距匹配相机距离
    });
    scene.add(spark);

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    // 目标点设置在原点，相机围绕它旋转
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true; // 允许平移以便更好地探索模型
    controls.panSpeed = 1.5; // 加快平移速度
    controls.enableZoom = true; // 确保启用缩放
    controls.zoomSpeed =7.0; // 大幅加快缩放速度
    controls.minDistance = 0.001; // 极小的最小距离，几乎可以进入模型内部
    controls.maxDistance = 1000; // 很大的最大距离
    controls.autoRotate = false; // 关闭自动旋转
    controls.rotateSpeed = 1.0; // 旋转速度

    // 保存引用
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    sparkRef.current = spark;
    controlsRef.current = controls;

    // 加载 PLY 模型
    const mesh = new SplatMesh({ url: plyUrl });
    mesh.scale.set(modelScale, modelScale, modelScale);
    mesh.quaternion.set(1, 0, 0, 0);
    mesh.position.set(0, 0, 0);
    
    spark.add(mesh);
    splatMeshRef.current = mesh;

    // 渲染循环
    let lastTime = 0;
    const targetFPS = 30; // 限制帧率以节省资源
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime) => {
      if (isDisposedRef.current) return;
      
      animationIdRef.current = requestAnimationFrame(animate);
      
      // 帧率限制
      const deltaTime = currentTime - lastTime;
      if (deltaTime < frameInterval) return;
      lastTime = currentTime - (deltaTime % frameInterval);

      if (controls) controls.update();
      renderer.render(scene, camera);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    // 窗口大小变化处理
    const handleResize = () => {
      if (!mount || isDisposedRef.current) return;
      const newRect = mount.getBoundingClientRect();
      const w = newRect.width || mount.clientWidth;
      const h = newRect.height || mount.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    
    // 延迟一帧再次调整大小，确保容器已完全渲染
    requestAnimationFrame(handleResize);

    // 清理
    return () => {
      resizeObserver.disconnect();
      cleanup();
    };
  }, [plyUrl, modelScale, autoRotate, backgroundColor, cleanup]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    />
  );
};

export default GaussianViewer;
