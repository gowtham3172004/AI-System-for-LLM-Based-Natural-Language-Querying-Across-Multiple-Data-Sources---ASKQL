
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Database, LogOut, History, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-neon-blue to-neon-cyan rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">QueryWhiz</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/history')}
                  className="text-gray-300 hover:text-white hover:bg-dark-surface"
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{user.email?.split('@')[0]}</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="text-gray-300 hover:text-white hover:bg-dark-surface"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="text-gray-300 hover:text-white"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue text-white px-6 py-2 rounded-lg"
                >
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-dark-surface border-t border-dark-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {user ? (
                <>
                  <div className="px-3 py-2 text-gray-300 text-sm">
                    Welcome, {user.email?.split('@')[0]}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigate('/history');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left text-gray-300 hover:text-white justify-start"
                  >
                    <History className="w-4 h-4 mr-2" />
                    History
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="w-full text-left text-gray-300 hover:text-white justify-start"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigate('/auth');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left text-gray-300 hover:text-white justify-start"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => {
                      navigate('/auth');
                      setIsMenuOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue text-white mt-2"
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
