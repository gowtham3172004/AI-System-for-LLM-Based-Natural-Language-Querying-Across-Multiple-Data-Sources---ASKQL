
import { Sparkles, Database, Upload } from 'lucide-react';

const HeroSection = () => {

  return (
    <section className="relative py-20 px-4 text-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/10 via-transparent to-neon-violet/10" />
      
      {/* Animated background elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-neon-violet/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative max-w-4xl mx-auto">
        <div className="flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-neon-blue mr-3 animate-pulse" />
          <span className="text-neon-blue font-medium">AI-Powered Data Querying</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-neon-blue to-neon-violet bg-clip-text text-transparent leading-tight">
          Ask Anything About Your Data
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          Upload your file, then ask questions in plain English. 
          AskQL will generate SQL queries and deliver instant insights.
        </p>
        
        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-dark-surface/50 backdrop-blur rounded-xl p-6 border border-dark-border hover:border-neon-blue/50 transition-all group">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-blue to-neon-cyan rounded-lg flex items-center justify-center mb-4 group-hover:animate-pulse">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Natural Language</h3>
            <p className="text-gray-400">Ask questions like "Show me total sales by region" and get instant SQL queries</p>
          </div>
          
          <div className="bg-dark-surface/50 backdrop-blur rounded-xl p-6 border border-dark-border hover:border-neon-violet/50 transition-all group">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-violet to-neon-pink rounded-lg flex items-center justify-center mb-4 group-hover:animate-pulse">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Multiple Sources</h3>
            <p className="text-gray-400">Connect to databases or upload CSV/Excel files for instant data analysis</p>
          </div>
          
          <div className="bg-dark-surface/50 backdrop-blur rounded-xl p-6 border border-dark-border hover:border-neon-green/50 transition-all group">
            <div className="w-12 h-12 bg-gradient-to-r from-neon-green to-neon-cyan rounded-lg flex items-center justify-center mb-4 group-hover:animate-pulse">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Instant Results</h3>
            <p className="text-gray-400">Get formatted results with export options and query history tracking</p>
          </div>
        </div>
      </div>
      
    </section>
  );
};

export default HeroSection;
