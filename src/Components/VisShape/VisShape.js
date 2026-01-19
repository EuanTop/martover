import React, { useEffect, useRef, useMemo } from 'react';
import './VisShape.css';
import { ReactSVG } from 'react-svg';

// 映射 morphType 到正确的文件名（修复大小写问题）
const morphTypeToFileName = {
  'CpxCMa': 'CpxCMa',
  'CpxCPk': 'CpxCpk',  // CSV 中是 CpxCPk，文件名是 CpxCpk
  'CpxCpk': 'CpxCpk',
  'CPk': 'CpxCpk',     // 缩写 CPk -> CpxCpk
  'CpxCPt': 'CpxCpt',  // CSV 中是 CpxCPt，文件名是 CpxCpt
  'CpxCpt': 'CpxCpt',
  'CPt': 'CpxCpt',     // 缩写 CPt -> CpxCpt
  'CpxPkRg': 'CpxPkRg',
  'PkRg': 'CpxPkRg',   // 缩写 PkRg -> CpxPkRg
  'CpxSuPt': 'CpxSuPt',
  'SuPt': 'CpxSuPt',   // 缩写 SuPt -> CpxSuPt
  'CpxUnc': 'CpxUnc',
  'Unc': 'CpxUnc',     // 缩写 Unc -> CpxUnc
  'CMa': 'CpxCMa',     // 缩写 CMa -> CpxCMa
  'SmpCPt': 'CpxCpt',  // SmpCPt -> CpxCpt
};

// In the modified VisShape component, we keep the degradation colors
const degradationColors = {
  1: '#00BFFF',
  2: '#FFF598',
  3: '#BE501E',
  4: '#E59898',
};

