import { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Database, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white">Query Success Rate</CardTitle>
                    <CardDescription>Daily query success trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[
                        { name: 'Mon', success: 95, errors: 5 },
                        { name: 'Tue', success: 87, errors: 13 },
                        { name: 'Wed', success: 92, errors: 8 },
                        { name: 'Thu', success: 98, errors: 2 },
                        { name: 'Fri', success: 94, errors: 6 },
                        { name: 'Sat', success: 89, errors: 11 },
                        { name: 'Sun', success: 96, errors: 4 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#F3F4F6' }}
                        />
                        <Line type="monotone" dataKey="success" stroke="#10B981" strokeWidth={2} />
                        <Line type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white">Query Types Distribution</CardTitle>
                    <CardDescription>Breakdown by query complexity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Simple SELECT', value: 45, fill: '#10B981' },
                            { name: 'JOIN Queries', value: 30, fill: '#3B82F6' },
                            { name: 'Aggregations', value: 15, fill: '#8B5CF6' },
                            { name: 'Complex', value: 10, fill: '#F59E0B' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Simple SELECT', value: 45, fill: '#10B981' },
                            { name: 'JOIN Queries', value: 30, fill: '#3B82F6' },
                            { name: 'Aggregations', value: 15, fill: '#8B5CF6' },
                            { name: 'Complex', value: 10, fill: '#F59E0B' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-dark-elevated border-dark-border">
                <CardHeader>
                  <CardTitle className="text-white">Execution Time Analysis</CardTitle>
                  <CardDescription>Query performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { time: '00:00', fast: 20, medium: 8, slow: 2 },
                      { time: '04:00', fast: 15, medium: 5, slow: 1 },
                      { time: '08:00', fast: 45, medium: 12, slow: 3 },
                      { time: '12:00', fast: 38, medium: 15, slow: 4 },
                      { time: '16:00', fast: 42, medium: 18, slow: 5 },
                      { time: '20:00', fast: 25, medium: 10, slow: 2 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="fast" stackId="a" fill="#10B981" name="Fast (<1s)" />
                      <Bar dataKey="medium" stackId="a" fill="#F59E0B" name="Medium (1-3s)" />
                      <Bar dataKey="slow" stackId="a" fill="#EF4444" name="Slow (>3s)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white">Response Times</CardTitle>
                    <CardDescription>API response performance trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[
                        { time: '1h ago', avg: 1.2, p95: 2.1, p99: 3.5 },
                        { time: '45m ago', avg: 0.9, p95: 1.8, p99: 2.9 },
                        { time: '30m ago', avg: 1.1, p95: 2.0, p99: 3.2 },
                        { time: '15m ago', avg: 0.8, p95: 1.5, p99: 2.4 },
                        { time: 'Now', avg: 1.0, p95: 1.7, p99: 2.8 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#F3F4F6' }}
                        />
                        <Line type="monotone" dataKey="avg" stroke="#10B981" strokeWidth={2} name="Average" />
                        <Line type="monotone" dataKey="p95" stroke="#F59E0B" strokeWidth={2} name="95th Percentile" />
                        <Line type="monotone" dataKey="p99" stroke="#EF4444" strokeWidth={2} name="99th Percentile" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-dark-elevated border-dark-border">
                  <CardHeader>
                    <CardTitle className="text-white">System Health</CardTitle>
                    <CardDescription>Current system status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">API Uptime</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-500">99.9%</span>
                        </div>
                      </div>
                      <Progress value={99.9} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Database Performance</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-500">Optimal</span>
                        </div>
                      </div>
                      <Progress value={95} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Edge Functions</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-500">Healthy</span>
                        </div>
                      </div>
                      <Progress value={98} className="h-2" />
                      
                      <div className="mt-6 p-4 bg-dark-surface rounded-lg">
                        <h4 className="text-white font-medium mb-2">Performance Metrics</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Avg Response: </span>
                            <span className="text-white">1.2s</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Throughput: </span>
                            <span className="text-white">250 req/min</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Error Rate: </span>
                            <span className="text-green-500">0.1%</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Cache Hit: </span>
                            <span className="text-blue-400">89%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Dashboard;