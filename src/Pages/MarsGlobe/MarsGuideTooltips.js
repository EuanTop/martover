import React, { useState, useEffect, useMemo } from 'react';
import { useSpring, animated } from '@react-spring/web';
import CraterRadarChart from '../../Components/CraterRadarChart/CraterRadarChart';
import { calculateCraterScores, generateEvaluation } from '../../utils/craterScoring';

// 完全重新实现逐字显示，彻底避免undefined问题
const TypewriterEffect = ({ text = "", delay = 0, speed = 30 }) => {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    let timeout;
    let index = 0;
    
    const typeNextChar = () => {
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
        timeout = setTimeout(typeNextChar, speed);
      } else {
        setIsComplete(true);
      }
    };
    
    // 初始延迟
    timeout = setTimeout(typeNextChar, delay);
    
    return () => clearTimeout(timeout);
  }, [text, delay, speed]);
  
  // 使用简单的行内样式避免嵌套组件
  return (
    <div>
      {displayText.split('').map((char, idx) => (
        <span 
          key={idx}
          className="inline-block"
          style={{
            animation: isComplete ? 
              `${Math.random() > 0.9 ? 'glitch 3s ease-in-out infinite' : ''}` : 'none'
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
};

const MarsGuideTooltips = ({ showMars, hasFinishedMoving, selectedCrater, isDarkMode }) => {
  // 决定是否显示提示
  const [showTooltips, setShowTooltips] = useState(false);
  // 当前步骤 - 0: 初始介绍, 1: 选择火星坑(合并了之前的详细参数提示), 2: 雷达图分析
  const [currentStep, setCurrentStep] = useState(0);

  // 计算陨石坑评分
  const scores = useMemo(() => selectedCrater ? calculateCraterScores(selectedCrater) : {}, [selectedCrater]);
  const evaluation = useMemo(() => selectedCrater ? generateEvaluation(scores, selectedCrater) : '', [scores, selectedCrater]);
  
  // 更新提示显示状态
  useEffect(() => {
    if (showMars && hasFinishedMoving) {
      setShowTooltips(true);
      
      // 检查是否已经选择了火星坑，更新步骤
      if (selectedCrater) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    } else {
      setShowTooltips(false);
    }
  }, [showMars, hasFinishedMoving, selectedCrater]);
  
  // 当选择火星坑时更新步骤
  useEffect(() => {
    if (selectedCrater && currentStep < 2) {
      setCurrentStep(2);
    } else if (!selectedCrater && currentStep > 1) {
      setCurrentStep(1);
    }
  }, [selectedCrater, currentStep]);
  
  // 顶部框的动画
  const introBoxAnimation = useSpring({
    opacity: showTooltips ? 1 : 0,
    transform: showTooltips ? 'translateX(0)' : 'translateX(-50px)',
    config: { tension: 120, friction: 14 },
    delay: 300,
  });
  
  // 底部框的动画，在顶部框之后出现
  const guideBoxAnimation = useSpring({
    opacity: showTooltips ? 1 : 0,
    transform: showTooltips ? 'translateX(0)' : 'translateX(-50px)',
    config: { tension: 120, friction: 14 },
    delay: 600,
  });
  
  // 如果不显示提示，则不渲染
  if (!showTooltips) return null;

  return (
    <div className="fixed left-5 top-0 bottom-0 z-40 flex flex-col justify-center pointer-events-none" style={{ width: "20vw" }}>
      {/* INTRO 框 - 上方，占据30%高度 */}
      <animated.div 
        className="w-full rounded-none relative overflow-hidden border border-[#562913]"
        style={{
          ...introBoxAnimation,
          height: "20vh",
          marginBottom: "1vh",
          background: "transparent", // 无底色填充
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          position: "relative" // 确保定位上下文
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center p-4 pb-2 relative z-10">
          <div className="w-2 h-2 rounded-full bg-[#562913] mr-2 animate-pulse"></div>
          <div className="text-[#562913] text-sm tracking-wider">INTRO</div>
          <div className="flex-grow h-[1px] bg-[#562913]/50 ml-2"></div>
        </div>
        
        {/* 内容 */}
        <div className="text-[#562913] text-sm leading-relaxed p-4 pt-0 relative z-10">
          <TypewriterEffect 
            text="火星有超过300,000个陨石撞击坑，这里面有小部分是火星农业理想地。撞击坑维度很复杂，您可以耐心挑选，也可以相信第七感。" 
            delay={500}
            speed={30}
          />
        </div>
        
        {/* 扫描线效果 - 修改为完全覆盖 */}
        <div 
          className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none opacity-10 z-0"
          style={{ 
            background: 'linear-gradient(transparent 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%)',
            backgroundSize: '100% 8px',
            animation: 'scanline 8s linear infinite',
            width: '100%',
            height: '2000%' // 增加高度确保完全覆盖
          }}
        ></div>
      </animated.div>
      
      {/* 步骤指南框 - 下方，占据60%高度 */}
      <animated.div 
        className="w-full rounded-none relative overflow-hidden border border-[#562913]"
        style={{
          ...guideBoxAnimation,
          height: "60vh",
          background: "transparent", // 无底色填充
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          position: "relative" // 确保定位上下文
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center p-4 pb-2 relative z-10">
          <div className="w-2 h-2 rounded-full bg-[#562913] mr-2 animate-pulse"></div>
          <div className="text-[#562913] text-sm tracking-wider">GUIDE</div>
          <div className="flex-grow h-[1px] bg-[#562913]/50 ml-2"></div>
          <div className="text-[#562913] text-xs ml-2">{`STEP ${currentStep}/2`}</div>
        </div>
        
        {/* 步骤内容 - 修复滚动和行距问题 */}
        <div
          className="text-[#562913] text-sm p-4 pt-0 h-[calc(60vh-64px)] overflow-y-auto relative z-10"
          style={{ lineHeight: "1.4", pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          {currentStep === 1 && (
            <div className="space-y-2">
              <TypewriterEffect
                text="火星上闪烁的黑点就是撞击坑，请自由选择；"
                delay={300}
                speed={30}
              />
              
              <div className="pt-2">
                <TypewriterEffect
                  text="陨石撞击坑有非常多参数，请参考详细参数面板左上角的提示（当然，您可凭借视觉带来的直观感受选择）；"
                  delay={1500}
                  speed={30}
                />
              </div>

              <div className="pt-2">
                <TypewriterEffect
                  text="我可以告诉您几条细则："
                  delay={3500}
                  speed={30}
                />
              </div>
              
              <ul className="space-y-1 pl-4">
                <li>
                  <TypewriterEffect
                    text="1. 形状层次丰富 - 溅射层变化大"
                    delay={4000}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="2. 颜色较浅 - 退行性更低，可能蕴含更多有益矿物质和气体"
                    delay={4300}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="3. 坑底纹丰富 - 具有Rd溅射层"
                    delay={4600}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="4. 坑底是方形 - CpxFF比Smp具有水资源概率更高"
                    delay={4900}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="5. 坑内具有中央高原CpxCMa - 平坦区域便于建造温室，抵抗温度波动"
                    delay={5200}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="6. 高纬度陨石坑更可能有水冰"
                    delay={5500}
                    speed={30}
                  />
                </li>
                <li>
                  <TypewriterEffect
                    text="7. 不选择简单陨石坑，空间有限，不适合大规模农业"
                    delay={5800}
                    speed={30}
                  />
                </li>
              </ul>
            </div>
          )}
          
          {currentStep === 2 && selectedCrater && (
            <div className="flex flex-col items-center pt-2 animate-fadeIn">
              <div className="w-full text-center mb-4">
                <h3 className="text-lg" style={{ color: isDarkMode ? 'white' : '#562913' }}>
                  陨石坑评估分析
                </h3>
              </div>
              
              <div className="mb-4">
                <CraterRadarChart scores={scores} size={180} isDarkMode={isDarkMode} />
              </div>
              
              <div className="w-full text-sm leading-relaxed p-2 rounded border border-opacity-20"
                   style={{
                     color: isDarkMode ? 'white' : '#562913',
                     borderColor: isDarkMode ? 'white' : '#562913',
                     backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(86,41,19,0.05)'
                   }}>
                <div className="flex flex-col space-y-1">
                  {evaluation.split(' | ').map((text, index) => (
                    <div key={index}>
                      <TypewriterEffect
                        text={text}
                        delay={300 + (index * 300)}
                        speed={20}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* 扫描线效果 - 修改为完全覆盖 */}
        <div 
          className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none opacity-10 z-0"
          style={{ 
            background: 'linear-gradient(transparent 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)',
            backgroundSize: '100% 8px',
            animation: 'scanline 8s linear infinite',
            width: '100%',
            height: '2000%' // 增加高度确保完全覆盖
          }}
        ></div>
        
        {/* 底部数据流动画效果 */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden z-10">
          <div 
            className="h-full bg-[#562913]"
            style={{
              width: '30%',
              animation: 'dataFlow 3s linear infinite'
            }}
          ></div>
        </div>
      </animated.div>
      
      {/* 添加全局样式 */}
      <style jsx="true">{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        
        @keyframes dataFlow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        
        @keyframes glitch {
          0%, 100% { transform: none; opacity: 1; }
          7% { transform: skew(-0.5deg, -0.9deg); opacity: 0.75; }
          10% { transform: none; opacity: 1; }
          27% { transform: none; opacity: 1; }
          30% { transform: skew(0.8deg, -0.1deg); opacity: 0.75; }
          35% { transform: none; opacity: 1; }
          74% { transform: none; opacity: 1; }
          78% { transform: skew(-0.3deg, 0.2deg); opacity: 0.75; }
          80% { transform: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default MarsGuideTooltips;