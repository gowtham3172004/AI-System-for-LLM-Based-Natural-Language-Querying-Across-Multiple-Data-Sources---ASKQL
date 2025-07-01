
import HeroSection from '@/components/HeroSection';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      {user ? (
        <ProtectedRoute>
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome back, {user.email?.split('@')[0]}!
              </h1>
              <p className="text-gray-400">Ready to explore your data?</p>
            </div>
            <ChatInterface />
          </div>
        </ProtectedRoute>
      ) : (
        <HeroSection />
      )}
    </div>
  );
};

export default Index;
