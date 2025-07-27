import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Grid,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  Settings as SettingsIcon,
  People as PeopleIcon,
  List as ListIcon,
  Store as StoreIcon,
  Assignment as LogIcon,
  Analytics as AnalyticsIcon,
  Message as MessageIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import UserManagement from './UserManagement';
import DropdownManagement from './DropdownManagement';
import CounterManagement from './CounterManagement';
import ActivityLogs from './ActivityLogs';
import QueueAnalyticsDashboard from '../analytics/QueueAnalyticsDashboard';
import EnhancedSMSManagement from '../analytics/EnhancedSMSManagement';
import { SessionTimeoutSettingsComponent as SessionTimeoutSettings } from './SessionTimeoutSettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ 
          p: { xs: 1, sm: 2, md: 3 }, 
          maxWidth: '100%', 
          width: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
}

const AdminPanel: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const adminFeatures = [
    {
      title: 'User Management',
      description: 'Add, edit, and manage staff accounts',
      icon: <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      color: 'primary.main'
    },
    {
      title: 'Queue Analytics',
      description: 'Analyze queue performance and customer metrics',
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: 'info.main' }} />,
      color: 'info.main'
    },
    {
      title: 'SMS Management',
      description: 'Manage SMS templates and notification history',
      icon: <MessageIcon sx={{ fontSize: 40, color: 'purple' }} />,
      color: 'purple'
    },
    {
      title: 'Dropdown Management',
      description: 'Configure grade types and lens types',
      icon: <ListIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
      color: 'secondary.main'
    },
    {
      title: 'Counter Management',
      description: 'Set up service counters for the display monitor',
      icon: <StoreIcon sx={{ fontSize: 40, color: 'success.main' }} />,
      color: 'success.main'
    },
    {
      title: 'Activity Logs',
      description: 'View system activity and audit trails',
      icon: <LogIcon sx={{ fontSize: 40, color: 'warning.main' }} />,
      color: 'warning.main'
    },
    {
      title: 'Session Settings',
      description: 'Configure session timeout and security settings',
      icon: <ScheduleIcon sx={{ fontSize: 40, color: 'error.main' }} />,
      color: 'error.main'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200" style={{ width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      <Box sx={{ 
        p: { xs: 1, sm: 2 }, 
        maxWidth: '100%', 
        width: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <Typography 
          variant="h4" 
          gutterBottom
          sx={{ 
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
            fontWeight: 400,
            lineHeight: 1.235
          }}
        >
          Admin Panel
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          System administration and configuration management
        </Typography>

      {tabValue === 0 && (
        <>
          <Grid container spacing={2} sx={{ 
            mb: 3, 
            maxWidth: '100%', 
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            {adminFeatures.map((feature, index) => (
              <Grid size={{ xs: 12, sm: 12, md: 6, lg: 4 }} key={feature.title}>
                <Card sx={{ 
                  height: '100%', 
                  width: '100%', 
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}>
                  <CardContent sx={{ 
                    p: { xs: 2, sm: 3 },
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      flexDirection: { xs: 'column', sm: 'row' },
                      textAlign: { xs: 'center', sm: 'left' }
                    }}>
                      {React.cloneElement(feature.icon, {
                        sx: { 
                          fontSize: { xs: 32, sm: 40 }, 
                          color: feature.color,
                          mb: { xs: 1, sm: 0 },
                          mr: { xs: 0, sm: 2 }
                        }
                      })}
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.25rem' },
                          fontWeight: 500
                        }}
                      >
                        {feature.title}
                      </Typography>
                    </Box>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        textAlign: { xs: 'center', sm: 'left' },
                        fontSize: { xs: '0.875rem', sm: '0.875rem' }
                      }}
                    >
                      {feature.description}
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={isMobile ? null : feature.icon}
                      onClick={() => setTabValue(index + 1)}
                      fullWidth
                      sx={{
                        py: { xs: 1.5, sm: 1 },
                        fontSize: { xs: '0.875rem', sm: '0.875rem' }
                      }}
                    >
                      {isMobile ? feature.title : `Open ${feature.title}`}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      <Paper sx={{ 
        width: '100%', 
        maxWidth: '100%', 
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="admin panel tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              width: '100%',
              boxSizing: 'border-box',
              '& .MuiTab-root': {
                minWidth: { xs: 70, sm: 100, md: 120 },
                fontSize: { xs: '0.6rem', sm: '0.75rem', md: '0.8rem' },
                py: { xs: 0.5, sm: 1 },
                px: { xs: 0.3, sm: 0.5, md: 1 },
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: 100, sm: 140, md: 160 }
              },
              '& .MuiTabs-scrollButtons': {
                display: { xs: 'flex', sm: 'flex' }
              },
              '& .MuiTabs-flexContainer': {
                overflow: 'hidden'
              }
            }}
          >
            <Tab
              label={isSmallMobile ? "Overview" : "Overview"}
              icon={<SettingsIcon />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label={isSmallMobile ? "Users" : "User Management"}
              icon={<PeopleIcon />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label={isSmallMobile ? "Analytics" : "Queue Analytics"}
              icon={<AnalyticsIcon />}
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              label={isSmallMobile ? "SMS" : "SMS Management"}
              icon={<MessageIcon />}
              iconPosition="start"
              {...a11yProps(3)}
            />
            <Tab
              label={isSmallMobile ? "Dropdown" : "Dropdown Management"}
              icon={<ListIcon />}
              iconPosition="start"
              {...a11yProps(4)}
            />
            <Tab
              label={isSmallMobile ? "Counters" : "Counter Management"}
              icon={<StoreIcon />}
              iconPosition="start"
              {...a11yProps(5)}
            />
            <Tab
              label={isSmallMobile ? "Logs" : "Activity Logs"}
              icon={<LogIcon />}
              iconPosition="start"
              {...a11yProps(6)}
            />
            <Tab
              label={isSmallMobile ? "Session" : "Session Settings"}
              icon={<ScheduleIcon />}
              iconPosition="start"
              {...a11yProps(7)}
            />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SettingsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Admin Management System
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select a tab above to access administrative functions
            </Typography>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <UserManagement />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <QueueAnalyticsDashboard />
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          <EnhancedSMSManagement />
        </TabPanel>
        
        <TabPanel value={tabValue} index={4}>
          <DropdownManagement />
        </TabPanel>
        
        <TabPanel value={tabValue} index={5}>
          <CounterManagement />
        </TabPanel>
        
        <TabPanel value={tabValue} index={6}>
          <ActivityLogs />
        </TabPanel>
        
        <TabPanel value={tabValue} index={7}>
          <SessionTimeoutSettings />
        </TabPanel>
      </Paper>
      </Box>
    </div>
  );
};

export default AdminPanel;
