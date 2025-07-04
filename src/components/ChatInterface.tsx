
import { useState } from 'react';
import { Send, Copy, Play, Bot, User, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  query?: string;
  results?: any;
  mode?: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  activeDataSource?: any;
}

const ChatInterface = ({ activeDataSource }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    const currentQuestion = inputValue;
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const isQueryReq = isQueryRequest(currentQuestion);
      const requestMode = activeDataSource 
        ? (isQueryReq ? 'schema-aware' : 'execute')
        : (isQueryReq ? 'educational' : 'general');

      const { data, error } = await supabase.functions.invoke('generate-sql', {
        body: {
          question: currentQuestion,
          executeQuery: !isQueryReq && activeDataSource,
          mode: requestMode,
          schema: activeDataSource?.schema,
          tableData: activeDataSource?.data,
          fileName: activeDataSource?.name
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to process your question');
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: data.explanation || data.response,
        query: isQueryReq ? (data.sqlQuery || data.response) : undefined,
        results: data.results,
        mode: requestMode,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating SQL:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `Sorry, I encountered an error while processing your question. Please try again or rephrase your question.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      
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
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-r from-neon-blue to-neon-cyan' 
                        : 'bg-gradient-to-r from-neon-violet to-neon-pink'
                    }`}>
                      {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    
                    <div className={`rounded-2xl p-4 max-w-none ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-r from-neon-blue/20 to-neon-cyan/20 border border-neon-blue/30' 
                        : 'bg-dark-elevated border border-dark-border'
                    }`}>
                      <div className="text-white mb-2 whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </div>
                      
                      {message.query && (
                        <div className="mt-4 bg-dark-bg rounded-lg p-4 border border-dark-border animate-fade-in">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Code className="w-4 h-4 text-neon-green" />
                              <span className="text-sm font-medium text-neon-green">Generated SQL Query</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyQuery(message.query!)}
                                className="text-gray-400 hover:text-neon-blue"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => runQuery(message.query!)}
                                className="text-gray-400 hover:text-neon-green"
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                            <code>{message.query}</code>
                          </pre>
                        </div>
                      )}

                      {message.results && (
                        <div className="mt-4 bg-dark-bg rounded-lg p-4 border border-dark-border animate-fade-in">
                          <div className="flex items-center space-x-2 mb-3">
                            <Play className="w-4 h-4 text-neon-cyan" />
                            <span className="text-sm font-medium text-neon-cyan">Query Results</span>
                            <span className="text-xs text-gray-400">({message.results.totalRows} rows found)</span>
                          </div>
                          {message.results.error ? (
                            <div className="text-red-400 text-sm">{message.results.error}</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-gray-300">
                                <thead>
                                  <tr className="border-b border-dark-border">
                                    {message.results.data.length > 0 && Object.keys(message.results.data[0]).map((key) => (
                                      <th key={key} className="text-left p-2 text-neon-blue font-medium">{key}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {message.results.data.slice(0, 10).map((row: any, index: number) => (
                                    <tr key={index} className="border-b border-dark-border/50 hover:bg-dark-elevated/50">
                                      {Object.values(row).map((value: any, cellIndex) => (
                                        <td key={cellIndex} className="p-2 break-words max-w-xs">
                                          {value !== null && value !== undefined ? String(value) : '-'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {message.results.totalRows > 10 && (
                                <div className="text-center text-gray-500 text-xs mt-2">
                                  Showing first 10 rows of {message.results.totalRows} total rows
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
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
