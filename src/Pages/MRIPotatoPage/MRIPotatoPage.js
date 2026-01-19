import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uProgress; // 0 to 1
uniform float uFusion;   // 0.0 to 1.0 (Line density / Reveal)
uniform float uExpansion; // 0.0 (Collapsed) to 1.0 (Spread)
varying vec2 vUv;

// --- Noise Functions ---
// Simplex 3D Noise 
// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0.0 + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N=0.125*1/sqrt(3) ) // N=0.0721687836
  float n_ = 1.0/7.0; // N=0.142857142857
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// FBM (Fractal Brownian Motion) for organic texture
float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 6; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// Domain Warping for more organic/fluid look
float warpedFbm(vec3 p) {
    vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, 0.0)),
        fbm(p + vec3(5.2, 1.3, 2.8)),
        fbm(p + vec3(1.8, 9.2, 5.5))
    );
    return fbm(p + 4.0 * q);
}

// --- Transverse Section (Cross-section) ---
vec4 getTransverseColor(vec2 vUv, float uTime, float uProgress) {
    // Normalize UV to -1..1
    vec2 p = vUv * 2.0 - 1.0;
    
    // Z coordinate logic
    float z = mix(-1.2, 0.0, min(uProgress, 1.0));
    if (uProgress >= 1.0) z += sin(uTime * 0.5) * 0.02;
    
    vec3 pos = vec3(p, z);
    
    // Shape
    float shapeNoise = snoise(pos * 1.0); 
    float skinRoughness = snoise(pos * 20.0) * 0.02;
    float r = length(pos) + shapeNoise * 0.15 + skinRoughness;
    float alpha = 1.0 - smoothstep(0.85, 0.88, r);
    if (alpha < 0.01) return vec4(0.0);
    
    // Internal Structure
    float angle = atan(p.y, p.x);
    float dist = length(p);
    
    // Vascular Ring
    float ringDistortion = warpedFbm(vec3(angle * 3.0, z * 2.0, uTime * 0.05)) * 0.15;
    float ringRadius = 0.65 + ringDistortion;
    float ringWidth = 0.03 + 0.02 * snoise(vec3(angle * 10.0, z, 1.0));
    float vascularRing = 1.0 - smoothstep(ringWidth, ringWidth + 0.05, abs(dist - ringRadius));
    
    // Inner Pith
    float starNoise = snoise(vec3(angle * 5.0, dist * 3.0, z));
    float innerPithMask = smoothstep(0.1, 0.35, dist + starNoise * 0.2); 
    float innerPith = (1.0 - innerPithMask);
    
    // Cortex & Outer Pith
    float tissue = warpedFbm(pos * 3.0 + vec3(0,0,uTime*0.02));
    float voids = smoothstep(0.4, 0.6, snoise(pos * 8.0 + 10.0));
    
    // Composition
    float val = 0.0;
    val += innerPith * (0.7 + 0.3 * tissue);
    if (vascularRing > 0.5) val = mix(val, 0.2, 0.8);
    
    float outerRegion = smoothstep(0.25, 0.4, dist);
    float meat = 0.5 + 0.5 * tissue;
    meat *= (0.8 + 0.2 * voids);
    float shadows = snoise(pos * 2.0 + 50.0);
    meat *= (0.8 + 0.2 * shadows);
    val += outerRegion * meat;
    
    // Skin
    float skin = smoothstep(0.82, 0.85, r) - smoothstep(0.88, 0.9, r);
    skin *= (0.8 + 0.4 * snoise(pos * 50.0));
    val += skin * 0.9; 
    
    // Adjustments
    val = smoothstep(0.15, 0.9, val);
    float grain = fract(sin(dot(vUv.xy + uTime * 0.1 ,vec2(12.9898,78.233))) * 43758.5453);
    val -= grain * 0.08;
    float scanline = sin(vUv.y * 200.0 + uTime * 10.0) * 0.02;
    val += scanline;

    // --- COLOR MAPPING FOR ORANGE BACKGROUND ---
    // Structure Density = val
    // Color = Black (0,0,0)
    // Alpha = val * 0.9 (Semi-transparent black)
    
    return vec4(vec3(0.0), val * 0.9 * alpha);
}

