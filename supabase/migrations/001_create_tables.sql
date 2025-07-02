
-- Create query_history table
CREATE TABLE query_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  sql_generated TEXT NOT NULL,
  result JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create uploaded_files table
CREATE TABLE uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  schema JSONB NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create db_connections table
CREATE TABLE db_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  db_name TEXT NOT NULL,
  db_type TEXT NOT NULL,
  credentials JSONB NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only see their own query history" ON query_history
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own uploaded files" ON uploaded_files
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own db connections" ON db_connections
  FOR ALL USING (auth.uid() = user_id);
