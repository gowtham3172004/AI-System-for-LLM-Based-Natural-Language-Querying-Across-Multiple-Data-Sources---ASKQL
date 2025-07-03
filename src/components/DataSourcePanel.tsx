import { useState } from 'react';
import { Upload, Database, Plus, FileText, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import FileUploadModal from './FileUploadModal';
import DatabaseConnectionModal from './DatabaseConnectionModal';

interface DataSource {
  id: string;
  name: string;
  type: 'file' | 'database';
  schema?: string;
  data?: any[];
  connected: boolean;
}

interface DataSourcePanelProps {
  onDataSourceChange: (dataSource: DataSource | null) => void;
}

const DataSourcePanel = ({ onDataSourceChange }: DataSourcePanelProps) => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeSource, setActiveSource] = useState<DataSource | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);

  const handleFileUpload = (file: File, data: any[]) => {
    const newSource: DataSource = {
      id: Date.now().toString(),
      name: file.name,
      type: 'file',
      data,
      schema: generateSchemaFromData(data),
      connected: true
    };
    
    setDataSources(prev => [...prev, newSource]);
    setActiveSource(newSource);
    onDataSourceChange(newSource);
    
    toast({
      title: "Data source connected!",
      description: `${file.name} is ready for querying`,
    });
  };

  const handleDatabaseConnection = (connectionInfo: any) => {
    const newSource: DataSource = {
      id: Date.now().toString(),
      name: connectionInfo.name,
      type: 'database',
      schema: connectionInfo.schema,
      connected: true
    };
    
    setDataSources(prev => [...prev, newSource]);
    setActiveSource(newSource);
    onDataSourceChange(newSource);
    
    toast({
      title: "Database connected!",
      description: `${connectionInfo.name} is ready for querying`,
    });
  };

  const generateSchemaFromData = (data: any[]): string => {
    if (!data || data.length === 0) return '';
    
    const sample = data[0];
    const columns = Object.keys(sample).map(key => {
      const value = sample[key];
      const type = typeof value === 'number' ? 'INTEGER' : 'TEXT';
      return `  ${key} ${type}`;
    }).join(',\n');
    
    return `CREATE TABLE data (\n${columns}\n);`;
  };

  const removeDataSource = (id: string) => {
    setDataSources(prev => prev.filter(source => source.id !== id));
    if (activeSource?.id === id) {
      setActiveSource(null);
      onDataSourceChange(null);
    }
  };

  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">Data Sources</h3>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowFileUpload(true)}
            size="sm"
            className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <Button
            onClick={() => setShowDatabaseModal(true)}
            size="sm"
            variant="outline"
            className="border-dark-border text-gray-300 hover:bg-dark-elevated"
          >
            <Database className="w-4 h-4 mr-2" />
            Connect DB
          </Button>
        </div>
      </div>

      {dataSources.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Plus className="w-12 h-12 mx-auto mb-4" />
          <p>No data sources connected</p>
          <p className="text-sm mt-2">Upload a file or connect a database to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dataSources.map((source) => (
            <div
              key={source.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                activeSource?.id === source.id
                  ? 'border-neon-blue bg-neon-blue/10'
                  : 'border-dark-border bg-dark-elevated hover:border-neon-blue/50'
              }`}
              onClick={() => {
                setActiveSource(source);
                onDataSourceChange(source);
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-neon-green to-neon-cyan rounded-lg flex items-center justify-center">
                  {source.type === 'file' ? (
                    <FileText className="w-5 h-5 text-white" />
                  ) : (
                    <Database className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h4 className="text-white font-medium">{source.name}</h4>
                  <p className="text-gray-400 text-sm">
                    {source.type === 'file' 
                      ? `${source.data?.length || 0} rows` 
                      : 'Database connection'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-neon-green" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDataSource(source.id);
                  }}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FileUploadModal
        open={showFileUpload}
        onOpenChange={setShowFileUpload}
        onFileUploaded={handleFileUpload}
      />

      <DatabaseConnectionModal
        open={showDatabaseModal}
        onOpenChange={setShowDatabaseModal}
        onDatabaseConnected={handleDatabaseConnection}
      />
    </div>
  );
};

export default DataSourcePanel;