// --- Longitudinal Section (Vertical cut) ---
vec4 getLongitudinalColor(vec2 vUv, float uTime, float uProgress) {
    // Zoom out slightly to prevent clipping at edges
    vec2 p = (vUv * 2.0 - 1.0) * 1.2; 
    
    // Adjust for physical aspect ratio (assuming taller geometry, e.g. 6x9)
    vec2 p_physical = vec2(p.x, p.y * 1.5);
    
    // --- Animation: Scan Depth ---
    float scanDepth = mix(1.0, 0.0, min(uProgress, 1.0));
    float sliceScale = sqrt(max(0.0, 1.0 - scanDepth * scanDepth));
    
    if (sliceScale < 0.05) return vec4(0.0);
    
    // --- 1. Shape & Skin ---
    float shapeNoise = snoise(vec3(p_physical * 0.8, 0.0));
    float skinRoughness = snoise(vec3(p_physical * 20.0, 0.0)) * 0.02; 
    
    // Buds (Increased to 4: Apical + 3 Lateral)
    // Positions relative to center
    vec2 apicalPos = vec2(0.05, 1.1); // Top, slightly offset
    vec2 lat1 = vec2(0.7, 0.3);       // Right Mid
    vec2 lat2 = vec2(-0.65, -0.2);    // Left Low
    vec2 lat3 = vec2(0.6, -0.7);      // Right Low
    
    float dApical = length(p_physical - apicalPos);
    float dLat1 = length(p_physical - lat1);
    float dLat2 = length(p_physical - lat2);
    float dLat3 = length(p_physical - lat3);
    
    // Indentations for buds (Eyes)
    float eyeIndent = 0.0;
    eyeIndent += smoothstep(0.4, 0.0, dApical) * 0.25;
    eyeIndent += smoothstep(0.35, 0.0, dLat1) * 0.2;
    eyeIndent += smoothstep(0.35, 0.0, dLat2) * 0.2;
    eyeIndent += smoothstep(0.35, 0.0, dLat3) * 0.2;
    
    // Radius calculation
    float r_base = length(p_physical * vec2(0.9, 0.65)); 
    float r_distorted = r_base + shapeNoise * 0.05 + skinRoughness + eyeIndent * 0.6;
    
    // Alpha Mask (Clipping)
    float alpha = 1.0 - smoothstep(sliceScale - 0.02, sliceScale + 0.01, r_distorted);
    if (alpha < 0.01) return vec4(0.0);
    
    // --- 2. Internal Anatomy (Stout Tree Pith) ---
    
    // Main Stem (Medulla) - Thick at bottom, tapers up
    float twist = snoise(vec3(p_physical.y * 2.0, uTime * 0.05, 0.0)) * 0.1;
    float stemX = p_physical.x + twist;
    float distToStem = abs(stemX);
    
    // Tapering logic: Thick at y=-1.0, Thin at y=1.0
    // Map y from -1.5 to 1.5 roughly
    float normY = (p_physical.y + 1.5) / 3.0; // 0 to 1
    float stemThicknessBase = mix(0.25, 0.02, clamp(normY * 1.5, 0.0, 1.0)); // Taper quickly
    // Cut off stem before it hits the very top skin
    stemThicknessBase *= smoothstep(1.1, 0.8, p_physical.y);
    
    // Add noise to thickness
    float stemThickness = stemThicknessBase + 0.05 * snoise(vec3(p_physical.y * 5.0, 0.0, 0.0));
    
    // Branches (Medullary Rays)
    // Function to calculate branch distance with tapering
    float branchMask = 0.0;
    
    // Helper for branches
    // start: vec2(0, startY), end: targetPos
    // thickness: startThickness -> endThickness
    vec2 bStart1 = vec2(twist, 0.3 * 0.5); // Start near stem at appropriate height
    vec2 bStart2 = vec2(twist, -0.2 * 0.5);
    vec2 bStart3 = vec2(twist, -0.7 * 0.5);
    vec2 bStartApical = vec2(twist, 0.8);
    
    // Branch 1 (Right Mid)
    vec2 pa1 = p_physical - bStart1;
    vec2 ba1 = lat1 - bStart1;
    float h1 = clamp( dot(pa1,ba1)/dot(ba1,ba1), 0.0, 1.0 );
    float d1 = length( pa1 - ba1*h1 );
    float thick1 = mix(stemThicknessBase * 0.8, 0.02, h1); // Taper
    branchMask = max(branchMask, smoothstep(thick1, thick1 - 0.05, d1));

    // Branch 2 (Left Low)
    vec2 pa2 = p_physical - bStart2;
    vec2 ba2 = lat2 - bStart2;
    float h2 = clamp( dot(pa2,ba2)/dot(ba2,ba2), 0.0, 1.0 );
    float d2 = length( pa2 - ba2*h2 );
    float thick2 = mix(stemThicknessBase * 0.8, 0.02, h2);
    branchMask = max(branchMask, smoothstep(thick2, thick2 - 0.05, d2));
    
    // Branch 3 (Right Low)
    vec2 pa3 = p_physical - bStart3;
    vec2 ba3 = lat3 - bStart3;
    float h3 = clamp( dot(pa3,ba3)/dot(ba3,ba3), 0.0, 1.0 );
    float d3 = length( pa3 - ba3*h3 );
    float thick3 = mix(stemThicknessBase * 0.8, 0.02, h3);
    branchMask = max(branchMask, smoothstep(thick3, thick3 - 0.05, d3));
    
    // Apical Branch (Top)
    vec2 paA = p_physical - bStartApical;
    vec2 baA = apicalPos - bStartApical;
    float hA = clamp( dot(paA,baA)/dot(baA,baA), 0.0, 1.0 );
    float dA = length( paA - baA*hA );
    float thickA = mix(stemThicknessBase, 0.01, hA);
    branchMask = max(branchMask, smoothstep(thickA, thickA - 0.05, dA));

    // Combine Stem and Branches
    float pithStructure = smoothstep(stemThickness, stemThickness - 0.05, distToStem);
    pithStructure = max(pithStructure, branchMask);
    
    // Add "Ginger" texture
    float pithNoise = warpedFbm(vec3(p_physical * 3.0, uProgress));
    pithStructure *= (0.8 + 0.3 * pithNoise);
    
    // --- 3. Vascular Ring ---
    float ringPos = sliceScale * 0.75; 
    float vascularDist = abs(r_distorted - ringPos); 
    float vascularNoise = snoise(vec3(p_physical * 5.0, uTime * 0.1));
    float vascularRing = 1.0 - smoothstep(0.02, 0.06, vascularDist + vascularNoise * 0.02);

    // --- 4. Textures & Composition ---
    float tissue = warpedFbm(vec3(p_physical * 2.5, uProgress));
    float voids = smoothstep(0.4, 0.6, snoise(vec3(p_physical * 8.0 + 10.0, uProgress)));
    
    float val = 0.0;
    
    // Cortex (Meat)
    float outerRegion = 1.0 - pithStructure;
    float meat = 0.5 + 0.5 * tissue;
    meat *= (0.8 + 0.2 * voids);
    float shadows = snoise(vec3(p_physical * 2.0 + 50.0, 0.0));
    meat *= (0.8 + 0.2 * shadows);
    
    val += outerRegion * meat;

    // Vascular Ring (Dark) - Apply BEFORE Pith so Pith can overlay it
    if (vascularRing > 0.5) val = mix(val, 0.2, 0.8);

    // Pith (Bright/White) - Apply AFTER Vascular Ring to sit on top
    val += pithStructure * (0.9 + 0.2 * tissue); 
    
    // Skin
    float skin = smoothstep(sliceScale - 0.05, sliceScale - 0.02, r_distorted) - smoothstep(sliceScale + 0.01, sliceScale + 0.04, r_distorted);
    skin *= (0.8 + 0.4 * snoise(vec3(p_physical * 50.0, 0.0)));
    val += skin * 0.9;
    
    // Adjustments
    val = smoothstep(0.15, 0.9, val);
    float grain = fract(sin(dot(vUv.xy + uTime * 0.1 ,vec2(12.9898,78.233))) * 43758.5453);
    val -= grain * 0.08;
    float scanline = sin(vUv.y * 200.0 + uTime * 10.0) * 0.02;
    val += scanline;
    
    // --- COLOR MAPPING FOR ORANGE BACKGROUND ---
    // val is 0.0 (Background) to 1.0 (Bright Structure)
    // We want:
    // Background -> Transparent (so Orange shows through)
    // Structures -> Black / Semi-transparent Black
    
    // Invert val: 1.0 (Structure) -> 0.0 (Black), 0.0 (Empty) -> 1.0 (Transparent)
    // But we need alpha.
    
    // Structure Density = val
    // Color = Black (0,0,0)
    // Alpha = val * 0.8 (Semi-transparent black)
    
    return vec4(vec3(0.0), val * 0.9);
}

