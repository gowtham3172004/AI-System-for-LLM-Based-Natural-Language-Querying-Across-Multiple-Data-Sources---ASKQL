
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, BarChart3, MessageSquare, TrendingUp, Users, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HeroSection from '@/components/HeroSection';
import Navigation from '@/components/Navigation';

const Index = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "AI-Powered Chat",
      description: "Ask questions in natural language and get instant SQL queries with our intelligent AI assistant.",
      color: "text-accent-blue"
    },
    {
      icon: BarChart3,
      title: "Analytical Dashboard",
      description: "Visualize your data with beautiful charts and get actionable insights from your datasets.",
      color: "text-accent-green"
    },
    {
      icon: Database,
      title: "Multiple Data Sources",
      description: "Connect to databases or upload CSV/Excel files to analyze any type of data.",
      color: "text-accent-violet"
    },
    {
      icon: TrendingUp,
      title: "Real-time Analytics",
      description: "Get real-time insights and track your data performance with live dashboards.",
      color: "text-accent-cyan"
    },
    {
      icon: Users,
      title: "Collaborative",
      description: "Share queries and insights with your team for better collaboration.",
      color: "text-accent-pink"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data stays secure with enterprise-grade encryption and privacy controls.",
      color: "text-accent-yellow"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-24">
        <HeroSection />
      </div>
      
      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Powerful Features</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Everything you need to analyze your data with AI-powered insights
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white border-light-border hover:border-accent-blue/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent-blue/20">
              <CardHeader>
                <div className={`w-12 h-12 bg-gradient-to-r from-accent-blue/20 to-accent-cyan/20 rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-gray-900">{feature.title}</CardTitle>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-light-surface rounded-2xl p-8 border border-accent-blue/20">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Start analyzing your data with our AI-powered SQL assistant. Upload your files or connect your database to begin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue">
                <Link to="/chatbot">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Start Chatting
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-accent-violet text-accent-violet hover:bg-accent-violet hover:text-white">
                <Link to="/dashboard">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  View Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
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

export default Index;
