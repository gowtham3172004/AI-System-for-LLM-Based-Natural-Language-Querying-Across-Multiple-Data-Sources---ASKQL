import { Bot, User, Copy, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  message: {
    id: string;
    type: 'user' | 'bot';
    content: string;
    query?: string;
    results?: any;
    mode?: string;
    timestamp: Date;
  };
  onCopyQuery: (query: string) => void;
}

const ChatMessage = ({ message, onCopyQuery }: ChatMessageProps) => {
  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`flex items-start space-x-2 sm:space-x-3 max-w-4xl w-full ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transform hover:scale-110 hover:animate-float ${
          message.type === 'user' 
            ? 'bg-gradient-to-r from-neon-blue to-neon-cyan shadow-lg hover:shadow-neon-blue/50' 
            : 'bg-gradient-to-r from-neon-violet to-neon-pink shadow-lg hover:shadow-neon-violet/50'
        }`}>
          {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        
        <div className={`rounded-2xl p-3 sm:p-4 min-w-0 flex-1 ${
          message.type === 'user' 
            ? 'bg-gradient-to-r from-accent-blue/20 to-accent-cyan/20 border border-accent-blue/30' 
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className="text-gray-900 mb-2 whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
          
          {message.query && message.query.trim() && message.mode !== 'execute' && (
            <div className="mt-4 bg-gray-100 rounded-lg p-3 sm:p-4 border border-gray-200 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Code className="w-4 h-4 text-accent-green" />
                  <span className="text-sm font-medium text-accent-green">Generated SQL Query</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopyQuery(message.query!)}
                    className="text-gray-500 hover:text-sky-500"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <pre className="text-xs sm:text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                <code>{message.query}</code>
              </pre>
            </div>
          )}

          {message.results && (
            <div className="mt-4 bg-gray-100 rounded-lg p-3 sm:p-4 border border-gray-200 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-3">
                <div className="flex items-center space-x-2">
                  <Play className="w-4 h-4 text-neon-cyan" />
                  <span className="text-sm font-medium text-neon-cyan">Query Results</span>
                </div>
                <span className="text-xs text-gray-400">({message.results.totalRows} rows found)</span>
              </div>
              {message.results.error ? (
                <div className="text-red-400 text-sm">{message.results.error}</div>
              ) : (
                <div className="overflow-x-auto">
                                  <table className="w-full text-xs sm:text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-300">
                      {message.results.data.length > 0 && Object.keys(message.results.data[0]).map((key) => (
                        <th key={key} className="text-left p-1 sm:p-2 text-neon-blue font-medium">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {message.results.data.slice(0, 10).map((row: any, index: number) => (
                      <tr key={index} className="border-b border-gray-300/50 hover:bg-gray-50/50">
                          {Object.values(row).map((value: any, cellIndex) => (
                            <td key={cellIndex} className="p-1 sm:p-2 break-words max-w-xs">
                              {value !== null && value !== undefined ? String(value) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {message.results.totalRows > 10 && (
                    <div className="text-center text-gray-600 text-xs mt-2">
                      Showing first 10 rows of {message.results.totalRows} total rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <p className="text-xs text-gray-600 mt-2">
            {message.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;