uniform float uMode; // 0.0 = Transverse, 1.0 = Longitudinal

void main() {
    vec4 color;
    
    if (uMode < 0.5) {
        // Transverse Mode
        color = getTransverseColor(vUv, uTime, uProgress);
    } else {
        // Longitudinal Mode with "Sketch/Draft" Reveal Effect
        vec2 p = vUv;
        
        // If fully fused (idle state), just show the potato
        if (uFusion >= 0.99) {
             color = getLongitudinalColor(p, uTime, uProgress);
        } else {
            // --- Sequence Logic ---
            // 1. Rings Expansion (uExpansion 0->1)
            // 2. Chaotic Lines (uFusion 0->1)
            
            // --- A. The Rings (Anchors) ---
            float ringMask = 0.0;
            float finalCenters[5];
            finalCenters[0] = 0.15; finalCenters[1] = 0.32; finalCenters[2] = 0.5; finalCenters[3] = 0.68; finalCenters[4] = 0.85;
            
            for(int i=0; i<5; i++) {
                // Animate center position: Start at 0.5, move to final
                float currentCenterY = mix(0.5, finalCenters[i], uExpansion);
                
                vec2 center = vec2(0.5, currentCenterY); 
                vec2 distVec = p - center;
                distVec.y *= 25.0; // Very flat
                
                // Dynamic Radius based on Potato Shape approximation
                float relY = (finalCenters[i] - 0.5) * 2.0; 
                float shapeProfile = sqrt(max(0.0, 1.0 - relY*relY*0.6)); 
                float targetRadius = 0.4 * shapeProfile;
                
                float d = length(distVec);
                float ring = smoothstep(0.01, 0.0, abs(d - targetRadius)); 
                ringMask += ring;
            }
            
            // --- B. Ring Flicker/Trembling Effect ---
            // Add trembling to ring brightness
            float ringFlicker = 1.0;
            if (uFusion < 0.99) {
                // Random flicker based on time and position
                float flicker1 = sin(uTime * 30.0 + p.x * 100.0) * 0.5 + 0.5;
                float flicker2 = sin(uTime * 25.0 + p.y * 100.0) * 0.5 + 0.5;
                ringFlicker = mix(0.7, 1.0, flicker1 * flicker2);
            }
            
            // --- C. Potato Dissolve Reveal ---
            vec4 potatoColor = getLongitudinalColor(p, uTime, uProgress);
            
            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0;
            
            // 1. Rings (Black, Flickering)
            if (ringMask > 0.1) {
                finalColor = vec3(0.0); // Black rings
                finalAlpha = 1.0 * ringFlicker;
            }
            
            // 2. Potato Body Dissolve Reveal
            // Dissolve effect: use noise to create burning/melting appearance
            if (uFusion > 0.01) {
                // Dissolve mask using multi-scale noise
                float dissolveNoise = fbm(vec3(p * 8.0, uTime * 0.5));
                
                // Threshold: as uFusion increases, more areas become visible
                // uFusion 0.0 -> Threshold very high (nothing visible)
                // uFusion 1.0 -> Threshold very low (everything visible)
                float threshold = mix(1.5, -0.5, uFusion);
                
                // Dissolve mask
                float dissolveMask = smoothstep(threshold, threshold + 0.3, dissolveNoise);
                
                // Edge glow effect (burning edge - Black)
                float edgeGlow = smoothstep(threshold, threshold + 0.1, dissolveNoise) - 
                                 smoothstep(threshold + 0.1, threshold + 0.2, dissolveNoise);
                
                if (dissolveMask > 0.01 && ringMask < 0.1) {
                    vec3 pCol = potatoColor.rgb;
                    
                    // Add edge glow (Black/Charred)
                    pCol = mix(pCol, vec3(0.0), edgeGlow * 0.8);
                    
                    // Apply dissolve
                    finalColor = mix(finalColor, pCol, dissolveMask * potatoColor.a);
                    finalAlpha = max(finalAlpha, dissolveMask * potatoColor.a);
                }
            }
            
            color = vec4(finalColor, finalAlpha);
        }
    }
    
    gl_FragColor = color;
}
`;

export const MRISlice = ({ mode = 'transverse', position, args = [6, 6], isAnimating, animationState }) => {
    const mesh = useRef();
    
    // Stable uniforms object
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uMode: { value: mode === 'transverse' ? 0.0 : 1.0 },
        uFusion: { value: 1.0 }, // 0.0 to 1.0 (Line density / Reveal)
        uExpansion: { value: 1.0 }, // 0.0 (Collapsed) to 1.0 (Spread)
        uFlash: { value: 0.0 }
    }), []); // Empty dependency array to keep reference stable

    // Update uMode when mode changes
    useEffect(() => {
        if (mesh.current) {
            mesh.current.material.uniforms.uMode.value = mode === 'transverse' ? 0.0 : 1.0;
        }
    }, [mode]);

    // Reset uniforms on state change
    useEffect(() => {
        if (mesh.current) {
            if (animationState === 'compressing') {
                mesh.current.material.uniforms.uExpansion.value = 0.0;
                mesh.current.material.uniforms.uFusion.value = 0.0;
            } else if (animationState === 'flashing') {
                mesh.current.material.uniforms.uExpansion.value = 0.0; // Start from 0
                mesh.current.material.uniforms.uFusion.value = 0.0;
            } else if (animationState === 'revealing') {
                mesh.current.material.uniforms.uExpansion.value = 1.0;
                mesh.current.material.uniforms.uFusion.value = 0.0; // Start from 0 for reveal
            }
        }
    }, [animationState]);

    useFrame((state) => {
        const { clock } = state;
        const time = clock.getElapsedTime();
        
        // Update uniforms on the material directly
        if (mesh.current) {
            mesh.current.material.uniforms.uTime.value = time;
            
            // Default animation (breathing/scanning)
            const duration = 3.5; 
            let progress = time / duration;
            if (progress > 1.0) progress = 1.0;
            mesh.current.material.uniforms.uProgress.value = progress;
        }

        // Handle Transition Animation
        if (isAnimating && mesh.current) {
            const uniforms = mesh.current.material.uniforms;

            if (animationState === 'compressing') {
                // Phase 1: Compress to slit
                mesh.current.scale.y = THREE.MathUtils.lerp(mesh.current.scale.y, 0.02, 0.1);
                uniforms.uExpansion.value = 0.0; // Rings collapsed to center
                uniforms.uFusion.value = 0.0;    // No lines yet
                uniforms.uFlash.value = 0.0;

            } else if (animationState === 'flashing') {
                // Phase 2: Snap to full height, Animate Expansion
                mesh.current.scale.y = 1.0; 
                
                // Animate Rings Spreading Out
                uniforms.uExpansion.value = THREE.MathUtils.lerp(uniforms.uExpansion.value, 1.0, 0.05);
                
                uniforms.uFusion.value = 0.0; // Still no lines, just rings moving
                uniforms.uFlash.value = 0.0;

            } else if (animationState === 'revealing') {
                // Phase 3: Chaotic Lines -> Reveal
                uniforms.uExpansion.value = 1.0; // Fully spread
                
                // Increase Fusion (Lines appear -> Potato reveals)
                uniforms.uFusion.value = THREE.MathUtils.lerp(uniforms.uFusion.value, 1.0, 0.01);
                
                uniforms.uFlash.value = 0.0;
            }
        } else if (mesh.current) {
            // Idle state
             mesh.current.scale.y = THREE.MathUtils.lerp(mesh.current.scale.y, 1.0, 0.1);
             mesh.current.material.uniforms.uFusion.value = 1.0;
             mesh.current.material.uniforms.uExpansion.value = 1.0;
             mesh.current.material.uniforms.uFlash.value = 0.0;
        }
    });

    return (
        <mesh ref={mesh} position={position}>
            <planeGeometry args={args} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent={true}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

const MRIPotatoPage = () => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [animationState, setAnimationState] = useState('idle'); // idle, compressing, flashing, revealing
    const [leftMode, setLeftMode] = useState('transverse');
    const [showRight, setShowRight] = useState(true);

    const handlePlay = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setAnimationState('compressing');
        setShowRight(false); // 1. Clear Longitudinal view

        // Sequence
        setTimeout(() => {
            // 2. Switch to Longitudinal & Start Flashing (5 slits)
            setLeftMode('longitudinal');
            setAnimationState('flashing');
            
            setTimeout(() => {
                // 3. Start Revealing (Expand slits)
                setAnimationState('revealing');
                
                setTimeout(() => {
                    // 4. Finish
                    setAnimationState('idle');
                    setIsAnimating(false);
                }, 1500); // Reveal time
            }, 1500); // Flash time (2 blinks approx)
        }, 1000); // Compression time
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#E36635', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            
            {/* Play Button */}
            <div 
                onClick={handlePlay}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 100,
                    border: '1px solid black'
                }}
            >
                <div style={{
                    width: '0', 
                    height: '0', 
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderLeft: '15px solid black'
                }}></div>
            </div>

            <div style={{ color: 'black', marginBottom: '20px', zIndex: 10, fontFamily: 'monospace', textAlign: 'center' }}>
                <h2>MRI Potato Scan (Procedural)</h2>
                <p>Left: Transverse Section | Right: Longitudinal Section</p>
            </div>
            <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
                <MRISlice 
                    mode={leftMode} 
                    position={[-3.2, 0, 0]} 
                    args={leftMode === 'transverse' ? [6, 6] : [6, 9]} 
                    isAnimating={isAnimating}
                    animationState={animationState}
                />
                {showRight && <MRISlice mode="longitudinal" position={[3.2, 0, 0]} args={[6, 9]} />}
            </Canvas>
        </div>
    );
};

export default MRIPotatoPage;
