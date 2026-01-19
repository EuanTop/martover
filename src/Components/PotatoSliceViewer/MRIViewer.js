import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
uniform vec2 size;
out vec2 vUv;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    // Convert position.xy to 1.0-0.0
    vUv.xy = position.xy / size + 0.5;
    vUv.y = 1.0 - vUv.y; // original data is upside down
}
`;

const fragmentShader = `
precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray diffuse;
in vec2 vUv;
uniform float depth;

out vec4 outColor;

void main() {
    vec4 color = texture( diffuse, vec3( vUv, depth ) );
    // lighten a bit
    outColor = vec4( color.rrr * 1.5, 1.0 );
}
`;

const MRIViewer = ({ imageUrl = '/imgs/MRI.jpg', width = 50, height = 50, depthCount = 109 }) => {
    const meshRef = useRef();
    const [texture, setTexture] = useState(null);
    const { gl } = useThree();
    
    // Animation state
    const depthState = useRef({ value: 0, step: 0.4 });

    useEffect(() => {
        const loader = new THREE.ImageLoader();
        loader.load(imageUrl, (image) => {
            const size = 256; // Texture size
            const center = depthCount / 2;
            
            // Helper canvas for scaling and generating slices
            const helperCanvas = document.createElement('canvas');
            helperCanvas.width = size;
            helperCanvas.height = size;
            const helperCtx = helperCanvas.getContext('2d');

            const totalSize = size * size * depthCount;
            const array = new Uint8Array(totalSize);

            // Generate pseudo-3D volume from single 2D image
            // We simulate a spherical/ellipsoidal object by scaling the image based on depth
            for (let z = 0; z < depthCount; z++) {
                // Calculate scale based on sphere equation: x^2 + y^2 + z^2 = r^2
                // z is distance from center.
                const dist = Math.abs(z - center);
                const maxDist = depthCount / 2;
                
                // Normalize distance 0..1
                const normDist = dist / maxDist;
                
                // Scale factor. If we assume spherical volume:
                // scale = sqrt(1 - normDist^2)
                let scale = 0;
                if (normDist < 1) {
                    scale = Math.sqrt(1 - normDist * normDist);
                }
                
                // Clear canvas for this slice
                helperCtx.fillStyle = 'black';
                helperCtx.fillRect(0, 0, size, size);
                
                if (scale > 0) {
                    // Draw scaled image centered
                    const drawWidth = size * scale;
                    const drawHeight = size * scale;
                    const offsetX = (size - drawWidth) / 2;
                    const offsetY = (size - drawHeight) / 2;
                    
                    helperCtx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
                }
                
                const frameData = helperCtx.getImageData(0, 0, size, size).data;
                
                // Copy Red channel to 3D array
                for (let i = 0; i < size * size; i++) {
                    // frameData is RGBA (4 bytes)
                    // array is R (1 byte)
                    array[z * size * size + i] = frameData[i * 4];
                }
            }

            const texture3D = new THREE.DataArrayTexture(array, size, size, depthCount);
            texture3D.format = THREE.RedFormat;
            texture3D.needsUpdate = true;
            setTexture(texture3D);
        });
    }, [imageUrl, depthCount]);

    const uniforms = useMemo(() => ({
        diffuse: { value: null },
        depth: { value: 0 },
        size: { value: new THREE.Vector2(width, height) }
    }), [width, height]);

    useFrame(() => {
        if (meshRef.current && texture) {
            meshRef.current.material.uniforms.diffuse.value = texture;
            
            // Update depth animation
            let { value, step } = depthState.current;
            
            value += step;

            if (value > depthCount || value < 0.0) {
                if (value > depthCount) value = depthCount * 2.0 - value;
                if (value < 0.0) value = -value;
                step = -step;
            }
            
            depthState.current = { value, step };
            meshRef.current.material.uniforms.depth.value = value;
        }
    });

    if (!texture) return null;

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[width, height]} />
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                glslVersion={THREE.GLSL3}
                transparent={true}
                side={THREE.DoubleSide}
                depthWrite={false} // Prevent z-fighting or occlusion issues if transparent
                blending={THREE.AdditiveBlending} // Optional: makes it look more like a hologram/scan
            />
        </mesh>
    );
};

export default MRIViewer;
