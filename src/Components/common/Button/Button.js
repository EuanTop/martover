import React from 'react';

// 统一的按钮设计系统
const Button = ({ 
  variant = 'primary', 
  size = 'medium', 
  children, 
  onClick, 
  disabled = false, 
  className = '', 
  isDarkMode = false,
  ...props 
}) => {
  // 基础样式
  const baseStyles = 'transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  // 尺寸样式
  const sizeStyles = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
    icon: 'p-2'
  };
  
  // 变体样式
  const variantStyles = {
    // 主要按钮 - 橙色系
    primary: isDarkMode 
      ? 'bg-orange-600 hover:bg-orange-700 text-white border border-orange-500 focus:ring-orange-500 shadow-lg shadow-orange-500/30'
      : 'bg-orange-500 hover:bg-orange-600 text-black border border-orange-400 focus:ring-orange-500',
    
    // 次要按钮 - 透明背景
    secondary: isDarkMode
      ? 'bg-gray-800/80 hover:bg-gray-700/80 text-white border border-orange-400/50 focus:ring-orange-500/50 backdrop-blur-sm'
      : 'bg-transparent hover:bg-white/10 text-black border border-black/30 focus:ring-white/50',
    
    // 危险按钮 - 红色系
    danger: isDarkMode
      ? 'bg-red-600 hover:bg-red-700 text-white border border-red-500 focus:ring-red-500 shadow-lg shadow-red-500/30'
      : 'bg-red-600 hover:bg-red-700 text-black border border-red-500 focus:ring-red-500',
    
    // 成功按钮 - 绿色系
    success: isDarkMode
      ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500 focus:ring-green-500 shadow-lg shadow-green-500/30'
      : 'bg-green-600 hover:bg-green-700 text-black border border-green-500 focus:ring-green-500',
    
    // 幽灵按钮 - 只有边框
    ghost: isDarkMode
      ? 'bg-transparent hover:bg-orange-500/10 text-white hover:text-orange-200 border-0 focus:ring-orange-500/30'
      : 'bg-transparent hover:bg-white/5 text-black hover:text-white border-0 focus:ring-white/30',
    
    // 玻璃态按钮 - 毛玻璃效果
    glass: isDarkMode
      ? 'bg-gray-900/40 backdrop-blur-lg hover:bg-gray-800/60 text-white border border-orange-400/30 focus:ring-orange-500/30 shadow-lg shadow-black/20'
      : 'bg-white/10 backdrop-blur-lg hover:bg-white/20 text-black border border-black/20 focus:ring-black/30',
    
    // 科幻风格按钮
    sci: isDarkMode
      ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white border border-orange-400 shadow-xl shadow-orange-500/40 focus:ring-orange-500 hover:shadow-orange-500/60'
      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black border border-orange-300 shadow-lg shadow-orange-400/25 focus:ring-orange-400'
  };
  
  // 圆角样式
  const roundedStyles = 'rounded-lg';
  
  const combinedClassName = `
    ${baseStyles}
    ${sizeStyles[size]}
    ${variantStyles[variant]}
    ${roundedStyles}
    ${className}
  `.trim();

  return (
    <button
      className={combinedClassName}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;