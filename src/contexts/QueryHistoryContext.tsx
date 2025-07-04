import React, { createContext, useContext, useState, useEffect } from 'react';

export interface QueryHistoryItem {
  id: string;
  question: string;
  query?: string;
  response: string;
  timestamp: Date;
  status: 'success' | 'error';
  executionTime?: number;
  mode?: string;
}

interface QueryHistoryContextType {
  queryHistory: QueryHistoryItem[];
  addToHistory: (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

const QueryHistoryContext = createContext<QueryHistoryContextType | undefined>(undefined);

export const QueryHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('askql-query-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Convert timestamp strings back to Date objects
        const historyWithDates = parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setQueryHistory(historyWithDates);
      } catch (error) {
        console.error('Failed to parse query history from localStorage:', error);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('askql-query-history', JSON.stringify(queryHistory));
  }, [queryHistory]);

  const addToHistory = (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: QueryHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    
    setQueryHistory(prev => [newItem, ...prev].slice(0, 100)); // Keep only last 100 items
  };

  const clearHistory = () => {
    setQueryHistory([]);
    localStorage.removeItem('askql-query-history');
  };

  return (
    <QueryHistoryContext.Provider value={{ queryHistory, addToHistory, clearHistory }}>
      {children}
    </QueryHistoryContext.Provider>
  );
};

export const useQueryHistory = () => {
  const context = useContext(QueryHistoryContext);
  if (context === undefined) {
    throw new Error('useQueryHistory must be used within a QueryHistoryProvider');
  }
  return context;
};