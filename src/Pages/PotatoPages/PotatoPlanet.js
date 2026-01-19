import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Environment, MeshDistortMaterial, ContactShadows, Text, Billboard, Clouds, Cloud } from '@react-three/drei'
import { useSpring } from '@react-spring/core'
import { a } from '@react-spring/three'
import * as THREE from 'three'
import { LeftOutlined, RightOutlined, PlayCircleOutlined, PauseCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'; // 添加 ArrowLeftOutlined
import { ConfigProvider, Slider } from 'antd';
import { progressNodeStyle } from '../../Components/ProgressBar';
import ProgressBar from '../../Components/ProgressBar';
import Part3Gallery from '../Part3Gallery/Part3Gallery'; // 添加这一行导入单独的 Part3Gallery 组件
import MRIViewer from '../../Components/PotatoSliceViewer/MRIViewer';
import { MRISlice } from '../MRIPotatoPage/MRIPotatoPage';
import { getCraterInfluences, sortPotatoesByInfluence } from '../../utils/breedingLogic';
import { EnvironmentEffects, EnvironmentIcon } from '../../Components/EnvironmentEffects/EnvironmentEffects';
import VisShape from '../../Components/VisShape/VisShape';
import RdOverlaySvg from '../../Components/RdOverlay/RdOverlaySvg';
import { OverlayBackground } from '../../Components/OverlayLayers';

const AnimatedMaterial = a(MeshDistortMaterial)

// 创建文字纹理 - 支持逐行显现效果
function createTextTexture(text, startTime = null) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const context = canvas.getContext('2d')

    // 创建一个动画纹理
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    
    // 记录开始时间，用于渐显动画
    const animStartTime = startTime || Date.now()

    // 文字自动换行函数
    function wrapText(text, maxWidth) {
        const words = text.split(' ')
        const lines = []
        let currentLine = words[0]

        for (let i = 1; i < words.length; i++) {
            const word = words[i]
            const width = context.measureText(currentLine + " " + word).width
            if (width < maxWidth) {
                currentLine += " " + word
            } else {
                lines.push(currentLine)
                currentLine = word
            }
        }
        lines.push(currentLine)
        return lines
    }

    // 设置动画更新函数
    const updateTexture = () => {
        // 清除画布
        context.fillStyle = 'white'
        context.fillRect(0, 0, canvas.width, canvas.height)

        // 设置文字样式
        context.font = '14px Inter'
        context.textAlign = 'center'
        context.textBaseline = 'middle'

        // 获取所有行
        const lines = wrapText(text, canvas.width * 0.2)
        const totalLines = lines.length
        
        // 计算逐行显现进度 (10秒内完成所有行的显现，更缓慢)
        const elapsed = Date.now() - animStartTime
        const totalDuration = 10000 // 10秒
        const overallProgress = Math.min(elapsed / totalDuration, 1)
        
        // 计算当前应该显示到第几行（包括部分显示的行）
        const currentLineProgress = overallProgress * totalLines

        // 绘制文字 - 逐行显现
        lines.forEach((line, i) => {
            // 计算每行的透明度
            let lineOpacity = 0
            if (i < currentLineProgress - 1) {
                // 已完全显示的行
                lineOpacity = 1
            } else if (i < currentLineProgress) {
                // 正在显现的行 - 渐变透明度
                lineOpacity = currentLineProgress - i
            }
            // 未到达的行保持透明度为0
            
            if (lineOpacity > 0) {
                context.fillStyle = `rgba(0, 0, 0, ${lineOpacity})`
                context.fillText(
                    line,
                    canvas.width / 4,
                    canvas.height / 2 - (totalLines / 2 - i) * 30
                )
            }
        })

        // 添加闪光效果 - 从左上角到右下角的渐变（只在文字完全显现后）
        if (overallProgress >= 1) {
            const time = Date.now() % 10000 / 10000  // 5秒一个周期
            const gradientPosition = (1 - Math.cos(time * Math.PI * 2)) / 2

            if (gradientPosition > 0.05 && gradientPosition < 0.95) {
                const gradient = context.createLinearGradient(
                    0, 0,
                    canvas.width, canvas.height
                )

                const mappedPos = 0.1 + (gradientPosition - 0.05) * (0.8 / 0.9)

                gradient.addColorStop(Math.max(0, mappedPos - 0.1), 'rgba(255, 255, 255, 0)')
                gradient.addColorStop(mappedPos, 'rgba(255, 255, 255, 0.5)')
                gradient.addColorStop(Math.min(1, mappedPos + 0.1), 'rgba(255, 255, 255, 0)')

                context.globalCompositeOperation = 'lighter'
                context.fillStyle = gradient
                context.fillRect(0, 0, canvas.width, canvas.height)
                context.globalCompositeOperation = 'source-over'
            }
        }

        texture.needsUpdate = true
        requestAnimationFrame(updateTexture)
    }

    // 开始动画
    updateTexture()

    return texture
}

