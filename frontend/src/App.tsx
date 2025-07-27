import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider as CustomThemeProvider, useTheme } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { UserRole } from './types';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './components/auth/Login';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import Dashboard from './components/dashboard/Dashboard';
import CustomerManagement from './components/customers/CustomerManagement';
import QueueManagement from './components/queue/QueueManagement';
import EnhancedTransactionManagement from './components/transactions/EnhancedTransactionManagement';
import AdminPanel from './components/admin/AdminPanel';
import HistoricalAnalyticsDashboard from './components/analytics/HistoricalAnalyticsDashboard';
import DisplayMonitor from './components/display/DisplayMonitor';
import StandaloneDisplayMonitor from './components/display/StandaloneDisplayMonitor';
import Layout from './components/layout/Layout';
import DarkModeWrapper from './components/common/DarkModeWrapper';
import SessionManager from './components/common/SessionManager';
import './App.css';

const createAppTheme = (darkMode: boolean) => createTheme({
  palette: {
    mode: darkMode ? 'dark' : 'light',
    primary: {
      main: '#FF6B35',
    },
    secondary: {
      main: '#2C3E50',
    },
    background: {
      default: darkMode ? '#111827' : '#f9fafb',
      paper: darkMode ? '#1f2937' : '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

const AppContent: React.FC = () => {
  const { darkMode } = useTheme();
  const theme = createAppTheme(darkMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DarkModeWrapper>
        <NotificationProvider>
          <AuthProvider>
            <SocketProvider>
              <Router>
                <SessionManager>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customers" element={
                  <ProtectedRoute>
                    <Layout>
                      <CustomerManagement />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customers/new" element={
                  <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SALES]}>
                    <Layout>
                      <CustomerManagement />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/queue" element={
                  <ProtectedRoute>
                    <Layout>
                      <QueueManagement />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/display" element={
                  <ProtectedRoute>
                    <Layout>
                      <DisplayMonitor />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/display-standalone" element={<StandaloneDisplayMonitor />} />
                <Route path="/transactions" element={
                  <ProtectedRoute>
                    <Layout>
                      <EnhancedTransactionManagement />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole={UserRole.ADMIN}>
                    <Layout>
                      <AdminPanel />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/analytics/history" element={
                  <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SALES, UserRole.CASHIER]}>
                    <Layout>
                      <HistoricalAnalyticsDashboard />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
                </SessionManager>
              </Router>
            </SocketProvider>
          </AuthProvider>
        </NotificationProvider>
      </DarkModeWrapper>
    </ThemeProvider>
  );
};

function App() {
  return (
    <CustomThemeProvider>
      <AppContent />
    </CustomThemeProvider>
  );
}

export default App;
