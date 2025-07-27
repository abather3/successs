import React, { useState, useEffect, useMemo } from 'react';

interface QueueMetrics {
  date: string;
  hour: number;
  totalCustomers: number;
  priorityCustomers: number;
  avgWaitTimeMinutes: number;
  avgServiceTimeMinutes: number;
  peakQueueLength: number;
  customersServed: number;
  processingCount?: number; // New field for processing metrics
  avgProcessingTime?: number; // Average processing time
}

interface AdminQueueAnalyticsChartProps {
  data: QueueMetrics[];
  isLoading?: boolean;
  className?: string;
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  authToken?: string;
  apiBaseUrl?: string;
}

const AdminQueueAnalyticsChart: React.FC<AdminQueueAnalyticsChartProps> = ({
  data,
  isLoading = false,
  className = '',
  dateRange,
  onDateRangeChange,
  authToken,
  apiBaseUrl = 'http://localhost:3000'
}) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'totalCustomers',
    'processingCount',
    'customersServed'
  ]);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [viewMode, setViewMode] = useState<'hourly' | 'daily'>('hourly');
  const [localDateRange, setLocalDateRange] = useState(
    dateRange || {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  );

  // Metric configuration
  const metricConfig = {
    totalCustomers: { label: 'Total Customers', color: '#3b82f6', icon: '👥' },
    processingCount: { label: 'Processing Queue', color: '#8b5cf6', icon: '🔄' },
    priorityCustomers: { label: 'Priority Customers', color: '#f59e0b', icon: '⭐' },
    customersServed: { label: 'Customers Served', color: '#10b981', icon: '✅' },
    avgWaitTimeMinutes: { label: 'Avg Wait Time (min)', color: '#ef4444', icon: '⏱️' },
    avgServiceTimeMinutes: { label: 'Avg Service Time (min)', color: '#06b6d4', icon: '🔧' },
    avgProcessingTime: { label: 'Avg Processing Time (min)', color: '#d946ef', icon: '⚡' },
    peakQueueLength: { label: 'Peak Queue Length', color: '#84cc16', icon: '📊' }
  };

  // Process data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => ({
      ...item,
      label: viewMode === 'hourly' 
        ? `${item.hour}:00` 
        : item.date,
      // Ensure processing data is available
      processingCount: item.processingCount || 0,
      avgProcessingTime: item.avgProcessingTime || 0
    }));
  }, [data, viewMode]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!chartData.length) return {};

    const stats: Record<string, any> = {};
    
    Object.keys(metricConfig).forEach(metric => {
      const values = chartData
        .map(d => d[metric as keyof typeof d] as number)
        .filter(v => typeof v === 'number' && !isNaN(v));
      
      if (values.length > 0) {
        stats[metric] = {
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100,
          max: Math.max(...values),
          min: Math.min(...values),
          total: metric.includes('Count') || metric.includes('Customers') 
            ? values.reduce((a, b) => a + b, 0) 
            : null
        };
      }
    });

    return stats;
  }, [chartData]);

  // Handle date range changes
  const handleDateRangeChange = (newRange: { start: string; end: string }) => {
    setLocalDateRange(newRange);
    onDateRangeChange?.(newRange);
  };

  // Export chart data
  const exportData = async (format: 'csv' | 'json') => {
    if (!authToken || !apiBaseUrl) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/analytics/export?startDate=${localDateRange.start}&endDate=${localDateRange.end}&type=${viewMode}&format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `queue-analytics-${viewMode}-${localDateRange.start}-${localDateRange.end}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  // Metric toggle
  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  // Simple SVG chart renderer
  const renderChart = () => {
    if (!chartData.length || !selectedMetrics.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p>No data available for selected metrics</p>
          </div>
        </div>
      );
    }

    const chartWidth = 800;
    const chartHeight = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = chartWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    // Find max value across all selected metrics for scaling
    const maxValue = Math.max(
      ...selectedMetrics.flatMap(metric => 
        chartData.map(d => (d[metric as keyof typeof d] as number) || 0)
      )
    );

    const scaleY = (value: number) => height - (value / maxValue) * height;
    const scaleX = (index: number) => (index / (chartData.length - 1)) * width;

    return (
      <div className="w-full overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <g key={ratio}>
              <line
                x1={margin.left}
                y1={margin.top + ratio * height}
                x2={margin.left + width}
                y2={margin.top + ratio * height}
                stroke="#e5e7eb"
                strokeWidth="1"
                opacity="0.5"
              />
              <text
                x={margin.left - 10}
                y={margin.top + ratio * height + 4}
                textAnchor="end"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                {Math.round(maxValue * (1 - ratio))}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {chartData.map((item, index) => (
            <text
              key={index}
              x={margin.left + scaleX(index)}
              y={chartHeight - 10}
              textAnchor="middle"
              className="text-xs fill-gray-500 dark:fill-gray-400"
            >
              {item.label}
            </text>
          ))}

          {/* Chart lines/areas */}
          {selectedMetrics.map(metric => {
            const color = metricConfig[metric as keyof typeof metricConfig]?.color || '#6b7280';
            const points = chartData
              .map((item, index) => {
                const value = item[metric as keyof typeof item] as number || 0;
                return `${margin.left + scaleX(index)},${margin.top + scaleY(value)}`;
              })
              .join(' ');

            if (chartType === 'area') {
              const areaPoints = `${margin.left},${margin.top + height} ${points} ${margin.left + width},${margin.top + height}`;
              return (
                <g key={metric}>
                  <polygon
                    points={areaPoints}
                    fill={color}
                    fillOpacity="0.1"
                    stroke={color}
                    strokeWidth="2"
                  />
                </g>
              );
            } else if (chartType === 'bar') {
              return (
                <g key={metric}>
                  {chartData.map((item, index) => {
                    const value = item[metric as keyof typeof item] as number || 0;
                    const barHeight = (value / maxValue) * height;
                    const barWidth = Math.max(width / chartData.length - 4, 8);
                    return (
                      <rect
                        key={index}
                        x={margin.left + scaleX(index) - barWidth / 2}
                        y={margin.top + height - barHeight}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        fillOpacity="0.7"
                      />
                    );
                  })}
                </g>
              );
            } else {
              return (
                <g key={metric}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Data points */}
                  {chartData.map((item, index) => {
                    const value = item[metric as keyof typeof item] as number || 0;
                    return (
                      <circle
                        key={index}
                        cx={margin.left + scaleX(index)}
                        cy={margin.top + scaleY(value)}
                        r="4"
                        fill={color}
                        className="hover:r-6 transition-all cursor-pointer"
                      >
                        <title>{`${metricConfig[metric as keyof typeof metricConfig]?.label}: ${value}`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            }
          })}
        </svg>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded mb-4"></div>
          <div className="flex space-x-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Queue Analytics Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time queue metrics including processing queue analysis
            </p>
          </div>
          
          {/* Controls */}
          <div className="mt-4 lg:mt-0 flex flex-wrap gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'hourly' | 'daily')}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="hourly">Hourly View</option>
              <option value="daily">Daily View</option>
            </select>
            
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'line' | 'bar' | 'area')}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="area">Area Chart</option>
            </select>

            <button
              onClick={() => exportData('csv')}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              📊 Export CSV
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <input
              type="date"
              value={localDateRange.start}
              onChange={(e) => handleDateRangeChange({ ...localDateRange, start: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <input
              type="date"
              value={localDateRange.end}
              onChange={(e) => handleDateRangeChange({ ...localDateRange, end: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Metric Selection */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Metrics:</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metricConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => toggleMetric(key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                selectedMetrics.includes(key)
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              <span className="mr-1">{config.icon}</span>
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        {renderChart()}
      </div>

      {/* Statistics */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Statistics Summary:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {selectedMetrics.map(metric => {
            const config = metricConfig[metric as keyof typeof metricConfig];
            const stat = statistics[metric];
            
            if (!config || !stat) return null;
            
            return (
              <div key={metric} className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span>{config.icon}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {config.label}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Avg: <strong>{stat.avg}</strong></div>
                  <div>Max: <strong>{stat.max}</strong></div>
                  {stat.total !== null && (
                    <div>Total: <strong>{stat.total}</strong></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminQueueAnalyticsChart;
