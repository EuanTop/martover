import React from 'react';

const SystemIndicators = ({ getFutureYear }) => {
  return (
    <>
      {/* 左下角系统状态指示器 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.2)',
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid rgba(255, 115, 44, 0.3)'
      }}>
        <div style={{
          width: '30px',
          height: '30px',
          border: '2px solid rgba(255, 115, 44, 0.5)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '15px',
            height: '15px',
            background: '#FF732C',
            borderRadius: '50%',
            boxShadow: '0 0 10px #FF732C',
            animation: 'pulse 2s infinite'
          }} />
        </div>
        <div style={{
          marginLeft: '10px',
          color: '#FF732C',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          系统活跃
        </div>
      </div>

      {/* 右下角系统时间戳 - 使用未来年份 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 3,
        color: '#FF732C',
        fontSize: '12px',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.2)',
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid rgba(255, 115, 44, 0.3)'
      }}>
        MRS-SYS-{getFutureYear()}
      </div>
    </>
  );
};

export default SystemIndicators;