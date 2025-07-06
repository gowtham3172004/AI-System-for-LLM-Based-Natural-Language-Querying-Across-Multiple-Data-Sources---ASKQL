
import { useState } from 'react';
import HeroSection from '@/components/HeroSection';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';
import DataSourcePanel from '@/components/DataSourcePanel';

const Index = () => {
  const [activeDataSource, setActiveDataSource] = useState(null);

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      <HeroSection />
      <div className="max-w-6xl mx-auto px-4">
        <DataSourcePanel onDataSourceChange={setActiveDataSource} />
      </div>
      <ChatInterface activeDataSource={activeDataSource} />
      
      {/* Bottom gradient background matching top */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-neon-violet/10 via-transparent to-neon-blue/10" />
        <div className="absolute bottom-0 left-10 w-32 h-32 bg-neon-pink/20 rounded-full blur-3xl animate-pulse delay-500" />
        <div className="absolute bottom-0 right-10 w-40 h-40 bg-neon-cyan/20 rounded-full blur-3xl animate-pulse delay-1500" />
        <div className="h-40"></div>
      </div>
    </div>
  );
};

export default Index;
