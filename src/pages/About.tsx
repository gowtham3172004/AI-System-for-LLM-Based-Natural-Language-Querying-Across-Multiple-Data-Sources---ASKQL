import { Target, Settings, Users, Lock, Heart, Code, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-12 pt-24">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">About AskSQL</h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
            Bridging the gap between people and data through the power of AI. 
            AskSQL makes data analysis accessible to everyone, regardless of technical background.
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-8 mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <Target className="w-8 h-8 text-accent-blue" />
            <h2 className="text-3xl font-bold text-gray-900">Our Mission</h2>
          </div>
          <p className="text-gray-600 text-lg leading-relaxed">
            At AskSQL, we believe that everyone should have the power to extract insights from their data, 
            regardless of their technical expertise. We're building a world where asking questions about 
            your data is as simple as having a conversation. Our mission is to democratize data analysis 
            and make it accessible to students, researchers, business users, and anyone who works with structured data.
          </p>
        </div>

        {/* How It Works Section */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-8 mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <Settings className="w-8 h-8 text-accent-cyan" />
            <h2 className="text-3xl font-bold text-gray-900">How AskSQL Works</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-accent-blue rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">1</div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold mb-2">AI-Powered Understanding</h3>
                  <p className="text-gray-600">Google Gemini AI analyzes your natural language questions to understand exactly what you're looking for.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-accent-cyan rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">2</div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold mb-2">Smart SQL Generation</h3>
                  <p className="text-gray-600">Our AI converts your questions into optimized SQL queries that work with your specific data structure.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-accent-green rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">3</div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold mb-2">Secure Execution</h3>
                  <p className="text-gray-600">Queries are executed safely on your data using Supabase's secure infrastructure.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-accent-violet rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">4</div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold mb-2">Clear Results</h3>
                  <p className="text-gray-600">Get your answers in an easy-to-understand format with the option to see the underlying SQL.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Who Is It For Section */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-8 mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <Users className="w-8 h-8 text-accent-green" />
            <h2 className="text-3xl font-bold text-gray-900">Who Is AskSQL For?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-light-elevated rounded-lg p-6">
              <h3 className="text-gray-900 font-semibold mb-3 flex items-center">
                <Users className="w-5 h-5 text-accent-blue mr-2" />
                Business Users
              </h3>
              <p className="text-gray-600">
                Non-technical users who need to extract insights from their data without learning SQL. 
                Perfect for managers, analysts, and decision-makers.
              </p>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-6">
              <h3 className="text-gray-900 font-semibold mb-3 flex items-center">
                <Code className="w-5 h-5 text-accent-cyan mr-2" />
                Students & Researchers
              </h3>
              <p className="text-gray-600">
                Students and researchers working with structured data who want to focus on analysis 
                rather than query syntax.
              </p>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-6">
              <h3 className="text-gray-900 font-semibold mb-3 flex items-center">
                <Database className="w-5 h-5 text-accent-green mr-2" />
                Data Analysts
              </h3>
              <p className="text-gray-600">
                Analysts who want to move fast and validate ideas quickly without writing complex queries from scratch.
              </p>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-6">
              <h3 className="text-gray-900 font-semibold mb-3 flex items-center">
                <Zap className="w-5 h-5 text-accent-violet mr-2" />
                Developers
              </h3>
              <p className="text-gray-600">
                Developers building quick data workflows or prototyping data-driven applications.
              </p>
            </div>
          </div>
        </div>

        {/* Why Choose AskSQL Section */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-8 mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <Lock className="w-8 h-8 text-accent-violet" />
            <h2 className="text-3xl font-bold text-gray-900">Why Choose AskSQL?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Zap className="w-6 h-6 text-accent-blue mt-1" />
                <div>
                  <h3 className="text-gray-900 font-semibold mb-1">Lightning Fast</h3>
                  <p className="text-gray-600">Get answers to your data questions in seconds, not hours.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Target className="w-6 h-6 text-accent-cyan mt-1" />
                <div>
                  <h3 className="text-gray-900 font-semibold mb-1">Natural Language</h3>
                  <p className="text-gray-600">Ask questions in plain English - no SQL knowledge required.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Database className="w-6 h-6 text-accent-green mt-1" />
                <div>
                  <h3 className="text-gray-900 font-semibold mb-1">Multiple Data Sources</h3>
                  <p className="text-gray-600">Works with files (CSV, Excel) and databases seamlessly.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Lock className="w-6 h-6 text-accent-violet mt-1" />
                <div>
                  <h3 className="text-gray-900 font-semibold mb-1">Secure & Private</h3>
                  <p className="text-gray-600">Your data stays private and is processed securely.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Built With Love Section */}
        <div className="bg-light-surface rounded-2xl border border-light-border p-8 mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <Heart className="w-8 h-8 text-red-400" />
            <h2 className="text-3xl font-bold text-gray-900">Built with Love (and AI)</h2>
          </div>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            AskSQL is built using cutting-edge technologies and modern development practices to ensure 
            reliability, security, and performance.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-light-elevated rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-accent-blue to-accent-cyan rounded-lg mx-auto mb-3 flex items-center justify-center">
                <Code className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-gray-900 font-semibold mb-2">Google Gemini</h3>
              <p className="text-gray-600 text-sm">Advanced AI for natural language understanding and SQL generation</p>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-accent-green to-accent-cyan rounded-lg mx-auto mb-3 flex items-center justify-center">
                <Database className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-gray-900 font-semibold mb-2">Supabase</h3>
              <p className="text-gray-600 text-sm">Secure backend, authentication, and database management</p>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-accent-violet to-accent-pink rounded-lg mx-auto mb-3 flex items-center justify-center">
                <Zap className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-gray-900 font-semibold mb-2">Modern Stack</h3>
              <p className="text-gray-600 text-sm">React, TypeScript, and Tailwind CSS for a smooth user experience</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-accent-blue/20 to-accent-cyan/20 rounded-2xl border border-accent-blue/30 p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Ready to Start Exploring Your Data?</h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-8">
            Join thousands of users who are already getting insights from their data with AskSQL.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/chatbot')}
            className="bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4"
          >
            Start Asking Questions
          </Button>
        </div>
      </div>

      {/* Copyright Section */}
      <footer className="mt-16 py-8 border-t border-light-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              © 2024 AskQL. All rights reserved. | 
              <span className="text-accent-blue"> Powered by AI-driven SQL analytics</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;