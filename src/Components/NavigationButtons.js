import React from 'react';
import { Link } from 'react-router-dom';

const NavigationButtons = ({ isDarkMode, setIsDarkMode }) => {
  return (
    <>
      <Link 
        to="/grid" 
        className={`fixed top-5 left-5 z-50 p-2 ${isDarkMode ? 'text-white/70 hover:text-white/90' : 'text-black/70 hover:text-black/90'} 
                 bg-gray-500/30 backdrop-blur-lg rounded-lg transition-colors`}
        aria-label="网格视图"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </Link>
      
      <Link 
        to="/logo" 
        className={`fixed top-5 left-20 z-50 p-2 ${isDarkMode ? 'text-white/70 hover:text-white/90' : 'text-black/70 hover:text-black/90'} 
                 bg-gray-500/30 backdrop-blur-lg rounded-lg transition-colors`}
        aria-label="Logo Animation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </Link>

      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="fixed top-5 right-20 z-50 p-2 text-white/70 hover:text-white/90 
                  bg-gray-500/30 backdrop-blur-lg rounded-lg transition-colors"
        aria-label={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
      >
        {isDarkMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>
    </>
  );
};

export default NavigationButtons;