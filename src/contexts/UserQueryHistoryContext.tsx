import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserQueryHistoryItem {
  id: string;
  user_id: string;
  question: string;
  query?: string;
  response: string;
  status: 'success' | 'error';
  execution_time?: number;
  mode?: string;
  created_at: string;
}

interface UserQueryHistoryContextType {
  queryHistory: UserQueryHistoryItem[];
  addToHistory: (item: Omit<UserQueryHistoryItem, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadHistory: () => Promise<void>;
  isLoading: boolean;
}

const UserQueryHistoryContext = createContext<UserQueryHistoryContextType | undefined>(undefined);

export const UserQueryHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryHistory, setQueryHistory] = useState<UserQueryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setQueryHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_query_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setQueryHistory((data || []).map(item => ({
        ...item,
        status: item.status as 'success' | 'error'
      })));
    } catch (error) {
      console.error('Error loading query history:', error);
      toast({
        title: "Error",
        description: "Failed to load query history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addToHistory = async (item: Omit<UserQueryHistoryItem, 'id' | 'user_id' | 'created_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // If user is not logged in, just add to local state
        const localItem: UserQueryHistoryItem = {
          ...item,
          id: Date.now().toString(),
          user_id: 'anonymous',
          created_at: new Date().toISOString(),
        };
        setQueryHistory(prev => [localItem, ...prev].slice(0, 100));
        return;
      }

      const { data, error } = await supabase
        .from('user_query_history')
        .insert([{
          ...item,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      setQueryHistory(prev => [{
        ...data,
        status: data.status as 'success' | 'error'
      }, ...prev].slice(0, 100));
    } catch (error) {
      console.error('Error adding to history:', error);
      // Fallback to local storage if database fails
      const localItem: UserQueryHistoryItem = {
        ...item,
        id: Date.now().toString(),
        user_id: 'anonymous',
        created_at: new Date().toISOString(),
      };
      setQueryHistory(prev => [localItem, ...prev].slice(0, 100));
    }
  };

  const clearHistory = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('user_query_history')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;
      }

      setQueryHistory([]);
      
      toast({
        title: "History cleared",
        description: "All query history has been deleted",
      });
    } catch (error) {
      console.error('Error clearing history:', error);
      toast({
        title: "Error",
        description: "Failed to clear history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load history when user authentication state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          loadHistory();
        } else if (event === 'SIGNED_OUT') {
          setQueryHistory([]);
        }
      }
    );

    // Load initial history
    loadHistory();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserQueryHistoryContext.Provider value={{
      queryHistory,
      addToHistory,
      clearHistory,
      loadHistory,
      isLoading
    }}>
      {children}
    </UserQueryHistoryContext.Provider>
  );
};

export const useUserQueryHistory = () => {
  const context = useContext(UserQueryHistoryContext);
  if (context === undefined) {
    throw new Error('useUserQueryHistory must be used within a UserQueryHistoryProvider');
  }
  return context;
};