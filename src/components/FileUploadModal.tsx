
import { useState } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useQueryAPI } from '@/hooks/useQueryAPI';

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUploaded?: (fileData: any) => void;
}

const FileUploadModal = ({ open, onOpenChange, onFileUploaded }: FileUploadModalProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { uploadFile, isLoading } = useQueryAPI();

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

  const handleFiles = async (file: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setUploadedFile(file);
      
      const result = await uploadFile(file);
      if (result) {
        onFileUploaded?.(result);
        onOpenChange(false);
        setUploadedFile(null);
      }
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
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
            {isLoading ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-r from-neon-blue to-neon-cyan rounded-full flex items-center justify-center animate-pulse">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-medium">Uploading and processing your file...</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadModal;
