import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, Database, Activity, BarChart3, PieChart as PieChartIcon, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppState } from '@/contexts/AppStateContext';
import Navigation from '@/components/Navigation';

interface ChartData {
  name: string;
  value?: number;
  [key: string]: any;
}

const Dashboard = () => {
  const { dataSources, activeDataSource } = useAppState();
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pieData, setPieData] = useState<ChartData[]>([]);
  const [lineData, setLineData] = useState<ChartData[]>([]);
  const [areaData, setAreaData] = useState<ChartData[]>([]);
  const [connectedData, setConnectedData] = useState<any>(null);
  const [dataColumns, setDataColumns] = useState<string[]>([]);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([]);
  
  // Column filter states for different chart types
  const [barChartColumns, setBarChartColumns] = useState<{category: string, value: string}>({category: '', value: ''});
  const [pieChartColumn, setPieChartColumn] = useState<string>('');
  const [lineChartColumns, setLineChartColumns] = useState<{x: string, y: string}>({x: '', y: ''});
  const [areaChartColumns, setAreaChartColumns] = useState<{x: string, y: string, y2?: string}>({x: '', y: '', y2: ''});

  // Automatically use active data source from AppState
  useEffect(() => {
    if (activeDataSource && activeDataSource.data) {
      setSelectedDataSource(activeDataSource.name);
      analyzeAndGenerateVisualizations(activeDataSource.data);
    } else if (dataSources.length > 0) {
      // Fallback to first available data source if no active one
      const firstSource = dataSources[0];
      setSelectedDataSource(firstSource.name);
      if (firstSource.data) {
        analyzeAndGenerateVisualizations(firstSource.data);
      }
    }
  }, [activeDataSource, dataSources]);

  // Intelligent data analysis and visualization generation
  const analyzeAndGenerateVisualizations = (data: any[]) => {
    if (!data || data.length === 0) return;

    setConnectedData(data);
    const columns = Object.keys(data[0]);
              setDataColumns(columns);
              
    // Analyze column types intelligently
    const numeric: string[] = [];
    const categorical: string[] = [];
    
    columns.forEach(col => {
      const sampleValues = data.slice(0, Math.min(100, data.length)).map(row => row[col]);
      const numericValues = sampleValues.filter(val => typeof val === 'number' && !isNaN(val));
      
      if (numericValues.length > sampleValues.length * 0.7) {
        numeric.push(col);
      } else {
        categorical.push(col);
      }
    });

    setNumericColumns(numeric);
    setCategoricalColumns(categorical);

    // Set default column selections
    const defaultCategory = categorical[0] || columns[0];
    const defaultNumeric = numeric[0] || '__count__';
    const defaultSecondNumeric = numeric[1] || '__none__';
    
    setBarChartColumns({
      category: defaultCategory,
      value: defaultNumeric
    });
    setPieChartColumn(defaultCategory);
    setLineChartColumns({
      x: defaultCategory,
      y: numeric[0] || defaultCategory
    });
    setAreaChartColumns({
      x: defaultCategory,
      y: numeric[0] || defaultCategory,
      y2: defaultSecondNumeric
    });

    // Generate visualizations with default selections
    generateBarChart(data, defaultCategory, defaultNumeric);
    generatePieChart(data, defaultCategory);
    generateLineChart(data, defaultCategory, numeric[0] || defaultCategory);
    generateAreaChart(data, defaultCategory, numeric[0] || defaultCategory, defaultSecondNumeric);
  };

  const generateBarChart = (data: any[], categoryCol: string, valueCol: string) => {
    if (valueCol && valueCol !== '__count__' && categoryCol) {
      // Group by selected categorical column, sum selected numeric column
      const groupedData = groupByCategory(data, categoryCol, valueCol);
      setChartData(groupedData.slice(0, 15));
    } else if (categoryCol) {
      // Count occurrences of selected categorical column
      const counts = countOccurrences(data, categoryCol);
      setChartData(counts.slice(0, 10));
          } else {
            setChartData([]);
    }
  };

  const generatePieChart = (data: any[], column: string) => {
    if (column) {
      // Check if column is numeric or categorical
      const sampleValues = data.slice(0, 10).map(row => row[column]);
      const numericValues = sampleValues.filter(val => typeof val === 'number' && !isNaN(val));
      
      if (numericValues.length > sampleValues.length * 0.7) {
        // Numeric column - create ranges
        const values = data.map(row => row[column]).filter(val => typeof val === 'number');
        const ranges = createNumericRanges(values);
        setPieData(ranges);
      } else {
        // Categorical column - count occurrences
        const counts = countOccurrences(data, column);
        setPieData(counts.slice(0, 8));
      }
    } else {
      setPieData([]);
    }
  };

  const generateLineChart = (data: any[], xCol: string, yCol: string) => {
    if (xCol && yCol) {
      const lineData = data.slice(0, 20).map((row, index) => ({
        name: row[xCol] || `Point ${index + 1}`,
        trend: Number(row[yCol]) || 0
      }));
      setLineData(lineData);
    } else {
      setLineData([]);
    }
  };

  const generateAreaChart = (data: any[], xCol: string, yCol: string, y2Col?: string) => {
    if (xCol && yCol) {
      const areaData = data.slice(0, 20).map((row, index) => ({
        name: row[xCol] || `Period ${index + 1}`,
        total: Number(row[yCol]) || 0,
        secondary: (y2Col && y2Col !== '__none__') ? Number(row[y2Col]) || 0 : 0
      }));
      setAreaData(areaData);
    } else {
      setAreaData([]);
    }
  };

  // Helper functions for intelligent data processing
  const groupByCategory = (data: any[], categoryCol: string, numericCol: string) => {
    const groups: { [key: string]: number } = {};
    data.forEach(row => {
      const category = String(row[categoryCol] || 'Unknown');
      const value = Number(row[numericCol]) || 0;
      groups[category] = (groups[category] || 0) + value;
    });
    
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const countOccurrences = (data: any[], column: string) => {
    const counts: { [key: string]: number } = {};
    data.forEach(row => {
      const value = String(row[column] || 'Unknown');
      counts[value] = (counts[value] || 0) + 1;
    });
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const createNumericRanges = (values: number[]) => {
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const bucketSize = range / 5;
    
    const buckets: { [key: string]: number } = {};
    values.forEach(value => {
      const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), 4);
      const bucketLabel = `${(min + bucketIndex * bucketSize).toFixed(1)}-${(min + (bucketIndex + 1) * bucketSize).toFixed(1)}`;
      buckets[bucketLabel] = (buckets[bucketLabel] || 0) + 1;
    });
    
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  };

  // Effect hooks to regenerate charts when column selections change
  useEffect(() => {
    if (connectedData && barChartColumns.category) {
      generateBarChart(connectedData, barChartColumns.category, barChartColumns.value || '__count__');
    }
  }, [barChartColumns, connectedData]);

  useEffect(() => {
    if (connectedData && pieChartColumn) {
      generatePieChart(connectedData, pieChartColumn);
    }
  }, [pieChartColumn, connectedData]);

  useEffect(() => {
    if (connectedData && lineChartColumns.x && lineChartColumns.y) {
      generateLineChart(connectedData, lineChartColumns.x, lineChartColumns.y);
    }
  }, [lineChartColumns, connectedData]);

  useEffect(() => {
    if (connectedData && areaChartColumns.x && areaChartColumns.y) {
      generateAreaChart(connectedData, areaChartColumns.x, areaChartColumns.y, areaChartColumns.y2 || '__none__');
    }
  }, [areaChartColumns, connectedData]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const handleDownloadDashboard = () => {
    const dashboardElement = document.querySelector('.dashboard-content');
    if (!dashboardElement) return;

    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(dashboardElement as HTMLElement, {
        background: '#0a0a0a',
        useCORS: true,
        allowTaint: true
      }).then(canvas => {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `dashboard-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      });
    }).catch(error => {
      console.error('Error downloading dashboard:', error);
    });
  };

  // Calculate metrics from connected data
  const getTotalRecords = () => connectedData ? connectedData.length : 0;
  const getUniqueValues = (columnIndex: number) => {
    if (!connectedData || !dataColumns[columnIndex]) return 0;
    const uniqueValues = new Set(connectedData.map((row: any) => row[dataColumns[columnIndex]]));
    return uniqueValues.size;
  };
  const getAverageValue = (columnIndex: number) => {
    if (!connectedData || !dataColumns[columnIndex]) return 0;
    const numericValues = connectedData
      .map((row: any) => row[dataColumns[columnIndex]])
      .filter((val: any) => typeof val === 'number');
    return numericValues.length > 0 ? 
      (numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length).toFixed(1) : 0;
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 dashboard-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytical Dashboard</h1>
            <p className="text-gray-600 mt-2">Visual insights and analytics for your connected data</p>
          </div>
          <Button 
            onClick={handleDownloadDashboard}
            className="bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white border-0 hover:shadow-lg hover:shadow-sky-400/25"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Dashboard
          </Button>
        </div>

        {/* Data Source Info */}
        <div className="mb-6">
          {dataSources.length > 0 && (
            <div className="bg-light-surface rounded-lg p-4 border border-light-border">
              <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                  <label className="text-gray-900 font-medium">Connected Data Source:</label>
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-accent-blue" />
                    <span className="text-accent-blue font-medium">{selectedDataSource}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {connectedData && (
                    <>
                      <span className="font-medium">{getTotalRecords()}</span> records • 
                      <span className="font-medium">{dataColumns.length}</span> columns • 
                      <span className="font-medium">{numericColumns.length}</span> numeric • 
                      <span className="font-medium">{categoricalColumns.length}</span> categorical
                    </>
                  )}
                </div>
              </div>
              {dataSources.length > 1 && (
                <div className="mt-3">
                  <Select value={selectedDataSource} onValueChange={(value) => {
                    const source = dataSources.find(s => s.name === value);
                    if (source && source.data) {
                      setSelectedDataSource(value);
                      analyzeAndGenerateVisualizations(source.data);
                    }
                  }}>
                    <SelectTrigger className="w-48 bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      {dataSources.map((source) => (
                        <SelectItem key={source.id} value={source.name}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
          )}
          
          {dataSources.length === 0 && (
            <div className="bg-light-surface rounded-lg p-8 border border-light-border text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Connected</h3>
              <p className="text-gray-600 mb-4">
                Connect a data source in the Chatbot page to automatically generate visualizations here.
              </p>
              <Button 
                onClick={() => window.location.href = '/chatbot'}
                className="bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue"
              >
                Connect Data Source
              </Button>
            </div>
          )}
        </div>

        {dataSources.length > 0 && (
          <>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl hover:animate-float">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">
                {dataColumns[0] || 'Total Records'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-accent-green animate-pulse-neon" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{getTotalRecords()}</div>
              <p className="text-xs text-accent-green">Total data records</p>
            </CardContent>
          </Card>

          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl hover:animate-float">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">
                {dataColumns[1] || 'Unique Values'}
              </CardTitle>
              <Users className="h-4 w-4 text-accent-blue animate-pulse-neon" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{getUniqueValues(1)}</div>
              <p className="text-xs text-accent-blue">Unique categories</p>
            </CardContent>
          </Card>

          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl hover:animate-float">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">
                {dataColumns[2] || 'Data Sources'}
              </CardTitle>
              <Database className="h-4 w-4 text-accent-violet animate-pulse-neon" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{dataSources.length}</div>
              <p className="text-xs text-accent-violet">Connected sources</p>
            </CardContent>
          </Card>

          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl hover:animate-float">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900">
                {dataColumns[2] || 'Average Value'}
              </CardTitle>
              <Activity className="h-4 w-4 text-accent-cyan animate-pulse-neon" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{getAverageValue(2)}</div>
              <p className="text-xs text-accent-cyan">Mean value</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Bar Chart */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-accent-blue" />
                  Bar Chart Analysis
                </div>
              </CardTitle>
              <div className="space-y-3 mt-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Category Column</label>
                    <Select 
                      value={barChartColumns.category} 
                      onValueChange={(value) => setBarChartColumns(prev => ({...prev, category: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select category column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        {dataColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Value Column</label>
                    <Select 
                      value={barChartColumns.value} 
                      onValueChange={(value) => setBarChartColumns(prev => ({...prev, value: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select value column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        <SelectItem value="__count__">Count (no value column)</SelectItem>
                        {numericColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-600">
                  No data available for visualization
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center justify-between">
                <div className="flex items-center">
                  <PieChartIcon className="w-5 h-5 mr-2 text-accent-green" />
                  Pie Chart Distribution
                </div>
              </CardTitle>
              <div className="space-y-3 mt-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Column</label>
                  <Select 
                    value={pieChartColumn} 
                    onValueChange={setPieChartColumn}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select column for distribution" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      {dataColumns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-600">
                  No data available for visualization
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Chart */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-accent-cyan" />
                  Line Chart Trends
                </div>
              </CardTitle>
              <div className="space-y-3 mt-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">X-Axis (Labels)</label>
                    <Select 
                      value={lineChartColumns.x} 
                      onValueChange={(value) => setLineChartColumns(prev => ({...prev, x: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select X-axis column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        {dataColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Y-Axis (Values)</label>
                    <Select 
                      value={lineChartColumns.y} 
                      onValueChange={(value) => setLineChartColumns(prev => ({...prev, y: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select Y-axis column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        {numericColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="trend" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-600">
                  No data available for visualization
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area Chart */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-accent-violet" />
                  Area Chart Overview
                </div>
              </CardTitle>
              <div className="space-y-3 mt-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">X-Axis (Labels)</label>
                    <Select 
                      value={areaChartColumns.x} 
                      onValueChange={(value) => setAreaChartColumns(prev => ({...prev, x: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select X-axis column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        {dataColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Primary Y-Axis</label>
                    <Select 
                      value={areaChartColumns.y} 
                      onValueChange={(value) => setAreaChartColumns(prev => ({...prev, y: value}))}
                    >
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select primary Y-axis" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-300">
                        {numericColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Secondary Y-Axis (Optional)</label>
                  <Select 
                    value={areaChartColumns.y2 || ''} 
                    onValueChange={(value) => setAreaChartColumns(prev => ({...prev, y2: value}))}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select secondary Y-axis (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="__none__">None</SelectItem>
                      {numericColumns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {areaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-600">
                  No data available for visualization
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data Quality Metrics */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900">Data Quality Score</CardTitle>
              <CardDescription className="text-gray-200">Completeness, accuracy, and consistency metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Completeness</span>
                  <span className="text-gray-900 font-semibold">94.2%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-accent-green h-2 rounded-full" style={{ width: '94.2%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Accuracy</span>
                  <span className="text-gray-900 font-semibold">98.7%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-accent-blue h-2 rounded-full" style={{ width: '98.7%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Consistency</span>
                  <span className="text-gray-900 font-semibold">91.5%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-accent-violet h-2 rounded-full" style={{ width: '91.5%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Queries */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900">Recent Queries</CardTitle>
              <CardDescription className="text-gray-600">Latest data analysis activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-2 rounded-lg bg-light-surface">
                  <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm">SELECT * FROM sales WHERE date {'>'} '2024-01-01'</p>
                    <p className="text-gray-500 text-xs">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-2 rounded-lg bg-light-surface">
                  <div className="w-2 h-2 bg-accent-blue rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm">SELECT category, COUNT(*) FROM products GROUP BY category</p>
                    <p className="text-gray-500 text-xs">15 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-2 rounded-lg bg-light-surface">
                  <div className="w-2 h-2 bg-accent-violet rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm">SELECT AVG(price) FROM inventory WHERE stock {'>'} 0</p>
                    <p className="text-gray-500 text-xs">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="bg-light-surface border-light-border transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl">
            <CardHeader>
              <CardTitle className="text-gray-900">System Performance</CardTitle>
              <CardDescription className="text-gray-600">Real-time system metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">CPU Usage</span>
                  <span className="text-gray-900 font-semibold">23%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-accent-green h-2 rounded-full" style={{ width: '23%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Memory Usage</span>
                  <span className="text-gray-900 font-semibold">67%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-accent-yellow h-2 rounded-full" style={{ width: '67%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Storage</span>
                  <span className="text-gray-900 font-semibold">45%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-accent-cyan h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
          </>
        )}
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

export default Dashboard; 