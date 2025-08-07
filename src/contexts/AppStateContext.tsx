import React, { createContext, useContext, useState, useEffect } from 'react';

interface AppStateContextType {
  messages: any[];
  dataSources: any[];
  activeDataSource: any;
  addMessage: (message: any) => void;
  setDataSources: (dataSources: any[]) => void;
  setActiveDataSource: (dataSource: any) => void;
  clearAppState: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [dataSources, setDataSourcesState] = useState<any[]>([]);
  const [activeDataSource, setActiveDataSourceState] = useState<any>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('askql-app-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setMessages(parsed.messages || []);
        setDataSourcesState(parsed.dataSources || []);
        setActiveDataSourceState(parsed.activeDataSource || null);
      } catch (error) {
        console.error('Failed to parse app state from localStorage:', error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      messages,
      dataSources,
      activeDataSource,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('askql-app-state', JSON.stringify(state));
  }, [messages, dataSources, activeDataSource]);

  // Note: Removed automatic clearing of state on page refresh/close
  // to allow data sources to persist across page navigations

  const addMessage = (message: any) => {
    setMessages(prev => [...prev, { ...message, id: Date.now().toString(), timestamp: new Date() }]);
  };

  const setDataSources = (newDataSources: any[]) => {
    setDataSourcesState(newDataSources);
  };

  const setActiveDataSource = (dataSource: any) => {
    setActiveDataSourceState(dataSource);
  };

  const clearAppState = () => {
    setMessages([]);
    setDataSourcesState([]);
    setActiveDataSourceState(null);
    localStorage.removeItem('askql-app-state');
  };

  return (
    <AppStateContext.Provider value={{
      messages,
      dataSources,
      activeDataSource,
      addMessage,
      setDataSources,
      setActiveDataSource,
      clearAppState
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};