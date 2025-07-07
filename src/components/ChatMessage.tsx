import { Bot, User, Copy, Play, Code } from 'lucide-react';
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
  onRunQuery: (query: string) => void;
}

const ChatMessage = ({ message, onCopyQuery, onRunQuery }: ChatMessageProps) => {
  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`flex items-start space-x-3 max-w-4xl w-full ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          message.type === 'user' 
            ? 'bg-gradient-to-r from-neon-blue to-neon-cyan' 
            : 'bg-gradient-to-r from-neon-violet to-neon-pink'
        }`}>
          {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        
        <div className={`rounded-2xl p-4 min-w-0 flex-1 ${
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
                    onClick={() => onCopyQuery(message.query!)}
                    className="text-gray-400 hover:text-neon-blue"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRunQuery(message.query!)}
                    className="text-gray-400 hover:text-neon-green"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
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
  );
};

export default ChatMessage;