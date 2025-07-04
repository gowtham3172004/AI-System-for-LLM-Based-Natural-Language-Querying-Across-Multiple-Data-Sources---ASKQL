
import { useState } from 'react';
import { Search, Clock, Copy, Play, Trash2, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';

interface QueryHistoryItem {
  id: string;
  question: string;
  query: string;
  timestamp: Date;
  status: 'success' | 'error';
  executionTime?: number;
}

const QueryHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Query history state
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([
    {
      id: '1',
      question: 'Show me total sales by region',
      query: 'SELECT region, SUM(sales) as total_sales FROM sales_data GROUP BY region ORDER BY total_sales DESC;',
      timestamp: new Date('2024-01-15T10:30:00'),
      status: 'success',
      executionTime: 1.2
    },
    {
      id: '2',
      question: 'Which customers bought the most products?',
      query: 'SELECT customer_name, COUNT(*) as product_count FROM orders JOIN customers ON orders.customer_id = customers.id GROUP BY customer_name ORDER BY product_count DESC LIMIT 10;',
      timestamp: new Date('2024-01-15T09:15:00'),
      status: 'success',
      executionTime: 0.8
    },
    {
      id: '3',
      question: 'Average order value by month',
      query: 'SELECT DATE_FORMAT(order_date, "%Y-%m") as month, AVG(total_amount) as avg_order_value FROM orders GROUP BY month ORDER BY month;',
      timestamp: new Date('2024-01-14T16:45:00'),
      status: 'success',
      executionTime: 2.1
    },
    {
      id: '4',
      question: 'Top selling products last quarter',
      query: 'SELECT p.product_name, SUM(oi.quantity) as total_sold FROM products p JOIN order_items oi ON p.id = oi.product_id WHERE order_date >= "2023-10-01" GROUP BY p.product_name ORDER BY total_sold DESC;',
      timestamp: new Date('2024-01-14T14:20:00'),
      status: 'error'
    }
  ]);

  const filteredHistory = queryHistory.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.query.toLowerCase().includes(searchTerm.toLowerCase());
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

  const rerunQuery = (item: QueryHistoryItem) => {
    toast({
      title: "Re-running query...",
      description: `Executing: ${item.question}`,
    });
  };

  const deleteQuery = (id: string) => {
    toast({
      title: "Query deleted",
      description: "Query has been removed from history",
    });
  };

  const clearAllHistory = () => {
    setQueryHistory([]);
    toast({
      title: "History cleared",
      description: "All query history has been deleted",
    });
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Query History</h1>
          <p className="text-gray-400 text-lg">Review, copy, and re-run your previous queries</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search queries or questions..."
                className="pl-10 bg-dark-elevated border-dark-border text-white placeholder-gray-400"
              />
            </div>
            
            <div className="flex gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-dark-elevated border-dark-border text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark-elevated border-dark-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={clearAllHistory}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Query History List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-12 text-center">
            <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No queries found</h3>
            <p className="text-gray-400">
              {searchTerm ? 'Try adjusting your search terms' : 'Start asking questions to build your query history'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-dark-surface rounded-2xl border border-dark-border p-6 hover:border-neon-blue/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-neon-blue transition-colors">
                      {item.question}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{item.timestamp.toLocaleString()}</span>
                      </div>
                      {item.executionTime && (
                        <span className="bg-dark-elevated px-2 py-1 rounded">
                          {item.executionTime}s
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'success' 
                          ? 'bg-neon-green/20 text-neon-green' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyQuery(item.query)}
                      className="text-gray-400 hover:text-neon-blue opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rerunQuery(item)}
                      className="text-gray-400 hover:text-neon-green opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteQuery(item.id)}
                      className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
                    <code>{item.query}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryHistory;
