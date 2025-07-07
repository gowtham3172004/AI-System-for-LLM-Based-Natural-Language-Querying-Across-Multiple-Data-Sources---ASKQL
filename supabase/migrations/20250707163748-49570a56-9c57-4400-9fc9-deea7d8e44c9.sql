-- Create user query history table
CREATE TABLE public.user_query_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  query TEXT,
  response TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  execution_time NUMERIC,
  mode TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user chat sessions table for context-aware responses
CREATE TABLE public.user_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_query_history
CREATE POLICY "Users can view their own query history" 
ON public.user_query_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own query history" 
ON public.user_query_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own query history" 
ON public.user_query_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for user_chat_sessions
CREATE POLICY "Users can view their own chat sessions" 
ON public.user_chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" 
ON public.user_chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" 
ON public.user_chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_query_history_updated_at
BEFORE UPDATE ON public.user_query_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_chat_sessions_updated_at
BEFORE UPDATE ON public.user_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_user_query_history_user_id ON public.user_query_history(user_id);
CREATE INDEX idx_user_query_history_created_at ON public.user_query_history(created_at DESC);
CREATE INDEX idx_user_chat_sessions_user_id ON public.user_chat_sessions(user_id);
CREATE INDEX idx_user_chat_sessions_session_id ON public.user_chat_sessions(session_id);