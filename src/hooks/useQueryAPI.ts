
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface QueryResult {
  sql?: string;
  result?: any[];
  row_count?: number;
}

export const useQueryAPI = () => {
  const [isLoading, setIsLoading] = useState(false);

  const generateSQL = async (naturalLanguageQuery: string, tableSchema?: any): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('generate-sql', {
        body: {
          natural_language_query: naturalLanguageQuery,
          table_schema: tableSchema
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data.sql;
    } catch (error) {
      console.error('Error generating SQL:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate SQL query",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const executeQuery = async (sqlQuery: string, fileId?: string): Promise<QueryResult | null> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('execute-query', {
        body: {
          sql_query: sqlQuery,
          file_id: fileId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error) {
      console.error('Error executing query:', error);
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<any | null> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await supabase.functions.invoke('upload-file', {
        body: formData
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Success",
        description: "File uploaded successfully!"
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getSchema = async (fileId: string): Promise<any | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('get-schema', {
        body: { file_id: fileId }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error) {
      console.error('Error getting schema:', error);
      return null;
    }
  };

  return {
    generateSQL,
    executeQuery,
    uploadFile,
    getSchema,
    isLoading
  };
};
