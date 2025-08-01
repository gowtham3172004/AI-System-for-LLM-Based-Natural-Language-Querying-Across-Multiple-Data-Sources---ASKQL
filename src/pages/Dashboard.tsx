import { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Database, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { useUserQueryHistory } from '@/contexts/UserQueryHistoryContext';
import { useChatSession } from '@/contexts/ChatSessionContext';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { queryHistory } = useUserQueryHistory();
  const { messages } = useChatSession();
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState({
    totalQueries: 0,
    successRate: 0,
    avgExecutionTime: 0,
    topDataSources: [],
    queryModes: {},
    recentActivity: []
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (queryHistory.length > 0) {
      const successfulQueries = queryHistory.filter(q => q.status === 'success');
      const totalExecutionTime = queryHistory.reduce((sum, q) => sum + (q.execution_time || 0), 0);
      
      const modeCount = queryHistory.reduce((acc, q) => {
        acc[q.mode || 'general'] = (acc[q.mode || 'general'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setAnalytics({
        totalQueries: queryHistory.length,
        successRate: queryHistory.length > 0 ? (successfulQueries.length / queryHistory.length) * 100 : 0,
        avgExecutionTime: queryHistory.length > 0 ? totalExecutionTime / queryHistory.length : 0,
        topDataSources: [], // This would be populated from actual data sources
        queryModes: modeCount,
        recentActivity: queryHistory.slice(-5).reverse()
      });
    }
  }, [queryHistory]);

  const StatCard = ({ title, value, icon: Icon, description, trend }: any) => (
    <Card className="bg-dark-elevated border-dark-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
        <Icon className="h-4 w-4 text-neon-blue" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        <p className="text-xs text-gray-400 mt-1">{description}</p>
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-blue to-neon-violet bg-clip-text text-transparent mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-400">
            Visualize insights from your connected data sources and query history
          </p>
        </div>

        {!user ? (
          <Card className="bg-dark-elevated border-dark-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Sign in Required</h3>
              <p className="text-gray-400 text-center mb-4">
                Please sign in to view your analytics dashboard and query insights.
              </p>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="bg-neon-blue hover:bg-neon-blue/80"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-dark-elevated border-dark-border">
              <TabsTrigger value="overview" className="data-[state=active]:bg-neon-blue data-[state=active]:text-white">
                Overview
              </TabsTrigger>
              <TabsTrigger value="queries" className="data-[state=active]:bg-neon-blue data-[state=active]:text-white">
                Query Analytics
              </TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-neon-blue data-[state=active]:text-white">
                Performance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Queries"
                  value={analytics.totalQueries}
                  icon={Database}
                  description="Lifetime queries executed"
                  trend="+12% from last week"
                />
                <StatCard
                  title="Success Rate"
                  value={`${analytics.successRate.toFixed(1)}%`}
                  icon={TrendingUp}
                  description="Query success rate"
                  trend="+2.5% improvement"
                />
                <StatCard
                  title="Avg Execution Time"
                  value={`${analytics.avgExecutionTime.toFixed(2)}s`}
                  icon={Activity}
                  description="Average query time"
                  trend="-0.3s faster"
                />
                <StatCard
                  title="Chat Messages"
                  value={messages.length}
                  icon={Users}
                  description="Total chat interactions"
                  trend="Active session"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <PieChart className="h-5 w-5 mr-2 text-neon-blue" />
                      Query Modes Distribution
                    </CardTitle>
                    <CardDescription>Breakdown of query types used</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analytics.queryModes).map(([mode, count]) => (
                        <div key={mode} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="capitalize">
                              {mode}
                            </Badge>
                            <span className="text-sm text-gray-400">{String(count)} queries</span>
                          </div>
                          <Progress 
                            value={(Number(count) / analytics.totalQueries) * 100} 
                            className="w-20"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-neon-blue" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Latest query executions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.recentActivity.length > 0 ? (
                        analytics.recentActivity.map((query: any, index: number) => (
                          <div key={query.id || index} className="flex items-center justify-between p-3 bg-dark-surface rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm text-white truncate">{query.question}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(query.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge 
                              variant={query.status === 'success' ? 'default' : 'destructive'}
                              className="ml-2"
                            >
                              {query.status}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-center py-4">No recent activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="queries" className="space-y-6">
              <Card className="bg-dark-elevated border-dark-border">
                <CardHeader>
                  <CardTitle className="text-white">Query Performance Insights</CardTitle>
                  <CardDescription>Detailed analysis of your SQL queries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Query performance charts will appear here</p>
                    <p className="text-sm text-gray-500 mt-2">Execute more queries to see detailed analytics</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <Card className="bg-dark-elevated border-dark-border">
                <CardHeader>
                  <CardTitle className="text-white">System Performance</CardTitle>
                  <CardDescription>Monitor response times and system health</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Performance metrics will appear here</p>
                    <p className="text-sm text-gray-500 mt-2">Performance data is collected over time</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Dashboard;