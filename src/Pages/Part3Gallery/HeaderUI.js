import React from 'react';

const HeaderUI = () => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 10,
      borderBottom: '1px solid rgba(255, 115, 44, 0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: '15px',
          height: '15px',
          background: '#FF732C',
          borderRadius: '50%',
          boxShadow: '0 0 10px #FF732C',
          marginRight: '10px'
        }} />
        <span style={{ color: '#FF732C', fontFamily: 'monospace', fontSize: '14px' }}>
          SYSTEM: ACTIVE
        </span>
      </div>

      <div style={{ color: '#F57435', fontFamily: 'monospace', fontSize: '12px' }}>
        自动化生产系统 // MARS AGRICULTURE AUTOMATION SYSTEM
      </div>
    </div>
  );
};

export default HeaderUI;