
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface QueryResultsTableProps {
  data: any[];
  sql?: string;
}

const QueryResultsTable = ({ data, sql }: QueryResultsTableProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No results found
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  const copyResults = () => {
    const csvContent = [
      columns.join(','),
      ...data.map(row => columns.map(col => row[col]).join(','))
    ].join('\n');
    
    navigator.clipboard.writeText(csvContent);
    toast({
      title: "Results copied!",
      description: "Query results have been copied to clipboard as CSV",
    });
  };

  const downloadResults = () => {
    const csvContent = [
      columns.join(','),
      ...data.map(row => columns.map(col => row[col]).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Results downloaded!",
      description: "Query results have been downloaded as CSV",
    });
  };

  return (
    <div className="bg-dark-elevated rounded-2xl border border-dark-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Query Results ({data.length} rows)</h3>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={copyResults}
            className="border-dark-border text-gray-300 hover:bg-dark-elevated"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadResults}
            className="border-dark-border text-gray-300 hover:bg-dark-elevated"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-dark-border hover:bg-dark-bg">
              {columns.map((column) => (
                <TableHead key={column} className="text-neon-blue font-semibold">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} className="border-dark-border hover:bg-dark-bg">
                {columns.map((column) => (
                  <TableCell key={column} className="text-gray-300">
                    {row[column]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default QueryResultsTable;
