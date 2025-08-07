import { useState } from 'react';
import { Upload, Database, Plus, FileText, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAppState } from '@/contexts/AppStateContext';
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
  const { dataSources, activeDataSource, setDataSources, setActiveDataSource } = useAppState();
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
    
    setDataSources([...dataSources, newSource]);
    setActiveDataSource(newSource);
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
    
    setDataSources([...dataSources, newSource]);
    setActiveDataSource(newSource);
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
    setDataSources(dataSources.filter(source => source.id !== id));
    if (activeDataSource?.id === id) {
      setActiveDataSource(null);
      onDataSourceChange(null);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-3 sm:p-4 mb-4">
      <div className="text-center mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Data Sources</h3>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-3">
          <Button
            onClick={() => setShowFileUpload(true)}
            size="sm"
            className="w-full sm:w-auto bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs sm:text-sm"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-sky-100" />
            Upload File
          </Button>
          <Button
            onClick={() => setShowDatabaseModal(true)}
            size="sm"
            className="w-full sm:w-auto bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs sm:text-sm"
          >
            <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-sky-100" />
            Connect Database
          </Button>
        </div>
      </div>

      {dataSources.length === 0 ? (
        <div className="text-center py-3 sm:py-4 text-gray-600">
          <Plus className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
          <p className="text-xs sm:text-sm">No data sources connected</p>
          <p className="text-xs mt-1">Upload a file or connect a database to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dataSources.map((source) => (
            <div
              key={source.id}
              className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border transition-all cursor-pointer ${
                activeDataSource?.id === source.id
                  ? 'border-accent-blue bg-accent-blue/10'
                  : 'border-gray-200 bg-gray-50 hover:border-accent-blue/50'
              }`}
              onClick={() => {
                setActiveDataSource(source);
                onDataSourceChange(source);
              }}
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                  {source.type === 'file' ? (
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </div>
                <div>
                  <h4 className="text-gray-900 font-medium text-sm sm:text-base">{source.name}</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    {source.type === 'file' 
                      ? `${source.data?.length || 0} rows` 
                      : 'Database connection'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent-green" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDataSource(source.id);
                  }}
                  className="text-gray-400 hover:text-red-400 p-1 sm:p-2"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
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