// 修改 Blob 组件，彻底解决文本不显示问题
// 用HTML直接显示文本，完全跳过Three.js的Text组件，解决延迟问题

function Blob({ currentPotatoData, windyMode, visualParams }) {
    const sphere = useRef()
    const light = useRef()
    const [hovered, setHovered] = useState(false)
    // 始终使用强引用保存当前文本值
    const [textContent, setTextContent] = useState("Loading...")

    // 使用传入
    const textTexture = useMemo(() => {
        return createTextTexture(
            currentPotatoData?.englishDescription || "Loading..."
        )
    }, [currentPotatoData])

    // 默认视觉参数
    const defaultParams = {
        metalness: 0.5,
        distort: 0.4,
        speed: 1.0
    };

    const params = visualParams || defaultParams;
    
    // 每次 currentPotatoData 改变时立即更新文本内容
    useEffect(() => {
        // 如果有传入的 visualParams，使用它们；否则（在未选择陨石坑的浏览模式下）保持之前的随机逻辑或默认值
        // 这里我们优先使用 visualParams 来体现"环境影响"
        if (sphere.current && visualParams) {
            sphere.current.material.metalness = visualParams.metalness;
            sphere.current.material.distort = visualParams.distort;
            sphere.current.material.speed = visualParams.speed;
        } else if (sphere.current) {
             // 保留之前的随机逻辑作为 fallback
            sphere.current.material.metalness = Math.random();
            sphere.current.material.distort = Math.random();
            sphere.current.material.speed = Math.random() * 10 + 1;
        }
        
        // 记录当前数据，帮助调试
        console.log("Current potato data changed:", currentPotatoData);
        
        // 直接从当前数据更新文本，每次数据变化一定会执行
        if (currentPotatoData) {
            // 按优先级尝试不同的文本源
            let text = "未知土豆";
            
            if (currentPotatoData.specialParam) {
                text = currentPotatoData.specialParam;
                console.log("使用了 specialParam:", text);
            } else if (currentPotatoData.specialParamEn) {
                text = currentPotatoData.specialParamEn;
                console.log("使用了 specialParamEn:", text);
            } else if (currentPotatoData.chineseName) {
                text = currentPotatoData.chineseName;
                console.log("使用了 chineseName:", text);
            } else if (currentPotatoData.englishName) {
                text = currentPotatoData.englishName;
                console.log("使用了 englishName:", text);
            } else {
                text = `火星土豆 #${currentPotatoData.id}`;
                console.log("使用了默认名称:", text);
            }
            
            setTextContent(text);
        }
    }, [currentPotatoData]);

    useEffect(() => {
        // 确保组件卸载时取消动画循环
        return () => {
            if (textTexture && textTexture.dispose) {
                textTexture.dispose()
            }
        }
    }, [textTexture])

    useFrame((state) => {
        light.current.position.x = state.mouse.x * 20
        light.current.position.y = state.mouse.y * 20
        if (sphere.current) {
            sphere.current.position.x = THREE.MathUtils.lerp(sphere.current.position.x, hovered ? state.mouse.x / 2 : 0, 0.2)
            sphere.current.position.y = THREE.MathUtils.lerp(
                sphere.current.position.y,
                Math.sin(state.clock.elapsedTime / 1.5) / 6 + (hovered ? state.mouse.y / 2 : 0),
                0.2
            )
        }
    })

    const [{ wobble, color, env }] = useSpring(
        {
            wobble: hovered ? 1.05 : 1,
            env: 1,
            color: '#fff',
            config: { mass: 2, tension: 1000, friction: 10 }
        },
        [hovered]
    )
    
    // 描边mesh的ref
    const outlineRef = useRef()
    
    // 同步描边mesh的位置和变形
    useFrame(() => {
        if (outlineRef.current && sphere.current) {
            outlineRef.current.position.copy(sphere.current.position)
        }
    })
    
    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={75}>
                <a.pointLight ref={light} position-z={-15} intensity={1.5} color="#fff" />
            </PerspectiveCamera>
            <group>
                {/* 黑色描边 - 非常细的描边 */}
                <a.mesh
                    ref={outlineRef}
                    scale={wobble.to(w => w * 1.005)}
                >
                    <sphereGeometry args={[1, 64, 64]} />
                    <MeshDistortMaterial
                        color="#000000"
                        side={THREE.BackSide}
                        distort={params.distort}
                        speed={params.speed}
                        transparent
                        opacity={windyMode ? 0 : 1}
                    />
                </a.mesh>
                
                {/* 主土豆mesh */}
                <a.mesh
                    ref={sphere}
                    scale={wobble}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}>
                    <sphereGeometry args={[1, 64, 64]} />
                    <AnimatedMaterial
                        color={color}
                        envMapIntensity={env}
                        clearcoat={1}
                        clearcoatRoughness={0}
                        metalness={params.metalness}
                        distort={params.distort}
                        speed={params.speed}
                        map={textTexture}
                        transparent
                        opacity={windyMode ? 0 : 0.9}
                    />
                </a.mesh>
                
                {/* 不再使用Three.js的Text组件，改为传递textContent到外部 */}
            </group>
        </>
    )
}

