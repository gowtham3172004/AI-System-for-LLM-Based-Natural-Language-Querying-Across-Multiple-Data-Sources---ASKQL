
import { useState } from 'react';
import { Send, Copy, Play, Bot, User, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  query?: string;
  timestamp: Date;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `I'll help you analyze your data. Based on your question: "${inputValue}", here's the SQL query I generated:`,
        query: `SELECT region, SUM(sales) as total_sales 
FROM sales_data 
GROUP BY region 
ORDER BY total_sales DESC;`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
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
                    
                    <div className={`rounded-2xl p-4 ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-r from-neon-blue/20 to-neon-cyan/20 border border-neon-blue/30' 
                        : 'bg-dark-elevated border border-dark-border'
                    }`}>
                      <p className="text-white mb-2">{message.content}</p>
                      
                      {message.query && (
                        <div className="mt-4 bg-dark-bg rounded-lg p-4 border border-dark-border">
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
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{message.query}</code>
                          </pre>
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
