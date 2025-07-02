
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Upload, Database } from 'lucide-react';
import { useQueryAPI } from '@/hooks/useQueryAPI';
import QueryResultsTable from '@/components/QueryResultsTable';
import FileUploadModal from '@/components/FileUploadModal';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sql?: string;
  results?: any[];
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentSchema, setCurrentSchema] = useState<any>(null);
  
  const { generateSQL, executeQuery, isLoading } = useQueryAPI();

  const handleSendMessage = async () => {
    if (!input.trim() || !currentFileId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Generate SQL
      const sql = await generateSQL(input, currentSchema);
      if (!sql) return;

      // Execute query
      const result = await executeQuery(sql, currentFileId);
      if (!result) return;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Here are the results for: "${input}"`,
        sql: sql,
        results: result.result
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  const handleFileUploaded = (fileId: string, schema: any) => {
    setCurrentFileId(fileId);
    setCurrentSchema(schema);
    setIsUploadModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Query Your Data</h2>
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-gradient-to-r from-neon-blue to-neon-cyan"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Data
          </Button>
        </div>
        
        {currentFileId && (
          <div className="mt-4 p-3 bg-dark-surface rounded-lg border border-dark-border">
            <div className="flex items-center text-green-400">
              <Database className="w-4 h-4 mr-2" />
              <span className="text-sm">Data file loaded and ready for queries</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 mb-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Upload your data and start asking questions</p>
            <p className="text-sm">Try: "Show me all records" or "Find the highest values"</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-4">
            <Card className={`p-4 ${message.type === 'user' ? 'bg-dark-elevated ml-12' : 'bg-dark-surface mr-12'}`}>
              <p className="text-white">{message.content}</p>
              {message.sql && (
                <div className="mt-3 p-3 bg-dark-bg rounded border border-dark-border">
                  <p className="text-xs text-gray-400 mb-1">Generated SQL:</p>
                  <code className="text-neon-cyan text-sm">{message.sql}</code>
                </div>
              )}
            </Card>
            
            {message.results && (
              <QueryResultsTable data={message.results} sql={message.sql} />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={currentFileId ? "Ask a question about your data..." : "Upload data first to start querying..."}
          disabled={!currentFileId || isLoading}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="bg-dark-surface border-dark-border text-white"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!input.trim() || !currentFileId || isLoading}
          className="bg-gradient-to-r from-neon-blue to-neon-cyan"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileUploaded={handleFileUploaded}
      />
    </div>
  );
};

export default ChatInterface;
