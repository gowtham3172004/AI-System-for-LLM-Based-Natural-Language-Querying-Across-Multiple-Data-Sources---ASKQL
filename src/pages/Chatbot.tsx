import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import ChatInterface from '@/components/ChatInterface';
import DataSourcePanel from '@/components/DataSourcePanel';
import { Button } from '@/components/ui/button';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useAppState } from '@/contexts/AppStateContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

const Chatbot = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { activeDataSource } = useAppState();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-blue to-neon-violet bg-clip-text text-transparent mb-2">
            AskQL Chatbot
          </h1>
          <p className="text-gray-400">
            Ask questions about your data in natural language and get SQL queries and insights
          </p>
        </div>

        {!user ? (
          <Card className="bg-dark-elevated border-dark-border max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-xl font-semibold text-white mb-2">Sign in Required</h3>
              <p className="text-gray-400 text-center mb-4">
                Please sign in to use the chatbot and save your conversation history.
              </p>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="bg-neon-blue hover:bg-neon-blue/80"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
            {/* Main Chat Area */}
            <div className={`${isPanelOpen ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all duration-300`}>
              <div className="bg-dark-elevated rounded-lg border border-dark-border h-full flex flex-col">
                {/* Chat Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-border">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h2 className="text-lg font-semibold text-white">Chat Session</h2>
                    {activeDataSource && (
                      <span className="text-sm text-gray-400">
                        Connected to: {activeDataSource.name}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    className="text-gray-400 hover:text-white lg:hidden"
                  >
                    {isPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Chat Interface */}
                <div className="flex-1 overflow-hidden">
                  <ChatInterface activeDataSource={activeDataSource} />
                </div>
              </div>
            </div>

            {/* Data Source Panel */}
            {isPanelOpen && (
              <div className="lg:col-span-4">
                <div className="bg-dark-elevated rounded-lg border border-dark-border h-full">
                  <div className="p-4 border-b border-dark-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Data Sources</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPanelOpen(false)}
                      className="text-gray-400 hover:text-white hidden lg:flex"
                    >
                      <PanelRightClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="p-4 h-full overflow-auto">
                    <DataSourcePanel onDataSourceChange={() => {}} />
                  </div>
                </div>
              </div>
            )}

            {/* Show Panel Button when closed */}
            {!isPanelOpen && (
              <Button
                onClick={() => setIsPanelOpen(true)}
                className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-neon-blue hover:bg-neon-blue/80 z-50 hidden lg:flex"
                size="sm"
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;