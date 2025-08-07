
import { Sparkles, Database, Upload } from 'lucide-react';

const HeroSection = () => {

  return (
    <section className="relative py-8 sm:py-12 md:py-20 px-4 sm:px-6 lg:px-8 text-center overflow-hidden bg-white">
      {/* Removed background gradient and animated overlays */}
      <div className="relative max-w-4xl mx-auto">
        <div className="flex items-center justify-center mb-4 sm:mb-6">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-accent-blue mr-2 sm:mr-3 animate-pulse" />
          <span className="text-accent-blue font-medium text-xs sm:text-sm md:text-base">AI-Powered Data Querying</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 text-gray-900 leading-tight transform hover:scale-105 transition-all duration-300 px-2">
          Ask Anything About Your Data
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-6 sm:mb-8 md:mb-12 max-w-3xl mx-auto leading-relaxed px-2 sm:px-4">
          Upload your file, then ask questions in plain English. 
          AskQL will generate SQL queries and deliver instant insights.
        </p>
        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-4">
          <div className="bg-light-surface rounded-xl p-4 sm:p-6 border border-light-border hover:border-accent-blue/50 transition-all group transform hover:scale-105 hover:animate-float shadow-lg hover:shadow-2xl">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-accent-blue to-accent-cyan rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:animate-pulse">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2">Natural Language</h3>
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Ask questions like "Show me total sales by region" and get instant SQL queries</p>
          </div>
          <div className="bg-light-surface rounded-xl p-4 sm:p-6 border border-light-border hover:border-accent-violet/50 transition-all group transform hover:scale-105 hover:animate-float shadow-lg hover:shadow-2xl">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-accent-violet to-accent-pink rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:animate-pulse">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2">Multiple Sources</h3>
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Connect to databases or upload CSV/Excel files for instant data analysis</p>
          </div>
          <div className="bg-light-surface rounded-xl p-4 sm:p-6 border border-light-border hover:border-accent-green/50 transition-all group transform hover:scale-105 hover:animate-float shadow-lg hover:shadow-2xl sm:col-span-2 lg:col-span-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-accent-green to-accent-cyan rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:animate-pulse">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2">Instant Results</h3>
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Get formatted results with export options and query history tracking</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
