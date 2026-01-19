import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './RdOverlay.css';

const RdOverlay = ({ visible }) => {
  const overlayRef = useRef(null);
  
  useEffect(() => {
    if (!visible) return;
    
    // Create the GSAP timeline animations
    const holo = gsap.timeline({ repeat: -1 });
    const opacity = gsap.timeline({ repeat: -1 });
    
    // Animation for holographic color shift
    holo.to(overlayRef.current, {
      "--h": "100%",
      duration: 3.5,
      ease: "sine.in"
    });
    holo.to(overlayRef.current, {
      "--h": "50%",
      duration: 3.5,
      ease: "sine.out"
    });
    holo.to(overlayRef.current, {
      "--h": "0%",
      duration: 3.5,
      ease: "sine.in"
    });
    holo.to(overlayRef.current, {
      "--h": "50%",
      duration: 3.5,
      ease: "sine.out"
    });
    
    // Animation for opacity pulse
    opacity.to(overlayRef.current, {
      "--o": 1,
      duration: 3.5,
      ease: "power1.in"
    });
    opacity.to(overlayRef.current, {
      "--o": 0.3,
      duration: 3.5,
      ease: "power1.out"
    });
    
    // Cleanup function to kill animations when component unmounts
    return () => {
      holo.kill();
      opacity.kill();
    };
  }, [visible]);
  
  if (!visible) return null;
  
  // Create an SVG pattern with "RD" text arranged diagonally
  const createRdPattern = () => {
    // We need to create this as a data URL since we can't directly use SVG in CSS background
    const svgPattern = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <pattern id="rdPattern" patternUnits="userSpaceOnUse" width="80" height="80">
            <text x="10" y="20" transform="rotate(45, 40, 40)" 
                  style="font-family: Arial; font-weight: bold; font-size: 12px; fill: white;">RD</text>
            <text x="30" y="40" transform="rotate(45, 40, 40)" 
                  style="font-family: Arial; font-weight: bold; font-size: 12px; fill: white;">RD</text>
            <text x="50" y="60" transform="rotate(45, 40, 40)" 
                  style="font-family: Arial; font-weight: bold; font-size: 12px; fill: white;">RD</text>
            <text x="-10" y="0" transform="rotate(45, 40, 40)" 
                  style="font-family: Arial; font-weight: bold; font-size: 12px; fill: white;">RD</text>
            <text x="70" y="80" transform="rotate(45, 40, 40)" 
                  style="font-family: Arial; font-weight: bold; font-size: 12px; fill: white;">RD</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rdPattern)" />
      </svg>
    `;
    
    // Convert the SVG to a data URL
    const encodedSvg = encodeURIComponent(svgPattern);
    return `url("data:image/svg+xml;utf8,${encodedSvg}")`;
  };
  
  return (
    <div 
      ref={overlayRef} 
      className="absolute inset-0 pointer-events-none z-10 rounded-lg overflow-hidden"
      style={{
        "--h": "50%",
        "--o": 0.5,
      }}
    >
      <div className="rd-pattern-container absolute inset-0" 
        style={{
          "--space": "5%",
          "--red": "hsl(0, 100%, 50%)",
          "--orange": "hsl(30, 100%, 50%)",
          "--yellow": "hsl(60, 100%, 50%)",
          "--green": "hsl(120, 100%, 50%)",
          "--cyan": "hsl(180, 100%, 50%)",
          "--blue": "hsl(222, 100%, 50%)",
          "--purple": "hsl(258, 100%, 50%)",
          "--magenta": "hsl(300, 100%, 50%)",
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            var(--red) 0%,
            var(--orange) calc(var(--space) * 1),
            var(--yellow) calc(var(--space) * 2),
            var(--green) calc(var(--space) * 3),
            var(--cyan) calc(var(--space) * 4),
            var(--blue) calc(var(--space) * 5),
            var(--purple) calc(var(--space) * 6),
            var(--magenta) calc(var(--space) * 7),
            var(--red) calc(var(--space) * 8)
          )`,
          backgroundSize: "150% 150%",
          backgroundPosition: `calc(var(--h)) calc(var(--h))`,
          backgroundRepeat: "no-repeat",
          maskImage: createRdPattern(),
          maskSize: "60px 60px",
          maskRepeat: "repeat",
          opacity: "var(--o)",
          mixBlendMode: "plus-lighter",
          filter: "brightness(0.9) contrast(0.7) saturate(2)",
        }}
      />
      <div className="absolute inset-0 z-5"
        style={{
          backgroundImage: `linear-gradient(
            -70deg,
            transparent 40%,
            rgba(255, 255, 255, 0.5) 40.5%,
            transparent
          )`,
          backgroundSize: "200% 200%",
          backgroundPosition: `var(--h) var(--h)`,
          opacity: "calc(var(--o) + 0.1)",
        }}
      />
    </div>
  );
};

export default RdOverlay;