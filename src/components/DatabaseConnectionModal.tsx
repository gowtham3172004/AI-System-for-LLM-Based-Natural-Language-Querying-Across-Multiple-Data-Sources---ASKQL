
import { useState } from 'react';
import { Database, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface DatabaseConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDatabaseConnected?: (connectionInfo: any) => void;
}

const DatabaseConnectionModal = ({ open, onOpenChange, onDatabaseConnected }: DatabaseConnectionModalProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    host: '',
    port: '',
    username: '',
    password: '',
    database: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConnect = async () => {
    if (!formData.type || !formData.host || !formData.username || !formData.database) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    
    // Simulate connection
    setTimeout(() => {
      setIsConnecting(false);
      toast({
        title: "Database connected successfully!",
        description: `Connected to ${formData.type} database: ${formData.database}`,
      });
      onOpenChange(false);
    }, 3000);
  };

  const testConnection = async () => {
    toast({
      title: "Testing connection...",
      description: "Verifying database credentials",
    });
    
    setTimeout(() => {
      toast({
        title: "Connection test successful!",
        description: "Database is reachable and credentials are valid",
      });
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-surface border-dark-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center">
            <Database className="w-6 h-6 mr-3 text-neon-violet" />
            Connect to Database
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="db-type" className="text-white">Database Type</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                <SelectTrigger className="bg-dark-elevated border-dark-border text-white">
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent className="bg-dark-elevated border-dark-border">
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="sqlite">SQLite</SelectItem>
                  <SelectItem value="mssql">SQL Server</SelectItem>
                  <SelectItem value="oracle">Oracle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="host" className="text-white">Host</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => handleInputChange('host', e.target.value)}
                  placeholder="localhost"
                  className="bg-dark-elevated border-dark-border text-white placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="port" className="text-white">Port</Label>
                <Input
                  id="port"
                  value={formData.port}
                  onChange={(e) => handleInputChange('port', e.target.value)}
                  placeholder="3306"
                  className="bg-dark-elevated border-dark-border text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="username"
                className="bg-dark-elevated border-dark-border text-white placeholder-gray-400"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="password"
                  className="bg-dark-elevated border-dark-border text-white placeholder-gray-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="database" className="text-white">Database Name</Label>
              <Input
                id="database"
                value={formData.database}
                onChange={(e) => handleInputChange('database', e.target.value)}
                placeholder="database_name"
                className="bg-dark-elevated border-dark-border text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={testConnection}
              variant="outline"
              className="flex-1 border-dark-border text-gray-300 hover:bg-dark-elevated"
              disabled={isConnecting}
            >
              Test Connection
            </Button>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1 bg-gradient-to-r from-neon-violet to-neon-pink hover:from-neon-pink hover:to-neon-violet transition-all"
            >
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                'Connect Database'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DatabaseConnectionModal;
