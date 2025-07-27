import React, { useState, useMemo } from 'react';
import { QueueStatus, QueueItem, Customer } from '../../types/queue';

interface CustomerQueueTableProps {
  queueItems: QueueItem[];
  isLoading?: boolean;
  onCallCustomer?: (customerId: number) => void;
  onMarkAsProcessing?: (customerId: number) => void;
  onCompleteService?: (customerId: number) => void;
  onCancelService?: (customerId: number) => void;
  userRole?: string;
  className?: string;
}

const CustomerQueueTable: React.FC<CustomerQueueTableProps> = ({
  queueItems,
  isLoading = false,
  onCallCustomer,
  onMarkAsProcessing,
  onCompleteService,
  onCancelService,
  userRole = 'cashier',
  className = ''
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  // Get status badge styling
  const getStatusBadge = (status: QueueStatus) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    
    switch (status) {
      case QueueStatus.WAITING:
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
      case QueueStatus.SERVING:
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
      case QueueStatus.PROCESSING:
        return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 animate-pulse`;
      case QueueStatus.COMPLETED:
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
      case QueueStatus.CANCELLED:
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300`;
    }
  };

  // Get status display text with icon
  const getStatusDisplay = (status: QueueStatus) => {
    const statusConfig = {
      [QueueStatus.WAITING]: { text: 'Waiting', icon: '⏳' },
      [QueueStatus.SERVING]: { text: 'Serving', icon: '👥' },
      [QueueStatus.PROCESSING]: { text: 'Processing', icon: '🔄' },
      [QueueStatus.COMPLETED]: { text: 'Completed', icon: '✅' },
      [QueueStatus.CANCELLED]: { text: 'Cancelled', icon: '❌' }
    };
    
    const config = statusConfig[status] || { text: status, icon: '❓' };
    return (
      <span className="flex items-center gap-1">
        <span>{config.icon}</span>
        {config.text}
      </span>
    );
  };

  // Check if user can perform actions based on role and status
  const canPerformAction = (action: string, customer: Customer) => {
    const isAuthorized = ['admin', 'cashier', 'sales'].includes(userRole.toLowerCase());
    
    if (!isAuthorized) return false;
    
    switch (action) {
      case 'call':
        return customer.queue_status === QueueStatus.WAITING;
      case 'markProcessing':
        return customer.queue_status === QueueStatus.SERVING && ['admin', 'cashier'].includes(userRole.toLowerCase());
      case 'complete':
        return [QueueStatus.SERVING, QueueStatus.PROCESSING].includes(customer.queue_status);
      case 'cancel':
        return customer.queue_status !== QueueStatus.COMPLETED && customer.queue_status !== QueueStatus.CANCELLED;
      default:
        return false;
    }
  };

  // Priority indicator
  const PriorityIndicator: React.FC<{ customer: Customer }> = ({ customer }) => {
    const hasPriority = customer.priority_flags?.senior_citizen || 
                       customer.priority_flags?.pregnant || 
                       customer.priority_flags?.pwd;
    
    if (!hasPriority) return null;
    
    const priorityTypes = [];
    if (customer.priority_flags.senior_citizen) priorityTypes.push('👴 Senior');
    if (customer.priority_flags.pregnant) priorityTypes.push('🤱 Pregnant');
    if (customer.priority_flags.pwd) priorityTypes.push('♿ PWD');
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {priorityTypes.map((type, index) => (
          <span 
            key={index}
            className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded"
          >
            {type}
          </span>
        ))}
      </div>
    );
  };

  // Action buttons component
  const ActionButtons: React.FC<{ customer: Customer }> = ({ customer }) => (
    <div className="flex flex-wrap gap-2">
      {/* Call Customer */}
      {canPerformAction('call', customer) && onCallCustomer && (
        <button
          onClick={() => onCallCustomer(customer.id)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 
                   transition-colors duration-200 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          📢 Call
        </button>
      )}

      {/* Mark as Processing */}
      {canPerformAction('markProcessing', customer) && onMarkAsProcessing && (
        <button
          onClick={() => onMarkAsProcessing(customer.id)}
          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 
                   transition-colors duration-200 dark:bg-purple-500 dark:hover:bg-purple-600"
        >
          🔄 Mark as Processing
        </button>
      )}

      {/* Serve/Complete */}
      {canPerformAction('complete', customer) && onCompleteService && (
        <button
          onClick={() => onCompleteService(customer.id)}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 
                   transition-colors duration-200 dark:bg-green-500 dark:hover:bg-green-600"
        >
          ✅ {customer.queue_status === QueueStatus.SERVING ? 'Serve' : 'Complete'}
        </button>
      )}

      {/* Cancel */}
      {canPerformAction('cancel', customer) && onCancelService && (
        <button
          onClick={() => onCancelService(customer.id)}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 
                   transition-colors duration-200 dark:bg-red-500 dark:hover:bg-red-600"
        >
          ❌ Cancel
        </button>
      )}
    </div>
  );

  const sortedQueueItems = useMemo(() => {
    return [...queueItems].sort((a, b) => {
      // Sort by position first, then by priority score
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return b.priority_score - a.priority_score;
    });
  }, [queueItems]);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Customer Queue ({queueItems.length})
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Real-time queue management with processing status
        </p>
      </div>

      <div className="overflow-x-auto">
        {sortedQueueItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">🏪</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">No customers in queue</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              New customers will appear here automatically
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Wait Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedQueueItems.map((item, index) => (
                <tr
                  key={item.customer_id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
                    selectedCustomer === item.customer_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => setSelectedCustomer(
                    selectedCustomer === item.customer_id ? null : item.customer_id
                  )}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        #{item.position}
                      </span>
                      {item.customer.token_number && (
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          Token: {item.customer.token_number}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {item.customer.name}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        OR: {item.customer.or_number}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {item.customer.contact_number}
                      </div>
                      <PriorityIndicator customer={item.customer} />
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(item.customer.queue_status)}>
                      {getStatusDisplay(item.customer.queue_status)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {item.estimated_wait_time > 0 ? (
                      <div>
                        <div className="font-medium">
                          ~{Math.round(item.estimated_wait_time)}m
                        </div>
                        <div className="text-xs opacity-75">
                          estimated
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        Score: {item.priority_score}
                      </div>
                      {item.priority_score > 1 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400">
                          ⭐ Priority customer
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ActionButtons customer={item.customer} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with summary */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>
              Total: <strong>{queueItems.length}</strong>
            </span>
            <span>
              Waiting: <strong>{queueItems.filter(item => item.customer.queue_status === QueueStatus.WAITING).length}</strong>
            </span>
            <span>
              Processing: <strong className="text-purple-600 dark:text-purple-400">
                {queueItems.filter(item => item.customer.queue_status === QueueStatus.PROCESSING).length}
              </strong>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerQueueTable;
