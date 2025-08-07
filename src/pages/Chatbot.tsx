import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import Navigation from '@/components/Navigation';
import DataSourcePanel from '@/components/DataSourcePanel';

const Chatbot = () => {
  const [activeDataSource, setActiveDataSource] = useState(null);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AI SQL Assistant</h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Ask questions in natural language and get instant SQL queries. Connect your data sources and start analyzing your data with AI-powered insights.
          </p>
        </div>

        {/* Data Sources Section */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Data Sources</h2>
            <p className="text-gray-600">Upload files or connect databases to start querying your data</p>
          </div>
          {/* Buttons in black background */}
          <div className="flex justify-center items-center gap-4 mb-6">
            <DataSourcePanel onDataSourceChange={setActiveDataSource} />
          </div>
        </div>

        {/* Chat Interface */}
        <div className="mt-8">
          <ChatInterface activeDataSource={activeDataSource} />
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

export default Chatbot; 