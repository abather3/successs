import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SalesAgentDashboard from '../sales/SalesAgentDashboard';
import CashierDashboard from './CashierDashboard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    {
      title: 'Customer Registration',
      description: user?.role === 'sales' ? 'Register and manage your customers and their prescriptions' : 'Register new customers and manage their prescriptions',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      path: '/customers',
      bgColor: 'bg-primary-500',
      hoverColor: 'hover:bg-primary-600',
      roles: ['admin', 'sales']
    },
    {
      title: 'Queue Management',
      description: 'Manage customer queue and serving status',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2m-2 0v4a2 2 0 002 2h2a2 2 0 002-2v-4m0 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 11V9a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      ),
      path: '/queue',
      bgColor: 'bg-accent-500',
      hoverColor: 'hover:bg-accent-600',
      roles: ['admin', 'sales', 'cashier']
    },
    {
      title: 'Transaction Reports',
      description: 'View daily sales and financial reports',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      path: '/transactions',
      bgColor: 'bg-secondary-600',
      hoverColor: 'hover:bg-secondary-700',
      roles: ['admin', 'cashier']
    },
    {
      title: 'Admin Panel',
      description: 'System administration and user management',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      path: '/admin',
      bgColor: 'bg-primary-600',
      hoverColor: 'hover:bg-primary-700',
      roles: ['admin']
    }
  ];

  const filteredActions = quickActions.filter(action => 
    user && action.roles.includes(user.role)
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-primary-600 dark:text-primary-400';
      case 'sales': return 'text-accent-600 dark:text-accent-400';
      case 'cashier': return 'text-secondary-600 dark:text-secondary-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

// Show Sales Agent Dashboard for sales users
  if (user?.role === 'sales') {
    return <SalesAgentDashboard />;
  }
  // Show Cashier Dashboard for cashier users
  if (user?.role === 'cashier') {
    return <CashierDashboard />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Welcome back, <span className="font-semibold">{user?.full_name}</span>!
        </p>
      </div>

      {/* User Information Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-200">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{user?.email}</p>
          </div>
          <div className="">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</p>
            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 ${getRoleColor(user?.role || '')}`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
          <div className="">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
            <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
              {user?.status?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredActions.map((action) => (
            <div key={action.title} className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-medium transition-all duration-200">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className={`flex items-center justify-center w-12 h-12 ${action.bgColor} text-white rounded-lg mr-4`}>
                    {action.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{action.title}</h3>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  {action.description}
                </p>
                
                <button
                  onClick={() => navigate(action.path)}
                  className={`w-full ${action.bgColor} ${action.hoverColor} text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md`}
                >
                  {action.icon}
                  <span>Open {action.title}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
