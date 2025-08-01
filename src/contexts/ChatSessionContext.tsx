import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  query?: string;
  results?: any;
  mode?: string;
  timestamp: Date;
  isFollowUp?: boolean;
}

interface ChatSessionContextType {
  messages: ChatMessage[];
  sessionId: string;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearSession: () => void;
  getRecentMessages: (count?: number) => ChatMessage[];
  detectFollowUpMessage: (content: string) => boolean;
}

const ChatSessionContext = createContext<ChatSessionContextType | undefined>(undefined);

const FOLLOW_UP_KEYWORDS = [
  'the above', 'above query', 'above question', 'above result',
  'last question', 'previous question', 'earlier question',
  'that one', 'that query', 'that result',
  'previous', 'before', 'earlier',
  'now show result', 'give me the result', 'show the result',
  'execute it', 'run it', 'do it now',
  'exact result', 'actual result', 'real result',
  'can you now', 'now give', 'now show',
  'from that', 'based on that', 'using that'
];

export const ChatSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');

  // Generate new session ID
  const generateSessionId = () => {
    return crypto.randomUUID();
  };

  // Save session to Supabase
  const saveSession = async (newMessages: ChatMessage[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || newMessages.length === 0) return;

      const messagesForStorage = newMessages.map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        query: msg.query,
        results: msg.results,
        mode: msg.mode,
        timestamp: msg.timestamp.toISOString(),
        isFollowUp: msg.isFollowUp
      }));

      const { error } = await supabase
        .from('user_chat_sessions')
        .upsert({
          user_id: user.id,
          session_id: sessionId,
          messages: messagesForStorage
        });

      if (error) {
        console.error('Error saving chat session:', error);
      }
    } catch (error) {
      console.error('Error in saveSession:', error);
    }
  };

  // Load session from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('askql-chat-messages');
    const savedSessionId = localStorage.getItem('askql-session-id');
    
    if (savedMessages && savedSessionId) {
      try {
        const parsed = JSON.parse(savedMessages);
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        setSessionId(savedSessionId);
      } catch (error) {
        console.error('Failed to parse saved messages:', error);
        const newSessionId = generateSessionId();
        setSessionId(newSessionId);
        localStorage.setItem('askql-session-id', newSessionId);
      }
    } else {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      localStorage.setItem('askql-session-id', newSessionId);
    }
  }, []);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('askql-chat-messages', JSON.stringify(messages));
      saveSession(messages);
    }
  }, [messages, sessionId]);

  // Clear session on page reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem('askql-chat-messages');
      localStorage.removeItem('askql-session-id');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const detectFollowUpMessage = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    return FOLLOW_UP_KEYWORDS.some(keyword => lowerContent.includes(keyword));
  };

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const isFollowUp = message.type === 'user' ? detectFollowUpMessage(message.content) : false;
    
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date(),
      isFollowUp
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const clearSession = () => {
    setMessages([]);
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    localStorage.removeItem('askql-chat-messages');
    localStorage.setItem('askql-session-id', newSessionId);
  };

  const getRecentMessages = (count: number = 15): ChatMessage[] => {
    return messages.slice(-count);
  };

  return (
    <ChatSessionContext.Provider value={{
      messages,
      sessionId,
      addMessage,
      clearSession,
      getRecentMessages,
      detectFollowUpMessage
    }}>
      {children}
    </ChatSessionContext.Provider>
  );
};

export const useChatSession = () => {
  const context = useContext(ChatSessionContext);
  if (context === undefined) {
    throw new Error('useChatSession must be used within a ChatSessionProvider');
  }
  return context;
};