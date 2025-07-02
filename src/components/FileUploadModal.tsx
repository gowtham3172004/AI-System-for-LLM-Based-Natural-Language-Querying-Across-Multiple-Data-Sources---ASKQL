
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useQueryAPI } from '@/hooks/useQueryAPI';
import { toast } from '@/hooks/use-toast';

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUploaded: (fileData: any) => void;
}

const FileUploadModal = ({ open, onOpenChange, onFileUploaded }: FileUploadModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const { uploadFile, isLoading } = useQueryAPI();

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploadStatus('uploading');
    
    try {
      const result = await uploadFile(file);
      if (result) {
        setUploadStatus('success');
        onFileUploaded(result);
        setTimeout(() => {
          onOpenChange(false);
          setUploadStatus('idle');
        }, 1500);
      } else {
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-surface border-dark-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Upload Data File</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              isDragging
                ? 'border-neon-blue bg-neon-blue/10'
                : uploadStatus === 'success'
                ? 'border-green-500 bg-green-500/10'
                : uploadStatus === 'error'
                ? 'border-red-500 bg-red-500/10'
                : 'border-dark-border bg-dark-elevated hover:border-neon-blue/50 hover:bg-dark-bg'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadStatus === 'uploading' ? (
              <div className="space-y-4">
                <div className="w-12 h-12 mx-auto border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-medium">Uploading...</p>
              </div>
            ) : uploadStatus === 'success' ? (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                <p className="text-green-500 font-medium">Upload successful!</p>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="space-y-4">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="text-red-500 font-medium">Upload failed</p>
                <Button
                  onClick={() => setUploadStatus('idle')}
                  variant="outline"
                  className="border-dark-border text-gray-300"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 mx-auto text-neon-blue" />
                <div>
                  <p className="text-white font-medium mb-2">
                    Drag & drop your file here
                  </p>
                  <p className="text-gray-400 text-sm">
                    or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue"
                  disabled={isLoading}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>

          {/* Supported Formats */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Supported formats: CSV, Excel (.xlsx, .xls)
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Max file size: 10MB
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadModal;
