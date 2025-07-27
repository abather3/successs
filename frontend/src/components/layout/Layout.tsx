import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import CircularLogo from '../CircularLogo';
import ThemeToggle from '../common/ThemeToggle';
import { NotificationBell } from '../notifications/NotificationBell'; // ISOLATED: Facebook-style notification bell

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

const menuItems = [
    { 
      text: 'Dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v14H8V5z" />
        </svg>
      ), 
      path: '/', 
      roles: ['admin', 'sales', 'cashier'] 
    },
    { 
      text: 'Customers', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ), 
      path: '/customers', 
      roles: ['admin', 'sales', 'cashier'] 
    },
    { 
      text: 'Queue', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2m-2 0v4a2 2 0 002 2h2a2 2 0 002-2v-4m0 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 11V9a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      ), 
      path: '/queue', 
      roles: ['admin', 'sales', 'cashier'] 
    },
    { 
      text: 'Display Monitor', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ), 
      path: '/display', 
      roles: ['admin', 'sales', 'cashier'] 
    },
    { 
      text: 'Transactions', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ), 
      path: '/transactions', 
      roles: ['admin', 'cashier'] 
    },
    { 
      text: 'Historical Analytics', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ), 
      path: '/analytics/history', 
      roles: ['admin', 'sales', 'cashier'] 
    },
    { 
      text: 'Admin Panel', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ), 
      path: '/admin', 
      roles: ['admin'] 
    },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openDisplayInNewWindow = () => {
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
      // Fallback if popup is blocked
      window.open(displayUrl, '_blank');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400';
      case 'sales': return 'bg-accent-100 dark:bg-accent-900/30 text-accent-800 dark:text-accent-400';
      case 'cashier': return 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-200">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <CircularLogo size={32} alt="EscaShop Logo" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">ESCA SHOP</h1>
            </div>
          </div>

          {/* User info and logout */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* ISOLATED: Facebook-style Notification Bell (Cashiers only) */}
            <NotificationBell className="text-gray-600 dark:text-gray-300" />
            <div className="hidden md:flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-32">{user?.full_name}</div>
                <div className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleColor(user?.role || '')}`}>
                  {user?.role?.toUpperCase()}
                </div>
              </div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            
            {/* Mobile user info */}
            <div className="md:hidden h-8 w-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              aria-label="Logout"
            >
              <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:relative lg:translate-x-0 z-30 w-64 h-screen lg:h-full bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transition-all duration-200 ease-in-out`}>
          <nav className="mt-6 px-3">
            <div className="space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const isDisplayMonitor = item.path === '/display';
                
                return (
                  <div key={item.text} className="relative">
                    <button
                      onClick={() => {
                        handleNavigation(item.path);
                        // Close sidebar on mobile after navigation
                        if (window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`${
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-400'
                          : 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      } group flex items-center px-3 py-3 text-sm font-medium border-l-4 transition-colors duration-200 w-full text-left touch-manipulation ${
                        isDisplayMonitor ? 'pr-10' : ''
                      }`}
                    >
                      <span className={`${
                        isActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                      } mr-3 transition-colors duration-200`}>
                        {item.icon}
                      </span>
                      {item.text}
                    </button>
                    
                    {/* Open in new window button for Display Monitor */}
                    {isDisplayMonitor && (
                      <button
                        onClick={openDisplayInNewWindow}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors duration-200"
                        title="Open Display Monitor in New Window"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 lg:ml-0">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
      
      {/* ISOLATED: Facebook-style Customer Registration Notifications */}
      {/* Toast notifications are now disabled - users access notifications via the bell icon */}
      {/* <CustomerNotificationManager enabled={true} /> */}
    </div>
  );
};

export default Layout;
