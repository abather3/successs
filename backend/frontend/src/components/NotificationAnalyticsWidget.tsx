import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import useSWR from 'swr';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

// Types for notification analytics data
interface NotificationStats {
  total_notifications: number;
  total_active: number;
  total_unread: number;
  total_read: number;
  expires_soon: number;
  avg_response_time_minutes: number;
  created_today: number;
  read_today: number;
  target_role: string;
  last_updated: string;
  timestamp: number;
}

interface DailyData {
  date: string;
  created: number;
  read: number;
  active: number;
}

interface WeeklyTrend {
  week: string;
  total: number;
  completed: number;
  pending: number;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage?: number;
  };
  color: 'primary' | 'success' | 'warning' | 'error';
  icon: string;
}

// KPI Card Component
const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, trend, color, icon }) => {
  const getColorClasses = (color: string) => {
    const colorMap = {
      primary: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      error: 'bg-red-50 border-red-200 text-red-800'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.primary;
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '➡️';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getColorClasses(color)} transition-all duration-200 hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xl opacity-60">{icon}</div>
        {trend && (
          <div className={`flex items-center text-xs font-medium ${
            trend.direction === 'up' ? 'text-green-600' : 
            trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {getTrendIcon(trend.direction)}
            {trend.percentage && `${trend.percentage}%`}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium opacity-75 mb-1">{title}</h3>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs opacity-60 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Main Widget Component
const NotificationAnalyticsWidget: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Data fetchers
  const fetchNotificationStats = async (): Promise<NotificationStats> => {
    const response = await fetch('/api/notifications/analytics');
    if (!response.ok) throw new Error('Failed to fetch notification stats');
    return response.json();
  };

  const fetchDailyData = async (): Promise<DailyData[]> => {
    const response = await fetch('/api/notifications/daily-stats?days=14');
    if (!response.ok) throw new Error('Failed to fetch daily data');
    return response.json();
  };

  const fetchWeeklyTrend = async (): Promise<WeeklyTrend[]> => {
    const response = await fetch('/api/notifications/weekly-trend?weeks=4');
    if (!response.ok) throw new Error('Failed to fetch weekly trend');
    return response.json();
  };

  // SWR hooks for data fetching
  const { 
    data: stats, 
    error: statsError, 
    mutate: mutateStats 
  } = useSWR<NotificationStats>('notification-stats', fetchNotificationStats, {
    refreshInterval: 30000, // Refresh every 30 seconds as fallback
    revalidateOnFocus: false,
  });

  const { 
    data: dailyData, 
    error: dailyError, 
    mutate: mutateDailyData 
  } = useSWR<DailyData[]>('daily-notification-data', fetchDailyData, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: false,
  });

  const { 
    data: weeklyTrend, 
    error: weeklyError, 
    mutate: mutateWeeklyTrend 
  } = useSWR<WeeklyTrend[]>('weekly-notification-trend', fetchWeeklyTrend, {
    refreshInterval: 300000, // Refresh every 5 minutes
    revalidateOnFocus: false,
  });

  // WebSocket connection setup
  const initializeSocket = useCallback(() => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('[NOTIFICATION_ANALYTICS] No auth token found');
        return;
      }

      const newSocket = io(process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3000', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('[NOTIFICATION_ANALYTICS] Connected to WebSocket');
        setIsConnected(true);
        
        // Subscribe to notification analytics updates
        newSocket.emit('subscribe:notification_analytics');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[NOTIFICATION_ANALYTICS] Disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[NOTIFICATION_ANALYTICS] Connection error:', error);
        setIsConnected(false);
      });

      // Handle real-time stats updates
      newSocket.on('notification_stats_update', (updatedStats: NotificationStats) => {
        console.log('[NOTIFICATION_ANALYTICS] Received stats update:', updatedStats);
        
        // Trigger SWR revalidation for all data
        mutateStats(updatedStats, false);
        mutateDailyData(); // Refetch daily data
        mutateWeeklyTrend(); // Refetch weekly trend
        
        setLastRefresh(Date.now());
      });

      setSocket(newSocket);

    } catch (error) {
      console.error('[NOTIFICATION_ANALYTICS] Socket initialization error:', error);
    }
  }, [mutateStats, mutateDailyData, mutateWeeklyTrend]);

  // Initialize WebSocket on mount
  useEffect(() => {
    initializeSocket();

    return () => {
      if (socket) {
        console.log('[NOTIFICATION_ANALYTICS] Cleaning up WebSocket connection');
        socket.disconnect();
      }
    };
  }, [initializeSocket]);

  // Generate KPI cards data
  const generateKPICards = (): KPICardProps[] => {
    if (!stats) {
      return [
        { title: 'Loading...', value: '...', color: 'primary', icon: '⏳' }
      ];
    }

    return [
      {
        title: 'Active Notifications',
        value: stats.total_active,
        subtitle: 'Currently pending',
        color: stats.total_active > 10 ? 'warning' : stats.total_active > 0 ? 'primary' : 'success',
        icon: '📢',
        trend: {
          direction: stats.total_active > stats.total_read ? 'up' : stats.total_active < stats.total_read ? 'down' : 'stable'
        }
      },
      {
        title: 'Unread Notifications',
        value: stats.total_unread,
        subtitle: 'Requiring attention',
        color: stats.total_unread > 5 ? 'error' : stats.total_unread > 0 ? 'warning' : 'success',
        icon: '🔔'
      },
      {
        title: 'Expiring Soon',
        value: stats.expires_soon,
        subtitle: 'Within 1 hour',
        color: stats.expires_soon > 0 ? 'error' : 'success',
        icon: '⏰'
      },
      {
        title: 'Avg Response Time',
        value: `${Math.round(stats.avg_response_time_minutes)}m`,
        subtitle: 'Minutes to respond',
        color: stats.avg_response_time_minutes > 30 ? 'error' : 
               stats.avg_response_time_minutes > 15 ? 'warning' : 'success',
        icon: '⚡',
        trend: {
          direction: stats.avg_response_time_minutes < 15 ? 'down' : 
                    stats.avg_response_time_minutes > 30 ? 'up' : 'stable'
        }
      }
    ];
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-medium">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Loading states
  if (statsError || dailyError || weeklyError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">⚠️</div>
          <div>
            <h4 className="text-red-800 font-medium">Error Loading Analytics</h4>
            <p className="text-red-600 text-sm">
              {statsError?.message || dailyError?.message || weeklyError?.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notification Analytics</h2>
          <p className="text-gray-600">Real-time insights and performance metrics</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span>{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
          <span className="text-xs text-gray-500">
            Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {generateKPICards().map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend Line/Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Activity (Last 14 Days)
          </h3>
          {dailyData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="created" 
                  stackId="1"
                  stroke="#3b82f6" 
                  fill="#dbeafe" 
                  name="Created"
                />
                <Area 
                  type="monotone" 
                  dataKey="read" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#d1fae5" 
                  name="Processed"
                />
                <Line 
                  type="monotone" 
                  dataKey="active" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Active"
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading chart data...</div>
            </div>
          )}
        </div>

        {/* Weekly Trend Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Trends
          </h3>
          {weeklyTrend ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyTrend} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis 
                  type="category" 
                  dataKey="week" 
                  tick={{ fontSize: 11 }}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="completed" fill="#10b981" name="Completed" />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading trend data...</div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats Summary */}
      {stats && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Performance Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total_notifications}</div>
              <div className="text-gray-500">Total Notifications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.created_today}</div>
              <div className="text-gray-500">Created Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.read_today}</div>
              <div className="text-gray-500">Processed Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats.total_read > 0 ? Math.round((stats.total_read / stats.total_notifications) * 100) : 0}%
              </div>
              <div className="text-gray-500">Completion Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationAnalyticsWidget;
