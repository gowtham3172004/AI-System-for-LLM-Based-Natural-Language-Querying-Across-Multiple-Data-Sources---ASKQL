
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryHistoryProvider } from "./contexts/QueryHistoryContext";
import { AppStateProvider } from "./contexts/AppStateContext";
import { UserQueryHistoryProvider } from "./contexts/UserQueryHistoryContext";
import { ChatSessionProvider } from "./contexts/ChatSessionContext";
import Index from "./pages/Index";
import Chatbot from "./pages/Chatbot";
import Dashboard from "./pages/Dashboard";
import QueryHistory from "./pages/QueryHistory";
import Help from "./pages/Help";
import About from "./pages/About";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppStateProvider>
      <UserQueryHistoryProvider>
        <ChatSessionProvider>
          <QueryHistoryProvider>
            <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/chatbot" element={<Chatbot />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<QueryHistory />} />
              <Route path="/help" element={<Help />} />
              <Route path="/about" element={<About />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </QueryHistoryProvider>
        </ChatSessionProvider>
      </UserQueryHistoryProvider>
    </AppStateProvider>
  </QueryClientProvider>
);

export default App;
