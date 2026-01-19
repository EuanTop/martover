// import React, { useState, useEffect } from 'react';
// import { animated, useSpring } from '@react-spring/web';

// // 引导步骤枚举
// export const TOUR_STEPS = {
//   NONE: 0,
//   CLICK_CRATER: 1,
//   CRATER_PROPERTIES: 2,
//   COMPLETE: 3
// };

// // 属性说明列表，移除ID、位置、直径这三个简单项
// const PROPERTY_EXPLANATIONS = [
//   {
//     key: 'layers',
//     title: '层数',
//     description: '表示火星坑喷射物的层数，反映了撞击事件的复杂程度。'
//   },
//   {
//     key: 'ejectaMorph',
//     title: '溅射物形态',
//     description: '描述了火星坑喷射物的形态特征，如放射状、蝶形等。'
//   },
//   {
//     key: 'internalMorph',
//     title: '坑内形态',
//     description: '描述了火星坑的内部结构特征，对研究撞击机制很重要。'
//   },
//   {
//     key: 'ray',
//     title: '射线坑',
//     description: '表示该坑是否为射线坑。射线坑周围有明显的放射状喷射物，年龄相对较年轻。'
//   },
//   {
//     key: 'degradation',
//     title: '退化程度',
//     description: '表示坑的各部分退化情况，包括边缘、溅射物和底部，反映了形成时间和风化过程。'
//   },
//   {
//     key: 'notes',
//     title: '备注信息',
//     description: '包含了关于该火星坑的特殊观察记录和额外细节。'
//   }
// ];

// // 单个属性弹窗组件
// const PropertyTooltip = ({ property, position, isDarkMode }) => {
//   const tooltipAnimation = useSpring({
//     from: { opacity: 0, transform: 'scale(0.8)' },
//     to: { opacity: 1, transform: 'scale(1)' },
//     config: { tension: 300, friction: 20 },
//     delay: position.index * 100 // 添加延迟使弹出有序
//   });

//   // 修改为单列布局，放置在Panel左侧
//   const tooltipPosition = {
//     x: position.panelLeft - 280, // Panel左侧偏移280px
//     y: position.panelTop + 100 + position.index * 120 // 从Panel顶部开始，下移100px，每个tooltip间隔120px
//   };

//   return (
//     <div className="absolute" style={{
//       left: tooltipPosition.x + 'px',
//       top: tooltipPosition.y + 'px',
//       pointerEvents: 'none' // 确保鼠标事件可以穿透弹窗
//     }}>
//       <animated.div 
//         style={{
//           opacity: tooltipAnimation.opacity,
//           transform: tooltipAnimation.transform,
//           zIndex: 999 // 设置较低的z-index，确保自定义鼠标在上层
//         }}
//       >
//         <div 
//           className={`relative p-3 rounded-lg ${isDarkMode ? 'bg-[#262626] text-white' : 'bg-[#FF996D] text-black'}`}
//           style={{ 
//             // 修改为黑色描边，与Panel保持一致
//             border: `1px solid black`,
//             boxShadow: `0 4px 6px rgba(0, 0, 0, 0.1)`,
//             width: '250px',
//             maxHeight: '100px',
//             overflowY: 'auto'
//           }}
//         >
//           <h3 className="text-md font-bold mb-1">{property.title}</h3>
//           <p className="text-xs">{property.description}</p>
//         </div>
//       </animated.div>
//     </div>
//   );
// };

// const TourGuide = ({ 
//   currentStep, 
//   onNextStep, 
//   onComplete, 
//   targetCraterPosition, 
//   isDarkMode, 
//   panelRef,
//   disablePanelClose // 新增参数，控制是否禁用Panel关闭
// }) => {
//   const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
//   // 日志记录辅助功能
//   const logPositioning = (message, data = {}) => {
//     console.log(`[TourGuide] ${message}`, data);
//   };

//   // 根据当前步骤获取提示信息
//   const getTooltipConfig = () => {
//     switch (currentStep) {
//       case TOUR_STEPS.CLICK_CRATER:
//         return {
//           title: "点击这个坑",
//           message: "请点击此处的火星坑，探索其详细数据。",
//           position: targetCraterPosition,
//           selector: null
//         };
//       case TOUR_STEPS.COMPLETE:
//         return {
//           title: "引导完成",
//           message: "您已了解所有关键数据。现在可以选择此坑，或继续探索其他火星坑。",
//           selector: null,
//           position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
//         };
//       default:
//         return {
//           title: "探索火星",
//           message: "点击任意位置继续探索。",
//           position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
//           selector: null
//         };
//     }
//   };

//   // 动画配置
//   const tooltipAnimation = useSpring({
//     opacity: (currentStep === TOUR_STEPS.CLICK_CRATER || currentStep === TOUR_STEPS.COMPLETE) ? 1 : 0,
//     transform: (currentStep === TOUR_STEPS.CLICK_CRATER || currentStep === TOUR_STEPS.COMPLETE) ? 'scale(1)' : 'scale(0.8)',
//     config: { tension: 300, friction: 20 }
//   });

//   // 计算属性弹窗位置的基准点
//   const [propertyBasePosition, setPropertyBasePosition] = useState({ 
//     panelLeft: 0, 
//     panelTop: 0, 
//     panelWidth: 0 
//   });

