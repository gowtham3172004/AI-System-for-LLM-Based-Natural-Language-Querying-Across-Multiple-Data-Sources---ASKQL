import { useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserQueryHistory } from '@/contexts/UserQueryHistoryContext';
import { useChatSession } from '@/contexts/ChatSessionContext';
import ChatMessage from '@/components/ChatMessage';

interface ChatInterfaceProps {
  activeDataSource?: any;
}

const ChatInterface = ({ activeDataSource }: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addToHistory } = useUserQueryHistory();
  const { messages, addMessage, getRecentMessages, detectFollowUpMessage } = useChatSession();

  // Function to detect if user is asking for a query specifically
  const isQueryRequest = (question: string): boolean => {
    const queryKeywords = [
      'query', 'sql', 'select', 'show me the query', 'generate query', 
      'write query', 'create query', 'sql statement', 'query to'
    ];
    return queryKeywords.some(keyword => 
      question.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const currentQuestion = inputValue;
    const isFollowUp = detectFollowUpMessage(currentQuestion);
    
    // Add user message
    addMessage({
      type: 'user',
      content: currentQuestion,
    });

    setInputValue('');
    setIsLoading(true);

    try {
      const isQueryReq = isQueryRequest(currentQuestion);
      const requestMode = activeDataSource 
        ? (activeDataSource.type === 'database' ? 'database' : (isQueryReq ? 'schema-aware' : 'execute'))
        : (isQueryReq ? 'educational' : 'general');

      // Get recent messages for context if it's a follow-up
      const recentMessages = isFollowUp ? getRecentMessages(10) : [];
      
      const requestBody: any = {
        question: currentQuestion,
        executeQuery: !isQueryReq && activeDataSource,
        mode: requestMode,
        schema: activeDataSource?.schema,
        tableData: activeDataSource?.data,
        fileName: activeDataSource?.name,
        isFollowUp,
        messageHistory: recentMessages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
          query: msg.query
        }))
      };

      // Add connection info for database sources
      if (activeDataSource?.type === 'database' && activeDataSource?.connectionInfo) {
        requestBody.connectionInfo = activeDataSource.connectionInfo;
      }

      const { data, error } = await supabase.functions.invoke('generate-sql', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to process your question');
      }

      // Add bot message
      addMessage({
        type: 'bot',
        content: data.explanation || data.response,
        query: isQueryReq ? (data.sqlQuery || data.response) : undefined,
        results: data.results,
        mode: requestMode,
      });
      
      // Add to history
      addToHistory({
        question: currentQuestion,
        query: isQueryReq ? (data.sqlQuery || data.response) : undefined,
        response: data.explanation || data.response,
        status: 'success',
        mode: requestMode
      });
    } catch (error) {
      console.error('Error generating SQL:', error);
      
      // Add error message
      addMessage({
        type: 'bot',
        content: `Sorry, I encountered an error while processing your question. Please try again or rephrase your question.`,
      });
      
      // Add error to history
      addToHistory({
        question: currentQuestion,
        response: "Error occurred while processing the question",
        status: 'error'
      });
      
      toast({
        title: "Error",
        description: "Failed to generate SQL query. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
    toast({
      title: "Query copied!",
      description: "SQL query has been copied to clipboard",
    });
  };

  const runQuery = (query: string) => {
    toast({
      title: "Query executed!",
      description: "Running query against your data source...",
    });
  };

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Start Asking Questions
          </h2>
          <p className="text-gray-400 text-lg">
            Type your questions in plain English and watch the magic happen
          </p>
        </div>

        {/* Chat Messages */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 mb-6 min-h-[400px] max-h-[600px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Bot className="w-12 h-12 mx-auto mb-4 text-neon-blue" />
                <p>Ask me anything about your data!</p>
                <p className="text-sm mt-2">Try: "Show me total sales by region" or "Which customers bought the most?"</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopyQuery={copyQuery}
                  onRunQuery={runQuery}
                />
              ))}
              
              {isLoading && (
                <div className="flex justify-start animate-slide-up">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-neon-violet to-neon-pink flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-dark-elevated rounded-2xl p-4 border border-dark-border">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-neon-blue rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-neon-violet rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6">
          <div className="flex space-x-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask something like: 'Show me total sales by region'"
              className="flex-1 bg-dark-elevated border-dark-border text-white placeholder-gray-400 rounded-xl px-6 py-4 text-lg focus:border-neon-blue focus:ring-neon-blue/20"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue rounded-xl px-8 py-4 text-lg font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex items-center mt-4 text-sm text-gray-400">
            <Bot className="w-4 h-4 mr-2 text-neon-blue" />
            <span>Powered by Gemini AI • Press Enter to send</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatInterface;