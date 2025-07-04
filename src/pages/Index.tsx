
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
    </div>
  );
};

export default Index;
