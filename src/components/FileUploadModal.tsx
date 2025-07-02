
import { useState } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FileUploadModal = ({ open, onOpenChange }: FileUploadModalProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleFiles = (file: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setIsUploading(true);
      
      // Simulate upload
      setTimeout(() => {
        setUploadedFile(file);
        setIsUploading(false);
        toast({
          title: "File uploaded successfully!",
          description: `${file.name} is ready for querying`,
        });
      }, 2000);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
    }
  };

  const handleConnect = () => {
    if (uploadedFile) {
      toast({
        title: "Data source connected!",
        description: "You can now start asking questions about your data",
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-surface border-dark-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center">
            <Upload className="w-6 h-6 mr-3 text-neon-blue" />
            Upload Your Data File
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {!uploadedFile ? (
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive 
                  ? 'border-neon-blue bg-neon-blue/10' 
                  : 'border-dark-border hover:border-neon-blue/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-neon-blue to-neon-cyan rounded-full flex items-center justify-center animate-pulse">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white font-medium">Uploading your file...</p>
                  <div className="w-full bg-dark-border rounded-full h-2">
                    <div className="bg-gradient-to-r from-neon-blue to-neon-cyan h-2 rounded-full animate-pulse w-3/4"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-neon-blue to-neon-cyan rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-2">
                      Drag & drop your file here, or click to browse
                    </p>
                    <p className="text-gray-400 text-sm">
                      Supports CSV, XLS, and XLSX files
                    </p>
                  </div>
                  <Button
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue transition-all"
                  >
                    Choose File
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={(e) => e.target.files?.[0] && handleFiles(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-dark-elevated rounded-2xl p-6 border border-dark-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-neon-green to-neon-cyan rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{uploadedFile.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          )}
          
          {uploadedFile && (
            <div className="flex space-x-3">
              <Button
                onClick={() => setUploadedFile(null)}
                variant="outline"
                className="flex-1 border-dark-border text-gray-300 hover:bg-dark-elevated"
              >
                Upload Different File
              </Button>
              <Button
                onClick={handleConnect}
                className="flex-1 bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-cyan hover:to-neon-green transition-all"
              >
                Connect Data Source
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadModal;
