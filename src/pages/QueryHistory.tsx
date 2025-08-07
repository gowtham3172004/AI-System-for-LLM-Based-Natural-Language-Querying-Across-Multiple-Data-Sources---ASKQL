
import { useState } from 'react';
import { Search, Clock, Copy, Play, Trash2, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { useUserQueryHistory } from '@/contexts/UserQueryHistoryContext';

const QueryHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { queryHistory, clearHistory, isLoading } = useUserQueryHistory();

  const filteredHistory = queryHistory.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.query && item.query.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         item.response.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
    toast({
      title: "Query copied!",
      description: "SQL query has been copied to clipboard",
    });
  };

  const rerunQuery = (item: any) => {
    toast({
      title: "Re-running query...",
      description: `Executing: ${item.question}`,
    });
  };

  const clearAllHistory = async () => {
    await clearHistory();
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-12 pt-24">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Query History</h1>
          <p className="text-gray-600 text-lg">Review, copy, and re-run your previous queries</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search queries or questions..."
                className="pl-10 bg-light-elevated border-light-border text-gray-900 placeholder-gray-400"
              />
            </div>
            
            <div className="flex gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-light-elevated border-light-border text-gray-900">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-light-elevated border-light-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all query history? This action cannot be undone.')) {
                    clearAllHistory();
                  }
                }}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-gray-900"
                disabled={queryHistory.length === 0 || isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Query History List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-light-surface rounded-2xl border border-light-border p-12 text-center">
            <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No queries found</h3>
            <p className="text-black">
              {searchTerm ? 'Try adjusting your search terms' : 'Start asking questions to build your query history'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-light-surface rounded-2xl border border-light-border p-6 hover:border-accent-blue/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-accent-blue transition-colors">
                      {item.question}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                      {item.execution_time && (
                        <span className="bg-light-elevated px-2 py-1 rounded">
                          {item.execution_time}s
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'success' 
                          ? 'bg-accent-green/20 text-accent-green' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {item.query && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyQuery(item.query)}
                        className="text-gray-600 hover:text-accent-blue opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                    {item.query && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rerunQuery(item)}
                        className="text-gray-600 hover:text-accent-green opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {item.query && (
                  <div className="bg-light-bg rounded-lg p-4 border border-light-border">
                    <pre className="text-sm text-black overflow-x-auto">
                      <code>{item.query}</code>
                    </pre>
                  </div>
                )}
                
                <div className="bg-light-bg rounded-lg p-4 border border-light-border mt-2">
                  <div className="text-sm text-black whitespace-pre-wrap">
                    {item.response}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copyright Section */}
      <footer className="mt-16 py-8 border-t border-light-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              © 2024 AskQL. All rights reserved. | 
              <span className="text-accent-blue"> Powered by AI-driven SQL analytics</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default QueryHistory;
