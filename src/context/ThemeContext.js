import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showLines, setShowLines] = useState(true);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const toggleShowLines = () => setShowLines(prev => !prev);

  return (
    <ThemeContext.Provider value={{
      isDarkMode,
      setIsDarkMode,
      toggleDarkMode,
      showLines,
      setShowLines,
      toggleShowLines
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};