// 添加云朵组件
function CloudsComponent({ windyMode, showWindImage, coverMode, onCloudGone, isBackTransition, onCloudBack, onSwap }) {
    const cloudGroupRef = useRef()
    const imgMeshRef = useRef()
    const [hasSwapped, setHasSwapped] = useState(false);
    
    // Reset swap state when transition starts
    useEffect(() => {
        if (coverMode) {
            setHasSwapped(false);
        }
    }, [coverMode]);

    // Initial position handling for back transition
    useEffect(() => {
        if (isBackTransition && cloudGroupRef.current) {
            cloudGroupRef.current.position.x = -25;
        }
    }, [isBackTransition]);

    useFrame((state, delta) => {
        if (cloudGroupRef.current) {
            const time = state.clock.elapsedTime
            
            if (coverMode) {
                if (isBackTransition) {
                    // Fly IN from Left (Reverse)
                    // Move Right
                    cloudGroupRef.current.position.x += delta * 25; 
                    
                    // Midpoint Swap Logic (when clouds cover center)
                    if (!hasSwapped && cloudGroupRef.current.position.x >= -5) {
                        setHasSwapped(true);
                        if (onSwap) onSwap();
                    }

                    // If reached far right (off screen), trigger callback
                    if (cloudGroupRef.current.position.x >= 25) {
                        if (onCloudBack) onCloudBack();
                    }
                } else {
                    // Fly to left and out (Forward)
                    // Move rapidly to the left
                    cloudGroupRef.current.position.x -= delta * 15;
                    
                    // If out of view (kill threshold), trigger callback
                    if (cloudGroupRef.current.position.x < -25) {
                        if (onCloudGone) onCloudGone();
                    }
                }
            } else {
                // Normal oscillation
                const windFactor = windyMode ? 3 : 1
                cloudGroupRef.current.position.x = Math.sin(time * 0.5 * windFactor) * (2 * windFactor)
                cloudGroupRef.current.position.y = Math.sin(time * 0.3 * windFactor) * (1.5 * windFactor)
                cloudGroupRef.current.position.z = Math.sin(time * 0.4 * windFactor) * (3 * windFactor)
                
                // 添加旋转效果
                cloudGroupRef.current.rotation.y = Math.sin(time * 0.2 * windFactor) * (0.2 * windFactor)
                cloudGroupRef.current.rotation.z = Math.cos(time * 0.3 * windFactor) * (0.1 * windFactor)
            }
        }
    })
    // Three.js纹理
    const [imgTexture] = useState(() => {
        const tex = new THREE.TextureLoader().load('/imgs/MRI.jpg')
        return tex
    })
    
    // Cover Mode Opacity - Lighter and more transparent
    // User request: "Not so black, more semi-transparent, thinner"
    const baseOpacity = coverMode ? 0.6 : (windyMode ? 0.25 : 0.07);
    const centerOpacity = coverMode ? 0.5 : (windyMode ? 0.09 : 0.017);
    const insideOpacity = coverMode ? 0.5 : (windyMode ? 0.09 : 0.017);
    
    // Color: White to avoid "black" look
    const cloudColor = new THREE.Color('#ffffff');
    
    return (
        <group ref={cloudGroupRef}>
            <Clouds texture="/imgs/cloud.png">
                <Cloud 
                    concentrate="outside" 
                    seed={1} 
                    segments={60} 
                    bounds={6}
                    volume={12} 
                    growth={4} 
                    opacity={baseOpacity} 
                    position={[0, 0, 2]}
                    speed={(windyMode || coverMode) ? 2.5 : 0.8}
                    color={cloudColor}
                />
                <Cloud 
                    concentrate="center" 
                    seed={2} 
                    segments={40} 
                    bounds={4}
                    volume={8} 
                    growth={3} 
                    opacity={centerOpacity} 
                    position={[0, 0, 0]}
                    speed={(windyMode || coverMode) ? 1.8 : 0.6}
                    color={cloudColor}
                />
                <Cloud 
                    concentrate="inside" 
                    seed={3} 
                    segments={30} 
                    bounds={8}
                    volume={15} 
                    growth={5} 
                    opacity={insideOpacity} 
                    position={[0, 0, -2]}
                    speed={windyMode ? 1.2 : 0.4}
                    color={cloudColor}
                />
            </Clouds>
            {/* 风中图片 */}
            {windyMode && showWindImage && (
                <mesh ref={imgMeshRef} position={[0,0,0]}>
                    <planeGeometry args={[6, 4]} />
                    <meshBasicMaterial map={imgTexture} transparent opacity={0.01} />
                </mesh>
            )}
        </group>
    )
}

