import { ChevronDown, ChevronUp, Database, FileText, Shield, HelpCircle, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';

const Help = () => {
  const [openSections, setOpenSections] = useState<string[]>(['what-is-askql']);

  const handleContactSupport = () => {
    toast({
      title: "Contact Support",
      description: "Support feature coming soon! For now, please reach out to us at support@askql.com",
      duration: 5000,
    });
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const Section = ({ id, title, icon: Icon, children }: any) => {
    const isOpen = openSections.includes(id);
    
    return (
      <div className="bg-light-surface rounded-2xl border border-light-border mb-6 overflow-hidden">
        <Button
          variant="ghost"
          onClick={() => toggleSection(id)}
          className="w-full p-6 flex items-center justify-between text-left hover:bg-light-elevated rounded-none"
        >
          <div className="flex items-center space-x-3">
            <Icon className="w-6 h-6 text-accent-blue" />
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </Button>
        
        {isOpen && (
          <div className="px-6 pb-6 text-gray-300 leading-relaxed animate-fade-in">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-12 pt-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Support</h1>
          <p className="text-gray-600 text-lg">Everything you need to know about using AskQL</p>
        </div>

        <Section id="what-is-askql" title="What is AskQL?" icon={Star}>
          <p className="mb-4 text-black">
            AskQL is an AI-powered assistant that helps users interact with structured data (databases, CSV, Excel files) using plain English — no coding required. 
          </p>
          <p className="mb-4 text-black">
            The system uses Google Gemini AI to convert your natural language questions into SQL queries, then runs them on your data and shows you the results in an easy-to-understand format.
          </p>
          <p className="text-black">
            Whether you're a data analyst, business user, student, or researcher, AskQL makes it simple to get insights from your data without needing to learn SQL syntax.
          </p>
        </Section>

        <Section id="how-to-use" title="How to Use AskQL" icon={HelpCircle}>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-accent-blue rounded-full flex items-center justify-center text-gray-900 font-bold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Connect Your Data</h4>
                <p className="text-black">Upload your CSV or Excel file using the "Upload Data File" button. Your data stays private and secure.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-accent-cyan rounded-full flex items-center justify-center text-gray-900 font-bold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Ask Your Question</h4>
                <p className="text-black">Type your question in natural language, like "Show all students who scored above 90" or "What's the average sales by region?"</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-accent-green rounded-full flex items-center justify-center text-gray-900 font-bold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Get Your Answer</h4>
                <p className="text-black">AskQL analyzes your question, generates the appropriate SQL query, runs it on your data, and presents the results in a clear format.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-accent-violet rounded-full flex items-center justify-center text-gray-900 font-bold text-sm">4</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Review & Download</h4>
                <p className="text-black">View the generated SQL query, copy it for future use, and export your results if needed.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section id="supported-data" title="Supported Data Sources" icon={Database}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-light-elevated rounded-lg p-4">
              <FileText className="w-8 h-8 text-accent-blue mb-3" />
              <h4 className="font-semibold text-gray-900 mb-2">File Formats</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• CSV files (.csv)</li>
                <li>• Excel files (.xlsx, .xls)</li>
                <li>• Tab-separated files (.tsv)</li>
              </ul>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4">
              <Database className="w-8 h-8 text-accent-cyan mb-3" />
              <h4 className="font-semibold text-gray-900 mb-2">Database Support</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• PostgreSQL databases</li>
                <li>• MySQL databases</li>
                <li>• SQLite databases</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="what-can-i-ask" title="What Can I Ask?" icon={HelpCircle}>
          <p className="mb-4 text-black">AskQL can handle a wide variety of questions about your data. Here are some examples:</p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-light-elevated rounded-lg p-4">
              <h4 className="font-semibold text-accent-blue mb-2">Data Filtering</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• "Show all products with price over $100"</li>
                <li>• "List employees hired after 2020"</li>
                <li>• "Find customers from New York"</li>
              </ul>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4">
              <h4 className="font-semibold text-accent-cyan mb-2">Aggregations</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• "What's the total sales by region?"</li>
                <li>• "Show average marks per subject"</li>
                <li>• "Count how many orders per month"</li>
              </ul>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4">
              <h4 className="font-semibold text-accent-green mb-2">Sorting & Ranking</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• "Top 10 selling products"</li>
                <li>• "Students with highest grades"</li>
                <li>• "Best performing regions"</li>
              </ul>
            </div>
            
            <div className="bg-light-elevated rounded-lg p-4">
              <h4 className="font-semibold text-accent-violet mb-2">Comparisons</h4>
              <ul className="text-sm space-y-1 text-black">
                <li>• "Compare sales this year vs last year"</li>
                <li>• "Which department has more employees?"</li>
                <li>• "Show growth rate by quarter"</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="privacy-security" title="Data Privacy & Security" icon={Shield}>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 text-accent-green mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Your Data Stays Private</h4>
                <p className="text-black">All uploaded files are private to your account and are never shared with other users or third parties.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Database className="w-6 h-6 text-accent-blue mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Secure Storage</h4>
                <p className="text-black">Database credentials and uploaded files are securely encrypted and stored using industry-standard security practices.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Star className="w-6 h-6 text-accent-cyan mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">AI Processing</h4>
                <p className="text-black">SQL generation is powered by Google Gemini AI through a secure backend that doesn't store or log your data content.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle}>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Can I see the SQL before it runs?</h4>
              <p className="text-black">Yes! When you ask for a query specifically (like "show me the SQL to..."), AskQL will display the generated SQL query for you to review before execution.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Can I download the results?</h4>
              <p className="text-black">Currently, you can copy the SQL queries and results from the interface. We're working on adding direct export functionality.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What happens to my uploaded files?</h4>
              <p className="text-black">Your uploaded files are processed and stored securely for the duration of your session. You can remove them at any time using the delete button next to each data source.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Can I connect multiple datasets?</h4>
              <p className="text-black">Yes! You can upload multiple files and switch between them. Each file becomes a separate data source that you can query independently.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">How long is my data stored?</h4>
              <p className="text-black">Data is stored for the duration of your session. When you close the browser or log out, your uploaded files are automatically removed from our servers.</p>
            </div>
          </div>
        </Section>

        <div className="text-center mt-12 p-6 sm:p-8 bg-light-surface rounded-2xl border border-light-border">
          <Users className="w-10 h-10 sm:w-12 sm:h-12 text-accent-blue mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Need More Help?</h3>
          <p className="text-gray-600 mb-4 text-sm sm:text-base">
            Can't find what you're looking for? We're here to help you get the most out of AskQL.
          </p>
          <Button 
            onClick={handleContactSupport}
            className="bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue"
          >
            Contact Support
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

export default Help;