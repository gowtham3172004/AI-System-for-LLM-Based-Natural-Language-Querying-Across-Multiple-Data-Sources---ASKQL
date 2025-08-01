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
  connectionInfo?: any; // For database connections
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
    // Store database connection info for backend use
    const newSource: DataSource = {
      id: Date.now().toString(),
      name: connectionInfo.name || `${connectionInfo.type} Database`,
      type: 'database',
      schema: connectionInfo.schema,
      connected: true,
      connectionInfo: connectionInfo // Store connection details
    };
    
    setDataSources(prev => [...prev, newSource]);
    setActiveSource(newSource);
    onDataSourceChange(newSource);
    
    toast({
      title: "Database connected!",
      description: `${newSource.name} is ready for querying`,
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
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">Data Sources</h3>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Button
            onClick={() => setShowFileUpload(true)}
            size="default"
            className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue w-full sm:w-auto"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <Button
            onClick={() => setShowDatabaseModal(true)}
            size="default"
            className="bg-gradient-to-r from-neon-violet to-neon-pink hover:from-neon-pink hover:to-neon-violet w-full sm:w-auto"
          >
            <Database className="w-4 h-4 mr-2" />
            Connect Database
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