// 新增Part3Gallery组件

const PotatoPlanet = ({ potatoData, selectedCrater, onModeChange }) => {
    const [progressStep, setProgressStep] = useState(() => {
        // 获取已达到的最高进度
        return Number(localStorage.getItem('mars-highest-progress-step')) || 2; // 默认为第2步
    });

    // 育种逻辑状态
    const [sortedPotatoes, setSortedPotatoes] = useState([]);
    const [influences, setInfluences] = useState([]);
    const [primaryInfluence, setPrimaryInfluence] = useState(null);

    // 初始化：计算环境因子并排序土豆
    useEffect(() => {
        if (potatoData && potatoData.length > 0) {
            console.log('[PotatoPlanet] Selected Crater:', selectedCrater);
            
            const craterInfluences = getCraterInfluences(selectedCrater);
            console.log('[PotatoPlanet] Calculated Influences:', craterInfluences);
            
            setInfluences(craterInfluences);
            
            if (craterInfluences.length > 0) {
                setPrimaryInfluence(craterInfluences[0]);
            }

            const sorted = sortPotatoesByInfluence(potatoData, craterInfluences);
            setSortedPotatoes(sorted);
        }
    }, [potatoData, selectedCrater]);

    // 使用 sortedPotatoes 替代 potatoData 进行渲染
    const displayPotatoes = sortedPotatoes.length > 0 ? sortedPotatoes : potatoData;

    // 直接使用 selectedCrater（已经是处理过的格式，包含所有属性）
    // selectedCrater 来自 CraterDataProvider，已包含：
    // internalMorph, layerNumber, ejcSvg, rimDegradation, ejectaDegradation, floorDegradation, hasRd 等
    const visShapeCrater = selectedCrater;

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [windyMode, setWindyMode] = useState(false)
    const [coverMode, setCoverMode] = useState(false) // Cloud cover transition
    const [showMRI, setShowMRI] = useState(false)     // Show MRI Slice view
    const [mriState, setMriState] = useState('idle')
    const [mriMode, setMriMode] = useState('transverse') // 'transverse' or 'longitudinal'
    const [isMriAnimating, setIsMriAnimating] = useState(false)
    const [showWindImage, setShowWindImage] = useState(false)
    const [imgIn, setImgIn] = useState(false)
    const [maskProgress, setMaskProgress] = useState(0)
    const [showPart3, setShowPart3] = useState(false)
    const [confirmHover, setConfirmHover] = useState(false);
    const [backHover, setBackHover] = useState(false); // 添加返回按钮悬停状态
    const [defineHover, setDefineHover] = useState(false); // 添加"认定优秀品种"按钮悬停状态
    const [potatoFeatureText, setPotatoFeatureText] = useState("Loading...");
    const [isBackTransition, setIsBackTransition] = useState(false); // New state for back transition
    const [showMRIText, setShowMRIText] = useState(false); // 控制 MRI 文本渐显
    const [mriTextOpacity, setMriTextOpacity] = useState(0); // MRI 文本透明度

    // 当 windyMode 变化时通知父组件
    useEffect(() => {
        if (onModeChange) {
            onModeChange({ windyMode, showMRI });
        }
    }, [windyMode, showMRI, onModeChange]);

    useEffect(() => {
        if (displayPotatoes && displayPotatoes[currentIndex]) {
            // 直接更新功能文本状态
            const data = displayPotatoes[currentIndex];
            let text = "未知土豆";
            
            if (data.specialParam) {
                text = data.specialParam;
            } else if (data.specialParamEn) {
                text = data.specialParamEn;
            } else if (data.chineseName) {
                text = data.chineseName;
            } else if (data.englishName) {
                text = data.englishName;
            } else {
                text = `火星土豆 #${data.id}`;
            }
            
            setPotatoFeatureText(text);
        }
    }, [currentIndex, potatoData]);
    
    // 激活 windyMode 后延迟显示图片
    useEffect(() => {
        let timer
        if (windyMode) {
            timer = setTimeout(() => setShowWindImage(true), 600)
        } else {
            setShowWindImage(false)
            setImgIn(false)
            setMaskProgress(0)
        }
        return () => clearTimeout(timer)
    }, [windyMode])
    // 图片渲染后下一帧触发动画
    useEffect(() => {
        if (showWindImage) {
            setImgIn(false)
            setMaskProgress(0)
            const raf = requestAnimationFrame(() => setImgIn(true))
            return () => cancelAnimationFrame(raf)
        }
    }, [showWindImage])
    // mask动画
    useEffect(() => {
        if (!imgIn) return
        let start = null
        let frame
        const duration = 1200 // ms
        function animateMask(ts) {
            if (!start) start = ts
            const elapsed = ts - start
            let progress = Math.min(elapsed / duration, 1)
            setMaskProgress(progress)
            if (progress < 1) {
                frame = requestAnimationFrame(animateMask)
            }
        }
        frame = requestAnimationFrame(animateMask)
        return () => cancelAnimationFrame(frame)
    }, [imgIn])

    useEffect(() => {
        let timer;
        if (isPlaying && displayPotatoes.length > 0) {
            timer = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= displayPotatoes.length - 1) {
                        setIsPlaying(false); // 播放完成后停止
                        return 0;
                    }
                    return prev + 1;
                });
            }, 5000); // 3秒切换一次
        }
        return () => clearInterval(timer);
    }, [isPlaying, displayPotatoes.length]);

    const arrowStyle = {
        position: 'fixed',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '24px',
        color: isDarkMode ? 'white' : 'black',
        cursor: 'pointer',
        zIndex: 1000,
        padding: '20px 10px',
    };

    const sliderContainerStyle = {
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        maxWidth: '800px',
        padding: '20px',
        zIndex: 1000
    };

    const playButtonStyle = {
        position: 'fixed',
        top: '20px',
        right: '20px',
        fontSize: '32px',
        color: isDarkMode ? 'white' : 'black',
        cursor: 'pointer',
        zIndex: 1000,
    };

    const sliderTokens = {
        handleSize: 16,
        handleSizeHover: 20,
        // handleColor: isDarkMode ? '#177ddc' : '#CC580A',
         handleColor: '#000000',
        handleActiveColor: isDarkMode ? '#40a9ff' : '#FF8B4D',
        handleActiveOutlineColor: isDarkMode ? 'rgba(64,169,255,0.2)' : 'rgba(255,114,44,0.2)', // 圆环秒变颜色
        railBg: '#DA6C36', // 更亮的橙色
        railHoverBg: '#FFD2B2',
        trackBg: isDarkMode ? '#177ddc80' : '#CC580A',
        trackHoverBg: isDarkMode ? '#40a9ff80' : '#FF8B4D',
        dotSize: 8,
        railSize: 4,
        // controlSize: 10,
        // handleLineWidth: 2,
        // handleLineWidthHover: 2.5
    };

    // 放大版节点样式
    const bigNodeStyle = {
        ...progressNodeStyle,
        width: 64,
        height: 64,
        fontSize: 22,
        border: '2.5px solid #fff',
    };

    // 确认按钮点击
