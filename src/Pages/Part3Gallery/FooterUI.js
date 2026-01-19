import React, { useState } from 'react';

const FooterUI = () => {
  const [showEndCard, setShowEndCard] = useState(false);
  return (
    <>
    <div 
      onClick={() => setShowEndCard(true)}
      style={{
        cursor: 'pointer',
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      color: '#FF732C',
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: 2,
      lineHeight: 1.4,
      padding: '12px 24px',
      maxWidth: 600,
      whiteSpace: 'pre-line',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: '8px',
      border: '1px solid #FF732C',
      boxShadow: '0 0 20px rgba(255, 115, 44, 0.3)',
      fontFamily: 'monospace',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px'
    }}>
      <img 
        src="/MartoverTotalLogo.svg" 
        alt="MARTOVER" 
        style={{
          height: '40px',
          width: 'auto'
        }}
      />
      <div style={{
        fontSize: '16px',
        opacity: 0.8
      }}>在火星土壤播种明日盛宴</div>
      <div style={{
        width: '80%',
        height: '2px',
        background: 'rgba(255, 115, 44, 0.5)',
        margin: '8px 0',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '30%',
          height: '100%',
          background: '#fff',
          animation: 'moveLight 2s infinite linear'
        }}></div>
      </div>
    </div>
    
    {/* END卡片 */}
    {showEndCard && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowEndCard(false)}
      >
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.9)',
          border: '1px solid #FF732C',
          borderRadius: '8px',
          padding: '40px 60px',
          textAlign: 'center',
          color: '#FF732C',
          fontFamily: 'monospace'
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>END</div>
          <div style={{
            fontSize: '14px',
            opacity: 0.8,
            marginBottom: '20px'
          }}>开发中，敬请期待<br/>可查看文档详情</div>
          <img
            src="/imgs/feishu_link.svg"
            alt="二维码"
            style={{
              width: '120px',
              height: '120px'
            }}
          />
          <a
            href="https://github.com/EuanTop/martover"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '15px',
              color: '#FF732C',
              textDecoration: 'none',
              fontSize: '14px',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = 1}
            onMouseLeave={(e) => e.target.style.opacity = 0.8}
          >
            <svg height="20" width="20" viewBox="0 0 16 16" fill="#FF732C">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
        </div>
      </div>
    )}
    </>
  );
};

export default FooterUI;