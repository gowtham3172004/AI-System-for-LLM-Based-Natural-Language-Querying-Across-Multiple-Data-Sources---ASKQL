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
      'write query', 'create query', 'sql statement', 'query to',
      'give me the query', 'what is the query', 'show the query',
      'display the query', 'query for', 'sql for'
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

      console.log('Sending request to generate-sql function:', requestBody);

      const { data, error } = await supabase.functions.invoke('index-ts', {
        body: requestBody
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Response from generate-sql function:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to process your question');
      }

      // Add bot message
      addMessage({
        type: 'bot',
        content: data.explanation || data.response,
        query: isQueryReq && data.sqlQuery ? data.sqlQuery : undefined,
        results: data.results,
        mode: requestMode,
      });
      
      // Add to history
      addToHistory({
        question: currentQuestion,
        query: isQueryReq && data.sqlQuery ? data.sqlQuery : undefined,
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

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] md:h-[700px]">
      {/* Chat message area */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 min-h-[250px] sm:min-h-[300px] md:min-h-[400px] max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base md:text-lg">Ask me anything about your data!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${
                  msg.type === 'user' 
                    ? 'bg-gradient-to-r from-accent-blue/20 to-accent-cyan/20 border border-accent-blue/30 text-gray-900' 
                    : 'bg-gray-50 border border-gray-200 text-gray-900'
                }`}>
                  <div className="text-xs sm:text-sm md:text-base">{msg.content}</div>
                  {msg.query && (
                    <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-gray-100 rounded border border-gray-200">
                      <div className="text-xs text-accent-green font-medium mb-1 sm:mb-2">Generated SQL:</div>
                      <pre className="text-xs text-gray-700 overflow-x-auto">{msg.query}</pre>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => copyQuery(msg.query)}
                          className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 border border-sky-300 px-2 py-1 rounded"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  {msg.results && (
                    <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-gray-100 rounded border border-gray-200">
                      <div className="text-xs text-accent-green font-medium mb-1 sm:mb-2">Results:</div>
                      <div className="text-xs text-gray-700 overflow-x-auto">
                        <pre>{JSON.stringify(msg.results, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        <Input
          className="flex-1 bg-white border-gray-300 text-gray-900 placeholder-gray-500 rounded-xl px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg focus:border-accent-blue focus:ring-accent-blue/20"
          type="text"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
          className="bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Powered by Gemini AI */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-600 bg-gray-100 rounded-xl px-3 sm:px-4 py-2">
        <div className="flex items-center space-x-2">
          <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="text-xs">Powered by Gemini AI</span>
        </div>
        <span className="text-xs">Press Enter to send</span>
      </div>
    </div>
  );
};

export default ChatInterface;