//   // 更新定位逻辑
//   useEffect(() => {
//     const config = getTooltipConfig();
    
//     // 用于首个提示的位置处理
//     if (currentStep === TOUR_STEPS.CLICK_CRATER && targetCraterPosition) {
//       setTooltipPosition({
//         x: targetCraterPosition.x + 30,
//         y: targetCraterPosition.y - 50
//       });
//       logPositioning("点击坑位提示位置", targetCraterPosition);
//       return;
//     }
    
//     // 用于最终完成提示的位置处理
//     if (currentStep === TOUR_STEPS.COMPLETE) {
//       setTooltipPosition({
//         x: window.innerWidth / 2 - 110,
//         y: window.innerHeight / 2 - 100
//       });
//       logPositioning("完成提示位置", { x: window.innerWidth / 2 - 110, y: window.innerHeight / 2 - 100 });
//       return;
//     }
    
//     // 对于属性面板提示的位置处理
//     if (currentStep === TOUR_STEPS.CRATER_PROPERTIES && panelRef && panelRef.current) {
//       // 获取Panel元素的位置和尺寸
//       const panelRect = panelRef.current.getBoundingClientRect();
      
//       // 设置属性弹窗基准位置 - 改为基于Panel的位置
//       setPropertyBasePosition({
//         panelLeft: panelRect.left,
//         panelTop: panelRect.top,
//         panelWidth: panelRect.width
//       });
      
//       logPositioning("Panel位置", { 
//         left: panelRect.left, 
//         top: panelRect.top,
//         width: panelRect.width 
//       });
//     }
//   }, [currentStep, targetCraterPosition, panelRef]);
  
//   // 如果当前步骤为NONE，不显示任何内容
//   if (currentStep === TOUR_STEPS.NONE) {
//     return null;
//   }

//   const config = getTooltipConfig();

//   // 修改TourGuide组件的层级，确保在阻止层之上
//   return (
//     <div className="fixed inset-0 z-[999] pointer-events-none">
//       {/* 属性解释弹窗 */}
//       {currentStep === TOUR_STEPS.CRATER_PROPERTIES && (
//         <>
//           {PROPERTY_EXPLANATIONS.map((property, index) => (
//             <PropertyTooltip 
//               key={property.key}
//               property={property}
//               position={{...propertyBasePosition, index}}
//               isDarkMode={isDarkMode}
//             />
//           ))}

//           {/* 继续按钮 - 确保可交互 */}
//           <div className="absolute right-10 bottom-10 pointer-events-auto">
//             <animated.div 
//               style={{
//                 opacity: 1,
//                 zIndex: 999
//               }}
//             >
//               <button
//                 className={`mt-3 px-5 py-2 rounded ${
//                   isDarkMode 
//                     ? 'bg-[#DA6C36] text-white hover:bg-[#E87B45]' 
//                     : 'bg-[#D76B30] text-white hover:bg-[#E87B45]'
//                 } transition-colors`}
//                 onClick={onNextStep}
//                 style={{ 
//                   cursor: 'pointer',
//                   border: `1px solid black`, // 黑色描边
//                   boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                 }}
//               >
//                 我已了解
//               </button>
//             </animated.div>
//           </div>
//         </>
//       )}

//       {/* 点击火星坑和完成提示弹窗 - 增强z-index并确保可交互 */}
//       {(currentStep === TOUR_STEPS.CLICK_CRATER || currentStep === TOUR_STEPS.COMPLETE) && (
//         <div className="absolute pointer-events-auto" style={{
//           left: tooltipPosition.x + 'px',
//           top: tooltipPosition.y + 'px',
//           zIndex: 999 // 确保高于阻止层
//         }}>
//           <animated.div 
//             style={{
//               opacity: tooltipAnimation.opacity,
//               transform: tooltipAnimation.transform,
//               zIndex: 999
//             }}
//           >
//             <div 
//               className={`relative p-4 rounded-lg ${isDarkMode ? 'bg-[#262626] text-white' : 'bg-[#FF996D] text-black'}`}
//               style={{ 
//                 border: `1px solid black`, // 修改为黑色描边
//                 boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
//                 width: '220px'
//               }}
//               onClick={currentStep < TOUR_STEPS.COMPLETE ? onNextStep : onComplete}
//             >
//               <h3 className="text-lg font-bold mb-2">{config.title}</h3>
//               <p className="text-sm">{config.message}</p>
              
//               {currentStep === TOUR_STEPS.COMPLETE && (
//                 <button
//                   className={`mt-3 px-3 py-1 rounded ${
//                     isDarkMode 
//                       ? 'bg-[#DA6C36] text-white hover:bg-[#E87B45]' 
//                       : 'bg-[#D76B30] text-white hover:bg-[#E87B45]'
//                   } transition-colors`}
//                   onClick={onComplete}
//                   style={{ 
//                     cursor: 'pointer',
//                     border: `1px solid black`, // 修改为黑色描边
//                     boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                   }}
//                 >
//                   完成引导
//                 </button>
//               )}
//             </div>
//           </animated.div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default TourGuide;