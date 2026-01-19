import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './RdOverlay.css';

const RdOverlaySvg = ({ visible }) => {
  const overlayRef = useRef(null);
  const shineRef = useRef(null);
  
  useEffect(() => {
    if (!visible || !overlayRef.current || !shineRef.current) return;
    
    // Continuous animation for the shine effect
    const ctx = gsap.context(() => {
      // Animate the shine layer position
      gsap.to(shineRef.current, {
        x: "100%",
        y: "100%",
        duration: 6,
        repeat: -1,
        ease: "none",
      });
      
      // Pulsing opacity
      gsap.to(shineRef.current, {
        opacity: 0.9,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });
    
    // Cleanup function
    return () => ctx.revert();
  }, [visible]);
  
  if (!visible) return null;
  
  // Generate RD text pattern elements
  const generateRdPatternElements = (id) => {
    const elements = [];
    const rows = 4;
    const cols = 4;
    const spacing = 160;
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        elements.push(
          <text
            key={`rd-${id}-${i}-${j}`}
            x={j * spacing + ((i % 2) * spacing/2)}
            y={i * spacing + 20}
            style={{
              fontFamily: 'Balgin, sans-serif',
              fontWeight: 200,
              fontSize: '128px',
              transform: 'rotate(45deg)',
              transformOrigin: `${j * spacing + ((i % 2) * spacing/2)}px ${i * spacing + 20}px`
            }}
          >
            RD
          </text>
        );
      }
    }
    
    return elements;
  };
  
  return (
    <div 
      ref={overlayRef} 
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 800 500" 
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        <defs>
          {/* 烫金反光渐变 - 从透明到橙色再到透明 */}
          <linearGradient id="foilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="transparent" />
            <stop offset="40%" stopColor="#FF6B01" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#FFD700" stopOpacity="1" />
            <stop offset="60%" stopColor="#FF6B01" stopOpacity="0.6" />
            <stop offset="70%" stopColor="transparent" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          
          {/* 文字遮罩 */}
          <mask id="rdTextMask">
            <rect width="100%" height="100%" fill="black" />
            {generateRdPatternElements('mask').map(el => 
              React.cloneElement(el, {
                key: el.key,
                style: { ...el.props.style, fill: 'white' }
              })
            )}
          </mask>
        </defs>
        
        {/* 底层黑色文字 */}
        <g opacity="0.25">
          {generateRdPatternElements('base').map(el => 
            React.cloneElement(el, {
              key: el.key,
              style: { ...el.props.style, fill: 'black' }
            })
          )}
        </g>
        
        {/* 反光效果层 - 使用渐变填充，通过mask只显示文字区域 */}
        <g mask="url(#rdTextMask)">
          <rect 
            ref={shineRef}
            x="-100%"
            y="-100%"
            width="200%" 
            height="200%" 
            fill="url(#foilGradient)" 
            opacity="0.5"
          />
        </g>
      </svg>
    </div>
  );
};

export default RdOverlaySvg;
