import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Paper,
  LinearProgress,
  Button,
  Alert,
  Fade,
  Slide,
  Zoom,
  Tooltip,
  Divider,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import CircularLogo from '../CircularLogo';
import {
  Monitor as MonitorIcon,
  Queue as QueueIcon,
  Person as PersonIcon,
  Star as PriorityIcon,
  AccessTime as TimeIcon,
  VolumeUp as SoundIcon,
  PriorityHigh as PriorityHighIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';
import { keyframes } from '@mui/system';
import { formatTokenNumberWithHash } from '../../utils/tokenFormatter';

interface QueueItem {
  id: number;
  name: string;
  token_number: number;
  queue_status: string;
  priority_flags: {
    senior_citizen: boolean;
    pregnant: boolean;
    pwd: boolean;
  };
  estimated_time: number;
  counter_id?: number;
  counter_name?: string;
}

interface Counter {
  id: number;
  name: string;
  is_active: boolean;
  current_customer?: QueueItem;
}

// Animation keyframes
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const glow = keyframes`
  0% {
    box-shadow: 0 0 5px rgba(33, 150, 243, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(33, 150, 243, 0.8), 0 0 30px rgba(33, 150, 243, 0.6);
  }
  100% {
    box-shadow: 0 0 5px rgba(33, 150, 243, 0.5);
  }
`;


const DisplayMonitor: React.FC = () => {
  const { socket } = useSocket();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isSmallScreen = useMediaQuery('(max-width: 1200px)');
  const [queueData, setQueueData] = useState<QueueItem[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousServingCustomers, setPreviousServingCustomers] = useState<Set<number>>(new Set());

  const playNotificationSound = useCallback(async () => {
    if (!soundEnabled) {
      console.log('Sound is disabled');
      return;
    }

    try {
      console.log('Attempting to play notification sound...');
      
      // Check if AudioContext is supported
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API not supported');
        return;
      }

      const audioContext = new AudioContext();
      
      // Resume audio context if it's suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        console.log('Resuming suspended audio context...');
        await audioContext.resume();
      }
      
      // Create oscillator and gain nodes
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect the nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure the sound (800Hz sine wave with fade out)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      // Play the sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('Notification sound played successfully');
      
      // Clean up after sound finishes
      setTimeout(() => {
        audioContext.close();
      }, 600);
      
    } catch (error) {
      console.error('Error playing notification sound:', error);
      
      // Fallback: Try using a simple beep with HTML5 Audio
      try {
        console.log('Attempting fallback beep sound...');
        // Create a simple data URL for a beep sound
        const beepDataUrl = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+T4wGcdBSuX3/LXeSYELIHA8N2LRQJY';
        const audio = new Audio(beepDataUrl);
        audio.volume = 0.3;
        await audio.play();
        console.log('Fallback beep played successfully');
      } catch (fallbackError) {
        console.error('Fallback sound also failed:', fallbackError);
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchQueueData();
    fetchCounters();
    
    const interval = setInterval(() => {
      fetchQueueData();
      fetchCounters();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // WebSocket subscription for real-time queue updates
  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdate = (data: any) => {
      console.log('Queue update received:', data);
      
      // Update queue data
      if (data.queue) {
        const transformedData = data.queue.map((item: any) => ({
          id: item.customer?.id || item.id,
          name: item.customer?.name || item.name,
          token_number: item.customer?.token_number || item.token_number || item.position,
          queue_status: item.customer?.queue_status || item.queue_status,
          priority_flags: item.customer?.priority_flags || item.priority_flags || { senior_citizen: false, pregnant: false, pwd: false },
          estimated_time: item.estimated_wait_time || item.estimated_time || 0,
          counter_id: item.customer?.counter_id || item.counter_id,
          counter_name: item.customer?.counter_name || item.counter_name
        }));
        setQueueData(transformedData);
        
        // Check for newly serving customers and trigger sound
        const currentServingIds = new Set(
          transformedData
            .filter((item: QueueItem) => item.queue_status === 'serving')
            .map((item: QueueItem) => item.id)
        );
        
        // Find customers who just moved to serving status
        const newlyServing = Array.from(currentServingIds).filter(
          id => !previousServingCustomers.has(id as number)
        );
        
        if (newlyServing.length > 0) {
          console.log('New customers being served:', newlyServing);
          playNotificationSound();
        }
        
        setPreviousServingCustomers(currentServingIds as Set<number>);
      }
      
      // Update counters if provided
      if (data.counters) {
        setCounters(data.counters);
      }
      
    };

    const handleCustomerCalled = (data: any) => {
      console.log('Customer called:', data);
      playNotificationSound();
      
      // Refresh data to get updated status
      fetchQueueData();
      fetchCounters();
    };

    const handleDailyReset = (data: any) => {
      console.log('Daily reset completed:', data);
      // Force immediate data refresh when daily reset completes
      fetchQueueData();
      fetchCounters();
      // Clear any existing data to show empty state immediately
      setQueueData([]);
      setCounters([]);
    };

    // Listen for specific events
    socket.on('queue_update', handleQueueUpdate);
    socket.on('customer_called', handleCustomerCalled);
    socket.on('status_change', handleQueueUpdate);
    socket.on('daily_reset_completed', handleDailyReset);
    
    return () => {
      socket.off('queue_update', handleQueueUpdate);
      socket.off('customer_called', handleCustomerCalled);
      socket.off('status_change', handleQueueUpdate);
      socket.off('daily_reset_completed', handleDailyReset);
    };
  }, [socket, previousServingCustomers, playNotificationSound]);

  // Initialize serving customers tracking
  useEffect(() => {
    const currentServingIds = new Set(
      queueData
        .filter(item => item.queue_status === 'serving')
        .map(item => item.id)
    );
    setPreviousServingCustomers(currentServingIds);
  }, [queueData]);

  const fetchQueueData = async () => {
    try {
      const response = await fetch('/api/queue/display-all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Transform backend queue data to match frontend interface
        const transformedData = data.map((item: any) => ({
          id: item.customer.id,
          name: item.customer.name,
          token_number: item.customer.token_number || item.position,
          queue_status: item.customer.queue_status,
          priority_flags: item.customer.priority_flags || { senior_citizen: false, pregnant: false, pwd: false },
          estimated_time: item.estimated_wait_time || 0,
          counter_id: item.customer.counter_id,
          counter_name: item.customer.counter_name
        }));
        setQueueData(transformedData);
      } else {
        setError('Failed to fetch queue data');
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
      setError('Error fetching queue data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCounters = async () => {
    try {
      const response = await fetch('/api/queue/counters/display', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCounters(data); // Already filtered to active counters in backend
      }
    } catch (error) {
      console.error('Error fetching counters:', error);
    }
  };

  const getPriorityLabel = (flags: QueueItem['priority_flags']) => {
    if (flags.senior_citizen) return 'Senior Citizen';
    if (flags.pregnant) return 'Pregnant';
    if (flags.pwd) return 'PWD';
    return 'Regular';
  };

  const getPriorityIcon = (flags: QueueItem['priority_flags']) => {
    if (flags.senior_citizen || flags.pregnant || flags.pwd) {
      return <PriorityIcon sx={{ color: 'error.main', fontSize: '1.2rem' }} />;
    }
    return <PersonIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />;
  };


  const waitingCustomers = queueData.filter(item => item.queue_status === 'waiting');
  const servingCustomers = queueData.filter(item => item.queue_status === 'serving');
  const priorityCustomers = queueData.filter(item => 
    item.priority_flags.senior_citizen || item.priority_flags.pregnant || item.priority_flags.pwd
  );

  const averageWaitTime = queueData.length > 0 
    ? Math.round(queueData.reduce((sum, item) => sum + item.estimated_time, 0) / queueData.length)
    : 0;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Loading queue information...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Animated Background Shapes */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '30%',
          height: '100%',
          background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
          borderRadius: '50%',
          animation: `${pulse} 8s ease-in-out infinite`
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-50%',
          left: '-10%',
          width: '30%',
          height: '100%',
          background: `linear-gradient(45deg, ${alpha(theme.palette.secondary.main, 0.1)}, transparent)`,
          borderRadius: '50%',
          animation: `${pulse} 10s ease-in-out infinite reverse`
        }
      }} />
      
      <Box sx={{ 
        position: 'relative', 
        zIndex: 1, 
        p: isMobile ? 1 : isTablet ? 2 : 3,
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <Fade in timeout={1000}>
          <Card sx={{ 
            mb: 4, 
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'url("data:image/svg+xml,%3Csvg width="20" height="20" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="a" patternUnits="userSpaceOnUse" width="20" height="20"%3E%3Ccircle fill="%23ffffff" fill-opacity="0.1" cx="10" cy="10" r="1"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23a)"/%3E%3C/svg%3E")',
              opacity: 0.3
            }
          }}>
            <CardContent sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
                gap: isMobile ? 2 : 0
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularLogo size={60} alt="ESCASHOP Logo" />
                  <Box>
                    <Typography variant={isMobile ? 'h5' : 'h3'} component="h1" sx={{ 
                      fontWeight: 'bold', 
                      mb: 1,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                      fontSize: isMobile ? '1.5rem' : undefined
                    }}>
                      ESCASHOP PREMIUM EYEWEAR
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: isMobile ? 'center' : 'right' }}>
                  <Typography variant={isMobile ? 'h5' : 'h3'} sx={{ 
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                    fontSize: isMobile ? '1.5rem' : undefined
                  }}>
                    {currentTime.toLocaleTimeString()}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    {currentTime.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {/* Statistics Cards */}
        <Box sx={{ 
          display: 'flex', 
          gap: isMobile ? 0.5 : isTablet ? 2 : 3, 
          mb: 4, 
          flexWrap: 'wrap', 
          justifyContent: 'center',
          width: '100%',
          maxWidth: '100vw',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Waiting Customers */}
          <Slide direction="up" in timeout={800}>
            <Box sx={{ 
              flex: isMobile ? '1 1 calc(50% - 4px)' : isTablet ? '1 1 200px' : '1 1 250px', 
              minWidth: isMobile ? 'calc(50% - 4px)' : isTablet ? '200px' : '250px',
              maxWidth: isMobile ? 'calc(50% - 4px)' : 'none'
            }}>
              <Tooltip title="Customers currently waiting in queue" arrow>
                <Card sx={{ 
                  height: '140px',
                  background: `linear-gradient(135deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                  },
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h3" sx={{ 
                          fontWeight: 'bold',
                          animation: waitingCustomers.length > 0 ? `${pulse} 2s ease-in-out infinite` : 'none'
                        }}>
                          {waitingCustomers.length}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9 }}>
                          👥 Waiting
                        </Typography>
                      </Box>
                      <PeopleIcon sx={{ fontSize: 50, opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '60px',
                    height: '60px',
                    background: alpha('#fff', 0.1),
                    borderRadius: '50%',
                    transform: 'translate(20px, -20px)'
                  }} />
                </Card>
              </Tooltip>
            </Box>
          </Slide>
          
          {/* Currently Serving */}
          <Slide direction="up" in timeout={1000}>
            <Box sx={{ 
              flex: isMobile ? '1 1 calc(50% - 4px)' : isTablet ? '1 1 200px' : '1 1 250px', 
              minWidth: isMobile ? 'calc(50% - 4px)' : isTablet ? '200px' : '250px',
              maxWidth: isMobile ? 'calc(50% - 4px)' : 'none'
            }}>
              <Tooltip title="Customers currently being served" arrow>
                <Card sx={{ 
                  height: '140px',
                  background: `linear-gradient(135deg, ${theme.palette.info.light} 0%, ${theme.palette.info.main} 100%)`,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                  },
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h3" sx={{ 
                          fontWeight: 'bold',
                          animation: servingCustomers.length > 0 ? `${glow} 3s ease-in-out infinite` : 'none'
                        }}>
                          {servingCustomers.length}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9 }}>
                          ▶️ Serving
                        </Typography>
                      </Box>
                      <PersonIcon sx={{ fontSize: 50, opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '60px',
                    height: '60px',
                    background: alpha('#fff', 0.1),
                    borderRadius: '50%',
                    transform: 'translate(20px, -20px)'
                  }} />
                </Card>
              </Tooltip>
            </Box>
          </Slide>
          
          {/* Priority Customers */}
          <Slide direction="up" in timeout={1200}>
            <Box sx={{ 
              flex: isMobile ? '1 1 calc(50% - 4px)' : isTablet ? '1 1 200px' : '1 1 250px', 
              minWidth: isMobile ? 'calc(50% - 4px)' : isTablet ? '200px' : '250px',
              maxWidth: isMobile ? 'calc(50% - 4px)' : 'none'
            }}>
              <Tooltip title="Senior citizens, pregnant women, and PWD customers" arrow>
                <Card sx={{ 
                  height: '140px',
                  background: `linear-gradient(135deg, ${theme.palette.error.light} 0%, ${theme.palette.error.main} 100%)`,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                  },
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h3" sx={{ 
                          fontWeight: 'bold',
                          animation: priorityCustomers.length > 0 ? `${pulse} 1.5s ease-in-out infinite` : 'none'
                        }}>
                          {priorityCustomers.length}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9 }}>
                          ⭐ Priority
                        </Typography>
                      </Box>
                      <PriorityHighIcon sx={{ fontSize: 50, opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '60px',
                    height: '60px',
                    background: alpha('#fff', 0.1),
                    borderRadius: '50%',
                    transform: 'translate(20px, -20px)'
                  }} />
                </Card>
              </Tooltip>
            </Box>
          </Slide>
          
          {/* Average Wait Time */}
          <Slide direction="up" in timeout={1400}>
            <Box sx={{ 
              flex: isMobile ? '1 1 calc(50% - 4px)' : isTablet ? '1 1 200px' : '1 1 250px', 
              minWidth: isMobile ? 'calc(50% - 4px)' : isTablet ? '200px' : '250px',
              maxWidth: isMobile ? 'calc(50% - 4px)' : 'none'
            }}>
              <Tooltip title="Average estimated wait time for customers" arrow>
                <Card sx={{ 
                  height: '140px',
                  background: `linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.main} 100%)`,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                  },
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                          {averageWaitTime}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9 }}>
                          ⏰ Avg Wait (min)
                        </Typography>
                      </Box>
                      <TimeIcon sx={{ fontSize: 50, opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '60px',
                    height: '60px',
                    background: alpha('#fff', 0.1),
                    borderRadius: '50%',
                    transform: 'translate(20px, -20px)'
                  }} />
                </Card>
              </Tooltip>
            </Box>
          </Slide>
        </Box>

        {/* Service Counters */}
        <Fade in timeout={1600}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ 
              fontWeight: 'bold', 
              color: 'primary.main',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <MonitorIcon sx={{ fontSize: 32 }} />
              🏢 Service Counters
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: isMobile ? 1 : isTablet ? 2 : 3, 
              flexWrap: 'wrap', 
              justifyContent: 'center',
              width: '100%',
              maxWidth: '100vw',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}>
              {counters.map((counter, index) => (
                <Zoom in timeout={1800 + (index * 200)} key={counter.id}>
                  <Box sx={{ 
                    flex: isMobile ? '1 1 100%' : isTablet ? '1 1 280px' : '1 1 300px', 
                    minWidth: isMobile ? '100%' : isTablet ? '280px' : '300px', 
                    maxWidth: isMobile ? '100%' : isTablet ? '320px' : '400px',
                    width: isMobile ? '100%' : 'auto',
                    boxSizing: 'border-box'
                  }}>
                    <Card sx={{ 
                      height: '240px', 
                      position: 'relative',
                      background: counter.current_customer 
                        ? `linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.main} 100%)`
                        : `linear-gradient(135deg, ${alpha(theme.palette.grey[300], 0.8)} 0%, ${alpha(theme.palette.grey[400], 0.8)} 100%)`,
                      color: counter.current_customer ? 'white' : 'text.primary',
                      cursor: 'pointer',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                      },
                      overflow: 'hidden',
                      ...(counter.current_customer && {
                        animation: `${glow} 4s ease-in-out infinite`
                      })
                    }}>
                      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            {counter.name}
                          </Typography>
                          <Box sx={{ 
                            p: 1, 
                            borderRadius: '50%', 
                            bgcolor: alpha('#fff', counter.current_customer ? 0.2 : 0.1) 
                          }}>
                            <MonitorIcon sx={{ fontSize: 24 }} />
                          </Box>
                        </Box>
                        
                        <Divider sx={{ mb: 2, bgcolor: alpha('#fff', 0.3) }} />
                        
                        {counter.current_customer ? (
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center', mb: 2 }}>
                              <Typography variant="h2" sx={{ 
                                fontWeight: 'bold',
                                mb: 1,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                animation: `${pulse} 2s ease-in-out infinite`
                              }}>
                                {formatTokenNumberWithHash(counter.current_customer.token_number)}
                              </Typography>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 'medium',
                                opacity: 0.9
                              }}>
                                {counter.current_customer.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              {getPriorityIcon(counter.current_customer.priority_flags)}
                              <Chip 
                                label={getPriorityLabel(counter.current_customer.priority_flags)}
                                size="small"
                                sx={{ 
                                  bgcolor: alpha('#fff', 0.2),
                                  color: 'inherit',
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <Box sx={{ 
                              p: 3, 
                              borderRadius: '50%', 
                              bgcolor: alpha(theme.palette.grey[400], 0.2),
                              mb: 2
                            }}>
                              <QueueIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                            </Box>
                            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                              💺 Available
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Ready for next customer
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                      
                      {/* Animated background decoration */}
                      <Box sx={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-50%',
                        width: '100%',
                        height: '100%',
                        background: alpha('#fff', 0.1),
                        borderRadius: '50%',
                        zIndex: 0
                      }} />
                    </Card>
                  </Box>
                </Zoom>
              ))}
            </Box>
          </Box>
        </Fade>

        {/* Waiting Queue */}
        <Fade in timeout={2000}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 3,
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                  gap: isMobile ? 2 : 0
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <QueueIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    👥 Waiting Queue
                  </Typography>
                  {waitingCustomers.length > 0 && (
                    <Chip 
                      label={`${waitingCustomers.length} waiting`}
                      color="primary"
                      size="small"
                      sx={{ ml: 2, animation: `${pulse} 2s ease-in-out infinite` }}
                    />
                  )}
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  gap: isMobile ? 1 : 2,
                  flexWrap: isMobile ? 'wrap' : 'nowrap'
                }}>
                  <Tooltip title="Open in New Window" arrow>
                    <Button
                      variant="outlined"
                      startIcon={
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      }
                      onClick={() => {
                        const token = localStorage.getItem('accessToken');
                        const displayUrl = `${window.location.origin}/display-standalone${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                        const newWindow = window.open(
                          displayUrl,
                          'DisplayMonitor',
                          'width=1200,height=800,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
                        );
                        if (newWindow) {
                          newWindow.focus();
                        } else {
                          window.open(displayUrl, '_blank');
                        }
                      }}
                      sx={{
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      New Window
                    </Button>
                  </Tooltip>
                  <Tooltip title="Toggle notification sounds" arrow>
                    <Button
                      variant={soundEnabled ? 'contained' : 'outlined'}
                      startIcon={<SoundIcon />}
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      color={soundEnabled ? 'primary' : 'inherit'}
                      sx={{
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      Sound {soundEnabled ? 'On' : 'Off'}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Test notification sound" arrow>
                    <Button
                      variant="outlined"
                      startIcon={<SoundIcon />}
                      onClick={() => {
                        console.log('Testing sound...');
                        playNotificationSound();
                      }}
                      disabled={!soundEnabled}
                      sx={{
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      Test Sound
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
              
              {waitingCustomers.length > 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  gap: isMobile ? 0.5 : isTablet ? 2 : 3, 
                  flexWrap: 'wrap', 
                  justifyContent: 'center',
                  width: '100%',
                  maxWidth: '100vw',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}>
                  {waitingCustomers.map((customer, index) => (
                    <Zoom in timeout={2200 + (index * 150)} key={customer.id}>
                      <Box sx={{ 
                        flex: isMobile ? '1 1 calc(50% - 4px)' : '0 1 200px', 
                        minWidth: isMobile ? 'calc(50% - 4px)' : '200px', 
                        maxWidth: isMobile ? 'calc(50% - 4px)' : '220px',
                        boxSizing: 'border-box'
                      }}>
                        <Tooltip title={`${customer.name} - ${getPriorityLabel(customer.priority_flags)}`} arrow>
                          <Paper sx={{ 
                            p: 3, 
                            textAlign: 'center', 
                            height: '160px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'center',
                            background: customer.priority_flags.senior_citizen || customer.priority_flags.pregnant || customer.priority_flags.pwd
                              ? `linear-gradient(135deg, ${alpha(theme.palette.error.light, 0.8)} 0%, ${alpha(theme.palette.error.main, 0.8)} 100%)`
                              : `linear-gradient(135deg, ${alpha(theme.palette.info.light, 0.8)} 0%, ${alpha(theme.palette.info.main, 0.8)} 100%)`,
                            color: 'white',
                            cursor: 'pointer',
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-8px) rotate(2deg)',
                              boxShadow: '0 12px 24px rgba(0,0,0,0.2)'
                            },
                            position: 'relative',
                            overflow: 'hidden',
                            ...(customer.priority_flags.senior_citizen || customer.priority_flags.pregnant || customer.priority_flags.pwd) && {
                              animation: `${pulse} 3s ease-in-out infinite`
                            }
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                              {getPriorityIcon(customer.priority_flags)}
                              <Typography variant="h4" sx={{ 
                                fontWeight: 'bold', 
                                ml: 1,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                fontFamily: 'monospace'
                              }}>
                                {formatTokenNumberWithHash(customer.token_number)}
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ 
                              fontWeight: 'medium',
                              mb: 1,
                              textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                            }}>
                              {customer.name}
                            </Typography>
                            <Chip 
                              label={getPriorityLabel(customer.priority_flags)}
                              size="small"
                              sx={{ 
                                bgcolor: alpha('#fff', 0.2),
                                color: 'inherit',
                                fontWeight: 'bold',
                                fontSize: '0.75rem'
                              }}
                            />
                            
                            {/* Decorative elements */}
                            <Box sx={{
                              position: 'absolute',
                              top: -20,
                              right: -20,
                              width: 60,
                              height: 60,
                              borderRadius: '50%',
                              background: alpha('#fff', 0.1)
                            }} />
                            <Box sx={{
                              position: 'absolute',
                              bottom: -15,
                              left: -15,
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: alpha('#fff', 0.1)
                            }} />
                          </Paper>
                        </Tooltip>
                      </Box>
                    </Zoom>
                  ))}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Box sx={{ 
                    display: 'inline-flex',
                    p: 4,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    mb: 3
                  }}>
                    <QueueIcon sx={{ fontSize: 64, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold', mb: 1 }}>
                    🎉 No customers waiting
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    The queue is currently empty. New customers will appear here.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Fade>
        
        {/* Error Display */}
        {error && (
          <Slide direction="up" in timeout={500}>
            <Alert severity="error" sx={{ mt: 3 }}>
              {error}
            </Alert>
          </Slide>
        )}
      </Box>
    </Box>
  );
};

export default DisplayMonitor;
