
import { Button } from '@/components/ui/button';
import { Database, Upload, MessageSquare, Sparkles } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Main Hero Content */}
        <div className="mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-neon-blue/20 to-neon-cyan/20 rounded-full border border-neon-blue/30 mb-8">
            <Sparkles className="w-4 h-4 text-neon-blue mr-2" />
            <span className="text-neon-blue text-sm font-medium">AI-Powered Query Assistant</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent leading-tight">
            Query Your Data with
            <span className="block bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-violet bg-clip-text text-transparent">
              Natural Language
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Upload your data, ask questions in plain English, and get instant SQL queries and results. 
            No technical expertise required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue text-white px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => window.location.href = '/auth'}
            >
              Get Started Free
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-neon-violet text-neon-violet hover:bg-neon-violet hover:text-white px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300"
            >
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-dark-surface/50 backdrop-blur-sm border border-dark-border rounded-2xl p-8 hover:bg-dark-surface/70 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-blue to-neon-cyan rounded-xl flex items-center justify-center mb-6">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Upload & Connect</h3>
            <p className="text-gray-400">
              Easily upload CSV files or connect to your existing databases. We'll automatically detect your data structure.
            </p>
          </div>

          <div className="bg-dark-surface/50 backdrop-blur-sm border border-dark-border rounded-2xl p-8 hover:bg-dark-surface/70 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-cyan to-neon-violet rounded-xl flex items-center justify-center mb-6">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Ask Questions</h3>
            <p className="text-gray-400">
              Type your questions in plain English. Our AI understands your intent and generates the perfect SQL query.
            </p>
          </div>

          <div className="bg-dark-surface/50 backdrop-blur-sm border border-dark-border rounded-2xl p-8 hover:bg-dark-surface/70 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-violet to-neon-pink rounded-xl flex items-center justify-center mb-6">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Get Results</h3>
            <p className="text-gray-400">
              See your data visualized instantly. Export results, copy SQL queries, and build upon your insights.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
