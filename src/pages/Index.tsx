import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, BarChart3, Database, Sparkles, ArrowRight } from 'lucide-react';

const Index = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "AI-Powered Chatbot",
      description: "Ask questions in natural language and get SQL queries instantly",
      link: "/chatbot",
      color: "neon-blue"
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Visualize insights from your connected data sources",
      link: "/dashboard",
      color: "neon-violet"
    },
    {
      icon: Database,
      title: "Query History",
      description: "View and manage your past queries and results",
      link: "/history",
      color: "neon-green"
    }
  ];

  return (
    <div className="min-h-screen bg-dark-bg pt-20">
      <Navigation />
      <HeroSection />
      
      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Explore AskQL Features
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Discover powerful tools to analyze your data, create visualizations, and streamline your workflow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-dark-elevated border-dark-border hover:border-neon-blue/50 transition-all duration-300 group">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-${feature.color}/10 flex items-center justify-center mb-4 group-hover:bg-${feature.color}/20 transition-colors`}>
                  <feature.icon className={`h-6 w-6 text-${feature.color}`} />
                </div>
                <CardTitle className="text-white group-hover:text-neon-blue transition-colors">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={feature.link}>
                  <Button 
                    className="w-full bg-transparent border border-dark-border hover:border-neon-blue hover:bg-neon-blue/10 text-white"
                    variant="outline"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="container mx-auto px-4 py-16 border-t border-dark-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-neon-blue mr-3" />
            <h2 className="text-3xl font-bold text-white">Ready to Get Started?</h2>
          </div>
          <p className="text-gray-400 mb-8 text-lg">
            Connect your data sources and start asking questions in natural language
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/chatbot">
              <Button size="lg" className="bg-neon-blue hover:bg-neon-blue/80 text-white px-8">
                Start Chatting
                <MessageSquare className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-neon-violet text-neon-violet hover:bg-neon-violet/10 px-8"
              >
                View Dashboard
                <BarChart3 className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <footer className="border-t border-dark-border bg-dark-surface/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-neon-blue to-neon-violet rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-neon-blue to-neon-violet bg-clip-text text-transparent">
                AskQL
              </span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">
                © 2024 AskQL. All rights reserved.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Built with ❤️ for data enthusiasts
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;