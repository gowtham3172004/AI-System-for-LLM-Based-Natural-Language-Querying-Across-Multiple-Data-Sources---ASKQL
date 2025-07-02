
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isDevelopmentMode } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDevelopmentMode) {
      // Mock user for development
      setUser({
        id: 'dev-user',
        email: 'demo@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {}
      } as User);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isDevelopmentMode) {
      toast({
        title: "Development Mode",
        description: "Connect to Supabase for real authentication",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }

    toast({
      title: "Welcome back!",
      description: "You have successfully signed in.",
    });
  };

  const signUp = async (email: string, password: string) => {
    if (isDevelopmentMode) {
      toast({
        title: "Development Mode",  
        description: "Connect to Supabase for real authentication",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }

    toast({
      title: "Account Created!",
      description: "Please check your email to verify your account.",
    });
  };

  const signOut = async () => {
    if (isDevelopmentMode) {
      setUser(null);
      toast({
        title: "Signed Out",
        description: "You have been signed out from development mode.",
      });
      return;
    }

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }

    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
