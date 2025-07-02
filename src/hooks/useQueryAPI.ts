
import { useState } from 'react';
import { supabase, isDevelopmentMode } from '@/lib/supabase';
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
      if (isDevelopmentMode) {
        // Mock SQL generation
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockSQL = `SELECT * FROM ${tableSchema?.table_name || 'data'} LIMIT 10`;
        return mockSQL;
      }

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
      if (isDevelopmentMode) {
        // Mock query execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockResult = [
          { id: 1, name: 'Sample Data 1', value: 100 },
          { id: 2, name: 'Sample Data 2', value: 200 },
          { id: 3, name: 'Sample Data 3', value: 300 }
        ];
        return { result: mockResult, row_count: mockResult.length };
      }

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
      if (isDevelopmentMode) {
        // Mock file upload
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mockSchema = {
          table_name: file.name.replace(/\.[^/.]+$/, ""),
          columns: [
            { name: 'id', type: 'INTEGER' },
            { name: 'name', type: 'TEXT' },
            { name: 'value', type: 'NUMERIC' }
          ]
        };
        
        toast({
          title: "Demo Mode",
          description: "File upload simulated. Connect to Supabase for real uploads."
        });

        return {
          file_id: 'demo-file-id',
          filename: file.name,
          schema: mockSchema
        };
      }

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
      if (isDevelopmentMode) {
        return {
          filename: 'demo.csv',
          schema: {
            table_name: 'demo',
            columns: [
              { name: 'id', type: 'INTEGER' },
              { name: 'name', type: 'TEXT' },
              { name: 'value', type: 'NUMERIC' }
            ]
          }
        };
      }

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
