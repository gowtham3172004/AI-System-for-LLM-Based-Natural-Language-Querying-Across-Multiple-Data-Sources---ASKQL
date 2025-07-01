
import HeroSection from '@/components/HeroSection';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';

const Index = () => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      <HeroSection />
      <ChatInterface />
    </div>
  );
};

export default Index;
