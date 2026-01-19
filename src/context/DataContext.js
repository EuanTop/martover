import React, { createContext, useState, useContext } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [craterData, setCraterData] = useState({ preview: [], full: [] });
  const [potatoData, setPotatoData] = useState([]);
  const [selectedCrater, setSelectedCrater] = useState(null);

  return (
    <DataContext.Provider value={{
      craterData,
      setCraterData,
      potatoData,
      setPotatoData,
      selectedCrater,
      setSelectedCrater
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};