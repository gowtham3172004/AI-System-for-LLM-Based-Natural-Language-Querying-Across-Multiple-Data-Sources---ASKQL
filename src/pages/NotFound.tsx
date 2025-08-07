import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4 pt-24">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gradient-to-r from-accent-blue to-accent-violet rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-6xl sm:text-8xl font-bold mb-4 bg-gradient-to-r from-accent-blue to-accent-violet bg-clip-text text-transparent">
            404
          </h1>
          
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Page Not Found
          </h2>
          
          <p className="text-gray-400 text-lg mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <Button asChild className="bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue">
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Return to Home
            </Link>
          </Button>
        </div>
      </div>

      {/* Copyright Section */}
      <footer className="mt-16 py-8 border-t border-light-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              © 2024 AskQL. All rights reserved. | 
              <span className="text-accent-blue"> Powered by AI-driven SQL analytics</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NotFound;
