import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Environment, MeshDistortMaterial, ContactShadows } from '@react-three/drei'
import { useSpring } from '@react-spring/core'
import { a } from '@react-spring/three'
import * as THREE from 'three'

const AnimatedMaterial = a(MeshDistortMaterial)

// 创建纹理的函数保持不变
function createStaticTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = '#FF732C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 文字设置
    ctx.fillStyle = 'black';
    ctx.font = '24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 文字换行
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    const maxWidth = canvas.width * 0.8;

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    // 绘制文字
    lines.forEach((line, i) => {
        ctx.fillText(
            line,
            canvas.width / 4,
            canvas.height / 2 + (i - lines.length / 2) * 40
        );
    });

    const texture = new THREE.CanvasTexture(canvas);
    // texture.center.set(0.5, 0.5);  // 设置旋转中心点
    // texture.rotation = -Math.PI / 2;  // 可以尝试不同的角度
    texture.needsUpdate = true;
    return texture;
}

function Blob({ description }) {
    const sphere = useRef();
    const light = useRef();
    const [hovered, setHovered] = useState(false);
    const [texture] = useState(() => createStaticTexture(description));

    // 鼠标跟随和扭动动画
    useFrame((state) => {
        if (light.current) {
            light.current.position.x = state.mouse.x * 20
            light.current.position.y = state.mouse.y * 20
        }
        if (sphere.current) {
            sphere.current.position.x = THREE.MathUtils.lerp(
                sphere.current.position.x, 
                hovered ? state.mouse.x / 2 : 0, 
                0.2
            )
            sphere.current.position.y = THREE.MathUtils.lerp(
                sphere.current.position.y,
                Math.sin(state.clock.elapsedTime / 1.5) / 6 + (hovered ? state.mouse.y / 2 : 0),
                0.2
            )
        }
    })

    // 扭动和颜色动画
    const [{ wobble, color, env }] = useSpring(
        {
            wobble: hovered ? 1.05 : 1,
            env: 1,
            color: hovered ? '#FF8F5E' : '#ffffff',
            config: { mass: 2, tension: 1000, friction: 10 }
        },
        [hovered]
    )

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={75}>
                <a.pointLight ref={light} position-z={-15} intensity={1.5} color="#ffffff" />
            </PerspectiveCamera>
            <a.mesh
                ref={sphere}
                scale={wobble}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[1, 64, 64]} />
                <AnimatedMaterial
                    color={color}
                    envMapIntensity={env}
                    clearcoat={1}
                    clearcoatRoughness={0}
                    metalness={0.2}
                    distort={0.4} // 扭动强度
                    speed={2} // 扭动速度
                    map={texture}
                    transparent
                    opacity={0.9}
                />
            </a.mesh>
        </>
    )
}

export default function PotatoPlanet({ description }) {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas gl={{ antialias: true }}>
                <Suspense fallback={null}>
                    <Blob description={description} />
                    <Environment preset="sunset" />
                    <ContactShadows
                        rotation={[Math.PI / 2, 0, 0]}
                        position={[0, -1.7, 0]}
                        opacity={0.8}
                        width={15}
                        height={15}
                        blur={2.5}
                        far={1.6}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}