// 修改确认按钮点击处理函数
function handleConfirm() {
    // 获取当前最高进度
    const currentHighest = Number(localStorage.getItem('mars-highest-progress-step')) || 2;
    // 如果第3步更高，则更新最高进度
    if (3 > currentHighest) {
        localStorage.setItem('mars-highest-progress-step', '3');
    }
    // 保存当前进度
    localStorage.setItem('mars-progress-step', '3');
    
    // 更新状态
    setProgressStep(3);
    // 显示第3部分
    setShowPart3(true);
}

    // 返回按钮的点击处理函数
    const handleBackClick = () => {
        // Start Back Transition
        setIsBackTransition(true);
        setCoverMode(true); // Trigger cloud movement
        // Do NOT hide MRI yet. Wait for clouds to cover (onSwap).
    };

    // Cloud transition complete handler (Forward)
    const handleCloudGone = () => {
        // Clouds have flown out. MRI is already visible (set in onClick).
        setCoverMode(false); // Stop cloud rendering/animation
        
        // 开始 MRI 文本渐显动画
        setShowMRIText(true);
        // 渐显动画 - 3秒内从0到1
        let startTime = Date.now();
        const animateMRIText = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 3000, 1);
            setMriTextOpacity(progress);
            if (progress < 1) {
                requestAnimationFrame(animateMRIText);
            }
        };
        requestAnimationFrame(animateMRIText);
        
        // Start MRI Reveal Animation Sequence
        // 1. Wait a bit
        setTimeout(() => {
            // 2. Start Compressing / Switching
            setMriState('compressing');
            setIsMriAnimating(true);
            
            setTimeout(() => {
                // 3. Switch to Longitudinal & Start Flashing
                setMriMode('longitudinal');
                setMriState('flashing');
                
                setTimeout(() => {
                    // 4. Start Revealing
                    setMriState('revealing');
                    
                    setTimeout(() => {
                        // 5. Finish
                        setMriState('idle');
                        setIsMriAnimating(false);
                    }, 1500);
                }, 1500);
            }, 1000);
        }, 500);
    };

    // Cloud transition complete handler (Backward)
    const handleCloudBack = () => {
        // Clouds have flown to the right and are gone.
        // Reset everything to initial state.
        setCoverMode(false);
        setIsBackTransition(false);
        setWindyMode(false);
        setShowWindImage(false);
        setImgIn(false);
        setMaskProgress(0);
        setMriState('idle');
        setMriMode('transverse'); // Reset mode for next time
        setShowMRIText(false); // 重置 MRI 文本显示
        setMriTextOpacity(0); // 重置透明度
    };
    
    // Swap handler (Midpoint of Back Transition)
    const handleSwap = () => {
        // Clouds are covering the screen. Swap MRI -> Blob.
        setShowMRI(false);
    };

    // 如果没有数据，显示加载状态
    if (!potatoData || potatoData.length === 0) {
        return (
            <div style={{ width: '100vw', height: '100vh', background: '#FF722C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="bg-black/70 text-white/90 px-4 py-2 rounded-lg backdrop-blur-sm">
                    正在加载土豆数据...
                </div>
            </div>
        );
    }

    // 页面切换逻辑
    if (showPart3) return <Part3Gallery />;

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
            {/* 火星坑渲染已移至外层 Step2TestPage，避免土豆切换时重新渲染 */}

            {/* 使用正确的prop名称 */}
            <ProgressBar currentStep={2} />
            
            {/* 播放按钮 - 已注释掉 */}
            {/* <div
                style={{
                    ...playButtonStyle,
                    opacity: windyMode ? 0 : 1,
                    pointerEvents: windyMode ? 'none' : 'auto',
                    transition: 'opacity 0.6s',
                }}
                onClick={() => setIsPlaying(!isPlaying)}
            >
                {isPlaying ?
                    <PauseCircleOutlined /> :
                    <PlayCircleOutlined />
                }
            </div> */}

                        {!windyMode && (
                <div 
                    style={{
                        position: 'fixed',
                        bottom: '260px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#000',
                        fontWeight: 'regular',
                        fontSize: '16px',
                        textAlign: 'center',
                        padding: '8px 15px',
                        // borderRadius: '50px',
                        // background: 'rgba(255,255,255,0.4)',
                        // backdropFilter: 'blur(5px)',
                        // boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 3000,
                        minWidth: '200px',
                        maxWidth: '80%',
                        pointerEvents: 'none',
                        transition: 'opacity 0.3s',
                    }}
                >
                    {potatoFeatureText}
                </div>
            )}

            {/* 添加返回按钮 - 只在 windyMode 和 showWindImage 为 true 时显示 */}
            {windyMode && showWindImage && !showPart3 && !isBackTransition && (
                <button
                    style={{
                        position: 'fixed',
                        top: '20px',
                        left: '20px',
                        zIndex: 4000,
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        border: `1.5px solid ${backHover ? '#fff' : '#111'}`,
                        color: backHover ? '#fff' : '#111',
                        fontSize: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 32px 0 rgba(0,0,0,0.10)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.2s, border 0.2s',
                    }}
                    onClick={handleBackClick}
                    onMouseEnter={() => setBackHover(true)}
                    onMouseLeave={() => setBackHover(false)}
                >
                    <ArrowLeftOutlined />
                </button>
            )}

            {/* 左箭头 */}
            {currentIndex > 0 && (
                <LeftOutlined
                    style={{ ...arrowStyle, left: '20px', opacity: windyMode ? 0 : 1, pointerEvents: windyMode ? 'none' : 'auto', transition: 'opacity 0.6s' }}
                    onClick={() => {
                        setIsPlaying(false); // 点击箭头时停止自动播放
                        setCurrentIndex(prev => Math.max(0, prev - 1));
                    }}
                />
            )}

            {/* 右箭头 */}
            {currentIndex < displayPotatoes.length - 1 && (
                <RightOutlined
                    style={{ ...arrowStyle, right: '20px', opacity: windyMode ? 0 : 1, pointerEvents: windyMode ? 'none' : 'auto', transition: 'opacity 0.6s' }}
                    onClick={() => {
                        setIsPlaying(false); // 点击箭头时停止自动播放
                        setCurrentIndex(prev => Math.min(displayPotatoes.length - 1, prev + 1));
                    }}
                />
            )}

            {/* 滑动条 */}
            <div style={{ ...sliderContainerStyle, opacity: windyMode ? 0 : 1, pointerEvents: windyMode ? 'none' : 'auto', transition: 'opacity 0.6s' }}>
                <ConfigProvider
                    theme={{
                        components: {
                            Slider: sliderTokens
                        },
                    }}
                >
                    <Slider
                        min={0}
                        max={displayPotatoes.length - 1}
                        value={currentIndex}
                        onChange={(value) => {
                            setIsPlaying(false); // 拖动滑块时停止自动播放
                            setCurrentIndex(value);
                        }}
                        tooltip={{
                            formatter: val => `${val + 1}/${displayPotatoes.length}`
                        }}
                    />
                </ConfigProvider>
            </div>

            {/* 认定优秀品种按钮 */}
            <button
                style={{
                    position: 'fixed',
                    bottom: '40px',
                    right: '40px',
                    zIndex: 2000,
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: defineHover ? '#fff' : '#111',
                    background: 'rgba(255,255,255,0.15)',
                    border: `1.5px solid ${defineHover ? '#fff' : '#111'}`,
                    borderRadius: '50rem',
                    padding: '0.8rem 2rem',
                    boxShadow: '0 4px 32px 0 rgba(0,0,0,0.10)',
                    cursor: 'pointer',
                    opacity: windyMode ? 0 : 1,
                    pointerEvents: windyMode ? 'none' : 'auto',
                    transition: 'color 0.2s, border 0.2s, opacity 0.6s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                }}
                onClick={() => {
                    setWindyMode(true);
                    setCoverMode(true);
                    // Immediately show MRI (behind clouds)
                    setShowMRI(true);
                    setMriMode('transverse'); // Start with transverse
                    setMriState('idle');
                    // Animation is now handled by CloudsComponent onCloudGone callback
                }}
                onMouseEnter={() => setDefineHover(true)}
                onMouseLeave={() => setDefineHover(false)}
            >认定优秀品种</button>
            
            {/* Canvas始终渲染云朵，MRI图片飘入时只隐藏Blob和其他内容 */}
            <Canvas gl={{ antialias: true }} style={{ pointerEvents: 'none', position: 'relative', zIndex: 20 }}>
                <Suspense fallback={null}>
                    {/* Only render clouds if not showing MRI (they are killed after transition) OR if we are in back transition */}
                    {/* Actually, we need clouds during the forward transition even if showMRI is true, until they are gone */}
                    {(coverMode || (!showMRI && windyMode)) && (
                        <CloudsComponent 
                            windyMode={windyMode} 
                            coverMode={coverMode} 
                            showWindImage={false} 
                            onCloudGone={handleCloudGone}
                            isBackTransition={isBackTransition}
                            onCloudBack={handleCloudBack}
                            onSwap={handleSwap}
                        />
                    )}
                    {/* 只有非windyMode且非showMRI时渲染Blob和其他内容 */}
                    {!windyMode && !showMRI && (
                        <>
                            <Blob
                                currentPotatoData={displayPotatoes[currentIndex]}
                                windyMode={windyMode}
                                visualParams={primaryInfluence?.visualParams}
                            />
                            <Environment files="hdr-beautiful-scenery-beach-with-sunset-clouds.jpg" blurriness={15} />
                            <ContactShadows
                                rotation={[Math.PI / 2, 0, 0]}
                                position={[0, -1.7, 0]}
                                opacity={0.8}
                                width={15}
                                height={15}
                                blur={2.5}
                                far={1.6}
                            />
                        </>
                    )}
                    {/* MRI Viewer in 3D space */}
                    {showMRI && (
                        <>
                            <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
                            {/* MRI Potato on the LEFT side */}
                            <MRISlice 
                                mode={mriMode} 
                                position={[-2.5, 0, 0]} 
                                args={mriMode === 'transverse' ? [4, 4] : [4, 6]} 
                                isAnimating={isMriAnimating}
                                animationState={mriState}
                            />
                        </>
                    )}
                </Suspense>
            </Canvas>
            
            {/* MRI Info Panel - Right Side - 云移出后渐显 */}
            {showMRI && displayPotatoes && displayPotatoes[currentIndex] && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: '5%',
                    transform: 'translateY(-50%)',
                    width: '40%',
                    maxHeight: '80vh',
                    color: '#000',
                    fontFamily: 'Inter, sans-serif',
                    textAlign: 'left',
                    zIndex: 1000,
                    pointerEvents: 'auto',
                    opacity: mriTextOpacity,
                    transition: 'opacity 0.3s ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* 标题区域 - 固定不滚动 */}
                    <div style={{ flexShrink: 0 }}>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', lineHeight: '1.1' }}>
                            {displayPotatoes[currentIndex].specialParam}
                        </h1>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '300', marginBottom: '1.5rem', opacity: 0.8 }}>
                            {displayPotatoes[currentIndex].specialParamEn}
                        </h2>
                    </div>
                    
                    {/* 内容区域 - 可滚动 */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        borderTop: `2px solid rgba(0,0,0,${mriTextOpacity})`,
                        paddingTop: '1.5rem',
                        paddingRight: '8px',
                    }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>DETAILS</p>
                            <p style={{ fontSize: '1.1rem' }}>
                                {displayPotatoes[currentIndex].specialParamDetails}
                            </p>
                        </div>
                        
                        <div>
                            <p style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>DESCRIPTION</p>
                            <p style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.9 }}>
                                {displayPotatoes[currentIndex].englishDescription}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 环境影响属性列表 - 极简风格 */}
            {!windyMode && primaryInfluence && (
                <div style={{
                    position: 'fixed',
                    top: '100px',
                    left: '20px',
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    pointerEvents: 'none',
                    width: '300px',
                }}>
                    <div style={{
                        color: '#000000',
                        fontSize: '14px',
                        marginBottom: '20px',
                        letterSpacing: '1px',
                        fontWeight: 'normal',
                        opacity: 0.8
                    }}>
                        ENVIRONMENT: {primaryInfluence.label}
                    </div>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        width: '100%'
                    }}>
                        {primaryInfluence.attributes && primaryInfluence.attributes.map((attr, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px 0',
                            }}>
                                <span style={{
                                    color: '#000000',
                                    fontSize: '14px',
                                    marginRight: '8px',
                                    opacity: 0.7
                                }}>
                                    {attr.label}
                                </span>
                                <span style={{
                                    color: '#000000',
                                    fontSize: '14px',
                                }}>
                                    {attr.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {windyMode && showWindImage && !showPart3 && (
                <button
                    style={{
                        position: 'fixed',
                        bottom: '40px',
                        right: '40px',
                        zIndex: 4000,
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        border: `1.5px solid ${confirmHover ? '#fff' : '#111'}`,
                        color: confirmHover ? '#fff' : '#111',
                        fontSize: 22,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 32px 0 rgba(0,0,0,0.10)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.2s, border 0.2s',
                    }}
                    onClick={handleConfirm}
                    onMouseEnter={() => setConfirmHover(true)}
                    onMouseLeave={() => setConfirmHover(false)}
                >确认</button>
            )}
        </div>
    );
};

export default PotatoPlanet;