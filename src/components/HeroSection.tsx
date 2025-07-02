
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Upload, MessageSquare, BarChart3, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isDevelopmentMode } from '@/lib/supabase';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-6xl mx-auto text-center">
        {/* Development Mode Notice */}
        {isDevelopmentMode && (
          <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
              <span className="text-yellow-400 font-semibold">Development Mode</span>
            </div>
            <p className="text-yellow-200 text-sm">
              Connect to Supabase for full functionality. Currently running with demo data.
            </p>
          </div>
        )}

        {/* Hero Content */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-neon-blue to-neon-cyan rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Query Your Data with
            <span className="bg-gradient-to-r from-neon-blue to-neon-cyan bg-clip-text text-transparent block">
              Natural Language
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Transform your questions into powerful SQL queries instantly. Upload your CSV files and start exploring your data like never before.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue text-white font-semibold px-8 py-4 text-lg"
          >
            Get Started Free
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="bg-dark-surface border-dark-border">
            <CardContent className="p-6 text-center">
              <Upload className="w-12 h-12 text-neon-blue mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">Easy Upload</h3>
              <p className="text-gray-400">
                Simply drag and drop your CSV files. We'll automatically detect the schema and structure.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-dark-surface border-dark-border">
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-12 h-12 text-neon-cyan mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">Natural Queries</h3>
              <p className="text-gray-400">
                Ask questions in plain English. Our AI converts them to perfect SQL queries automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-dark-surface border-dark-border">
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-12 h-12 text-neon-blue mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">Instant Results</h3>
              <p className="text-gray-400">
                Get beautifully formatted results in seconds. Export, analyze, and share your insights.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Example Queries */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Try These Example Queries</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Show me all records where sales > 1000",
              "Find the top 10 customers by revenue", 
              "What's the average order value by month?",
              "List all products with low inventory"
            ].map((query, index) => (
              <div key={index} className="bg-dark-elevated p-4 rounded-lg border border-dark-border">
                <p className="text-gray-300 italic">"{query}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
