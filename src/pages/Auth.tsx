import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You have been successfully logged in.",
        });
        
        navigate('/');
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        if (error) throw error;

        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message?.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Try logging in instead.';
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = 'Password should be at least 6 characters long.';
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="flex items-center justify-center min-h-screen px-4 py-12 pt-16 sm:pt-20 md:pt-24">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent-blue to-accent-violet bg-clip-text text-transparent mb-2">
              {isLogin ? 'Welcome Back' : 'Join AskQL'}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              {isLogin 
                ? 'Sign in to your account to continue' 
                : 'Create your account to get started'
              }
            </p>
          </div>

          {/* Auth Card - Light Theme */}
          <Card className="bg-white border border-gray-200 shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl sm:text-2xl text-gray-900">
                {isLogin ? 'Sign In' : 'Sign Up'}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {isLogin 
                  ? 'Enter your email and password to sign in' 
                  : 'Enter your details to create your account'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-900 font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-accent-blue focus:ring-accent-blue/20"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-900 font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-accent-blue focus:ring-accent-blue/20"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-accent-blue transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue text-white transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    </div>
                  )}
                </Button>
              </form>

              {/* Toggle Form */}
              <div className="mt-6 text-center">
                <p className="text-gray-600 text-sm sm:text-base">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  {' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-accent-blue hover:text-accent-cyan transition-colors font-medium"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
            <p>By signing up, you agree to our Terms of Service and Privacy Policy.</p>
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <footer className="mt-8 sm:mt-12 md:mt-16 py-6 sm:py-8 border-t border-light-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              © 2024 AskQL. All rights reserved. | 
              <span className="text-accent-blue"> Powered by AI-driven SQL analytics</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Auth;