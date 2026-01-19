// import React, { useRef, useMemo } from 'react';
// import { useFrame } from '@react-three/fiber';
// import { Clouds, Cloud } from '@react-three/drei';

// const DecorationClouds = ({ isDarkMode }) => {
//   const cloudsRefs = useRef([]);
  
//   const decorativeClouds = useMemo(() => {
//     return Array(8).fill().map((_, i) => ({
//       position: [
//         (Math.random() - 0.5) * 30,  // 分布更广
//         (Math.random() - 0.5) * 15,
//         20  // 放得更前面
//       ],
//       scale: 3 + Math.random() * 4,  // 更大的云
//       rotationSpeed: (Math.random() * 0.0002 - 0.0001),
//       driftSpeed: {
//         x: (Math.random() - 0.5) * 0.001,
//         y: (Math.random() - 0.5) * 0.0005,
//       },
//       opacity: isDarkMode ? 0.15 : 0.2  // 增加透明度，使云更明显
//     }));
//   }, [isDarkMode]);

//   useFrame((state, delta) => {
//     cloudsRefs.current.forEach((ref, i) => {
//       if (!ref) return;
      
//       const cloud = decorativeClouds[i];
      
//       // 缓慢旋转
//       ref.rotation.z += cloud.rotationSpeed;
      
//       // 更缓慢的漂移
//       const time = state.clock.getElapsedTime();
//       ref.position.x = cloud.position[0] + Math.sin(time * 0.1 + i) * 2;
//       ref.position.y = cloud.position[1] + Math.cos(time * 0.08 + i) * 1;
//     });
//   });

//   return (
//     <group position={[0, 0, 20]}>  {/* 整体放在前方 */}
//       {decorativeClouds.map((cloud, i) => (
//         <group
//           key={i}
//           ref={el => {
//             if (!cloudsRefs.current[i]) cloudsRefs.current[i] = el;
//           }}
//           position={cloud.position}
//           scale={cloud.scale}
//         >
//           <Clouds texture="/imgs/cloud.png">
//             <Cloud
//               opacity={cloud.opacity}
//               speed={0}
//               width={25}
//               depth={2}
//               segments={20}
//               color={isDarkMode ? '#ffffff' : '#000000'}
//               transparent={true}
//             />
//           </Clouds>
//         </group>
//       ))}
//     </group>
//   );
// };

// export default DecorationClouds;