// Modified VisShape component to accept animation styles
const VisShape = ({
  crater,
  disableAnimations,
  isDarkMode,
  size = 1,
  isAnimating = false,
  animationProgress = 0,
  customStyles = {}
}) => {
  const canvasRefs = useRef([]);

  // Generate fixed axis angles for layers 4, 5, and 6
  const axisAngles = useMemo(() => {
    return {
      4: 30,    // First quadrant angle
      5: 160,   // Second quadrant angle
      6: 260    // Third quadrant angle
    };
  }, []);

  // Dynamic layers array is the same as the original
  const layers = useMemo(() => {
    const morphType = crater?.internalMorph?.[0];
    const layerNumber = crater?.layerNumber || 0;
    const ejcSvg = crater?.ejcSvg || [];

    // Get degradation levels
    const rimDeg = parseInt(crater?.rimDegradation) || 1;
    const ejcDeg = parseInt(crater?.ejectaDegradation) || 1;
    const flrDeg = parseInt(crater?.floorDegradation) || 1;

    const isMorphTypeEmpty = !morphType || morphType === '';

    const baseLayers = [
      {
        num: 7,
        color: isMorphTypeEmpty ? '#808080' : degradationColors[rimDeg],
        speed: 0.1,
        svg: morphType === 'CpxFF' ? '/test/7/7_CpxFF.svg' : '/test/7/7_Smp.svg',
        enableWave: !isMorphTypeEmpty,
        forceColor: true
      },
    ];

    // Layer construction logic remains the same
    if (layerNumber >= 3 && ejcSvg[2]) {
      baseLayers.push({
        num: 6,
        color: degradationColors[ejcDeg],
        speed: 0.5,
        svg: `/test/5/5_${ejcSvg[2]}.svg`,
        enableWave: true,
        forceColor: true
      });
    }

    if (layerNumber >= 2 && ejcSvg[1]) {
      baseLayers.push({
        num: 5,
        color: degradationColors[ejcDeg],
        speed: 0.08,
        svg: `/test/5/5_${ejcSvg[1]}.svg`,
        enableWave: true,
        forceColor: true
      });
    } else if (layerNumber === 1 && ejcSvg[0]) {
      baseLayers.push({
        num: 5,
        color: degradationColors[ejcDeg],
        speed: 0.08,
        svg: `/test/5/5_${ejcSvg[0]}.svg`,
        enableWave: true,
        forceColor: true
      });
    }

    if (layerNumber >= 2 && ejcSvg[0]) {
      baseLayers.push({
        num: 4,
        color: degradationColors[ejcDeg],
        speed: 0.1,
        svg: `/test/5/5_${ejcSvg[0]}.svg`,
        enableWave: true,
        forceColor: true
      });
    }

    // Base layers
    baseLayers.push(
      {
        num: 3,
        color: degradationColors[rimDeg],
        speed: 0.04,
        svg: '/test/3.svg',
        enableWave: true,
        forceColor: true
      },
      {
        num: 2,
        color: isMorphTypeEmpty
          ? (isDarkMode ? 'grey' : '#FFFFFF')
          : (isDarkMode ? '#000000' : '#F57435'),
        speed: 0.06,
        svg: '/test/2.svg',
        enableWave: false,
        forceColor: true
      }
    );

    if (morphType && !['CpxFF', 'Bsn', 'Smp'].includes(morphType)) {
      const fileName = morphTypeToFileName[morphType] || morphType;
      baseLayers.push({
        num: 1,
        color: degradationColors[flrDeg],
        speed: 1,
        svg: `/test/1/1_${fileName}.svg`,
        fallbackSvg: '/question-mark.svg',
        enableWave: true,
        forceColor: true
      });
    }

    return baseLayers;
  }, [crater?.internalMorph, crater?.layerNumber, crater?.ejcSvg, crater?.rimDegradation, crater?.ejectaDegradation, crater?.floorDegradation, isDarkMode]);

  // Canvas drawing effect
  useEffect(() => {
    const cleanupDrawFunctions = [];

    layers.forEach((layer, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;

      const $ = canvas.getContext('2d');
      const wh = 128;
      const w2h = wh * wh;
      canvas.width = canvas.height = wh;

      const img = $.createImageData(wh, wh);
      const id = img.data;
      let t = 0;
      const inc = 1 / wh;
      const arr = Array.from({ length: w2h }, () => Math.random() * 1. - 0.5);
      let animationId;

      function draw() {
        t += inc * layer.speed;

        for (let x = 1; x >= 0; x -= inc) {
          for (let y = 1; y >= 0; y -= inc) {
            const idx = (y * wh + x) * wh * 4;
            const dx = x;
            const dy = y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ax = oct(x, y);
            const ay = oct(x + 2, y + t / 3);
            const bx = oct(x + dist * 0.3 + ax / 22 + 0.7, y + ay / 5 + 2);
            const by = oct(x + ax / 3 + 4 * t, y + ay / 3 + 5);
            const n = oct(x + bx / 5, y + by / 2) * 0.7 + 0.15;
            const d = ax * by / 2;
            const e = ay * bx / 2;

            id[idx + 0] = hue(n + d / 5);
            id[idx + 1] = hue(n / 3 + e / 5 + d);
            id[idx + 2] = hue(d + e);
            id[idx + 3] = hue(1 - ease(dist) * (e + d) * 5);
          }
        }

        $.putImageData(img, 0, 0);
        if (!disableAnimations) {
          animationId = requestAnimationFrame(draw);
        }
      }

      // Helper functions
      function hue($) { return 255 * Math.min(Math.max($, 0), 1); }
      function ease(x) { return (x > 0.2) ? 0 : i(1, 0, x * 6); }
      function i($, db, t) {
        t = t * t * t * (6 * t * t - 15 * t + 10);
        return $ + (db - $) * t;
      }
      function n(x, y) {
        const i = Math.abs(x * wh + y) % w2h;
        return arr[i];
      }
      function oct(x, y) {
        const o1 = p(x * 3.0, y * 4.0);
        const o2 = p(x * 4.0, y * 5.0);
        return o1 + o2 * 0.5;
      }
      function p(x, y) {
        const nx = Math.floor(x);
        const ny = Math.floor(y);
        return i(
          i(n(nx, ny), n(nx + 1, ny), x - nx),
          i(n(nx, ny + 1), n(nx + 1, ny + 1), x - nx),
          y - ny
        );
      }

      if (disableAnimations) {
        draw(); // Draw static frame
      } else {
        animationId = requestAnimationFrame(draw); // Start animation loop
      }

      cleanupDrawFunctions.push(() => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      });
    });

    return () => {
      cleanupDrawFunctions.forEach(cleanup => cleanup());
    };
  }, [layers, disableAnimations]);

  // Calculate the transform for layers 4, 5, 6 (along specified axis angles)
  const getAxisTransform = (layerNum) => {
    if (!isAnimating) return {};
    
    if (layerNum === 2 || layerNum === 3) {
      // Stretch vertically (y-axis) without moving
      return {
        transform: `scaleY(${1 + animationProgress * 2})`,
        transformOrigin: 'center center' // Keep the center fixed
      };
    } 
    else if (layerNum === 4 || layerNum === 5 || layerNum === 6) {
      // Get the predefined angle for this layer
      const angle = axisAngles[layerNum];
      
      // We need to compress perpendicular to the axis direction
      // First position the element with the axis at the specified angle
      // Then scale down in the perpendicular direction
      
      // The perpendicular angle
      const perpAngle = angle + 90;
      
      // Calculate the scaling matrix based on the angle
      // We want to keep the scale along the axis direction and reduce perpendicular to it
      const scale = 1 - animationProgress * 0.95; // Almost to a line (not quite 0 to avoid rendering issues)
      
      // SVG transformation: rotate to align with axis, scale in perpendicular direction, then rotate back
      return {
        transform: `rotate(${angle}deg) scale(1, ${scale}) rotate(${-angle}deg)`,
        transformOrigin: 'center center'
      };
    }
    
    return {};
  };

  // Modified render with support for animation styles
  return (
    <div className="relative w-full h-full" style={{ position: 'relative', top: '42px', transform: `scale(${size})` }}>
      {layers.map(({ num, color, speed, svg, fallbackSvg, enableWave, forceColor }, index) => {
        const isMorphTypeEmpty = forceColor && num === 7;
        
        // Calculate opacity for layers 1 and 7 (fade out completely)
        const layerOpacity = (num === 1 || num === 7)
          ? (isAnimating ? 1 - animationProgress : 1)
          : 1;
        
        // Calculate fill opacity (for all layers except 1 and 7)
        const fillOpacity = (num !== 1 && num !== 7)
          ? (isAnimating ? 1 - animationProgress : 1)
          : 1;
        
        // Get transform style for this layer
        const transformStyle = getAxisTransform(num);
        
        return (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              opacity: layerOpacity,
              transition: 'opacity 0.1s ease',
            }}
          >
            <div className="relative w-full h-full">
              {/* SVG layer with animation styles */}
              <div
                className="absolute inset-0"
                style={{
                  ...transformStyle,
                  transition: 'transform 0.1s ease',
                }}
              >
                <ReactSVG
                  src={svg}
                  beforeInjection={(svg) => {
                    svg.setAttribute('width', '100%');
                    svg.setAttribute('height', '100%');
                    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                    // Base transformation styles (same as original)
                    if (num === 4) {
                      svg.classList.add('layer-4-base');
                    } else if (num === 5) {
                      svg.classList.add('layer-5-base');
                    } else if (num === 6) {
                      svg.classList.add('layer-6-base');
                    }

                    // Apply animations only if not in logo animation mode
                    if (!isAnimating && !disableAnimations) {
                      if (num === 4) {
                        svg.classList.add('layer-4-animation');
                      } else if (num === 5) {
                        svg.classList.add('layer-5-animation');
                      } else if (num === 6) {
                        svg.classList.add('layer-6-animation');
                      }
                    }

                    // Responsive viewBox
                    const parent = svg.parentElement;
                    if (parent) {
                      const ratio = parent.clientWidth / parent.clientHeight;
                      if (ratio > 1) {
                        svg.setAttribute('viewBox', '-100 -50 200 100');
                      } else {
                        svg.setAttribute('viewBox', '-100 -100 200 200');
                      }
                    }

                    // Set layer 2 fill color
                    if (num === 2) {
                      svg.setAttribute('fill', isMorphTypeEmpty
                        ? (isDarkMode ? '#4B4B4B' : '#FFFFFF')
                        : (isDarkMode ? '#000000' : '#F57435'));
                    }

                    // Set all paths' stroke and fill
                    const paths = svg.getElementsByTagName('path');
                    Array.from(paths).forEach(path => {
                      // Always keep black stroke
                      path.setAttribute('stroke', 'black');
                      path.setAttribute('stroke-width', '1');
                      
                      // Apply fill color with opacity for animation
                      if (forceColor) {
                        path.setAttribute('fill', color);
                        
                        // Only animate fill opacity for non-disappearing layers
                        if (num !== 1 && num !== 7) {
                          path.setAttribute('fill-opacity', fillOpacity);
                        }
                      }
                    });
                  }}
                  onError={(error) => {
                    console.error('SVG load error:', error);
                  }}
                  loading={() => {
                    return <div className="w-full h-full bg-gray-200/20" />;
                  }}
                  evalScripts="always"
                  fallback={() => {
                    return (
                      <ReactSVG
                        src={fallbackSvg || '/question-mark.svg'}
                        className="w-full h-full"
                        onError={(error) => console.error('Fallback SVG error:', error)}
                      />
                    );
                  }}
                  className="w-full h-full"
                  wrapper="div"
                  wrapperClassName="w-full h-full"
                />
              </div>

              {/* Wave effect layer with animation styles */}
              {enableWave && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas
                    ref={el => canvasRefs.current[index] = el}
                    className={`w-full h-full wave-${num}`}
                    style={{
                      opacity: isAnimating ? 1 - animationProgress * 2 : 1, // Make wave disappear faster
                      maskImage: `url(${svg})`,
                      WebkitMaskImage: `url(${svg})`,
                      maskRepeat: 'no-repeat',
                      WebkitMaskRepeat: 'no-repeat',
                      maskSize: 'contain',
                      WebkitMaskSize: 'contain',
                      mixBlendMode: num === 6 ? 'multiply' : 'difference',
                      transform: 'scale(1, 1)',
                      transition: 'opacity 0.1s ease',
                    }}
                    data-speed={speed}
                    data-color={color}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisShape;