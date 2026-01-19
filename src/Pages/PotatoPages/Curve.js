// import * as THREE from 'three'

// export function createCirclePath(radius = 3) {
//   const curve = new THREE.EllipseCurve(
//     0, 0,            // 中心点
//     radius, radius,  // X和Y方向的半径
//     0, 2 * Math.PI,  // 起始角度和结束角度
//     false,           // 是否逆时针
//     0               // 起始角度的偏移量
//   )

//   const points = curve.getPoints(50)
//   const points3D = points.map(point => new THREE.Vector3(point.x, point.y, 0))
  
//   // 创建 CurvePath 对象
//   const path = new THREE.CurvePath()
//   for (let i = 0; i < points3D.length - 1; i++) {
//     const lineCurve = new THREE.LineCurve3(points3D[i], points3D[i + 1])
//     path.add(lineCurve)
//   }
//   // 闭合路径
//   path.add(new THREE.LineCurve3(points3D[points3D.length - 1], points3D[0]))

//   return path
// }

// // 用于可视化路径的组件
// export const Circle = ({ radius = 3 }) => {
//   const points = createCirclePath(radius).curves.flatMap(curve => [curve.v1, curve.v2])
  
//   return (
//     <line>
//       <bufferGeometry>
//         <bufferAttribute
//           attach="attributes-position"
//           count={points.length}
//           array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
//           itemSize={3}
//         />
//       </bufferGeometry>
//       <lineBasicMaterial color="#000000" opacity={0.3} transparent />
//     </line>
//   )
// }