import { QueueAnalyticsService, QueueMetrics, DailyQueueSummary } from './QueueAnalyticsService';
import { pool } from '../config/database';

export interface ExportOptions {
  startDate: string;
  endDate: string;
  type: 'hourly' | 'daily';
  format: 'csv' | 'json' | 'pdf' | 'sheets';
  includeProcessingMetrics?: boolean;
  title?: string;
  description?: string;
}

export interface ExportResult {
  data: any[];
  headers: string[];
  filename: string;
  contentType: string;
  metadata: {
    totalRecords: number;
    dateRange: {
      start: string;
      end: string;
    };
    exportType: string;
    generatedAt: string;
  };
}

export class AnalyticsExportService {
  
  /**
   * Enhanced header mappings for better export readability
   */
  private static readonly HEADER_MAPPINGS = {
    // Base fields
    'date': 'Date',
    'hour': 'Hour',
    'totalCustomers': 'Total Customers',
    'priorityCustomers': 'Priority Customers', 
    'avgWaitTimeMinutes': 'Average Wait Time (minutes)',
    'avgServiceTimeMinutes': 'Average Service Time (minutes)',
    'peakQueueLength': 'Peak Queue Length',
    'customersServed': 'Customers Served',
    
    // Processing duration fields - NEW
    'avgProcessingDurationMinutes': 'Average Processing Duration (minutes)',
    'totalProcessingCount': 'Total Items Processed',
    'maxProcessingDurationMinutes': 'Maximum Processing Duration (minutes)', 
    'minProcessingDurationMinutes': 'Minimum Processing Duration (minutes)',
    
    // Daily summary fields
    'peakHour': 'Peak Hour',
    'busiestCounterId': 'Busiest Counter ID'
  };

  /**
   * PDF-specific header mappings (shorter for space)
   */
  private static readonly PDF_HEADER_MAPPINGS = {
    'date': 'Date',
    'hour': 'Hr',
    'totalCustomers': 'Total',
    'priorityCustomers': 'Priority',
    'avgWaitTimeMinutes': 'Avg Wait (min)',
    'avgServiceTimeMinutes': 'Avg Service (min)',
    'peakQueueLength': 'Peak Queue',
    'customersServed': 'Served',
    'avgProcessingDurationMinutes': 'Avg Processing (min)',
    'totalProcessingCount': 'Processed',
    'maxProcessingDurationMinutes': 'Max Processing (min)',
    'minProcessingDurationMinutes': 'Min Processing (min)',
    'peakHour': 'Peak Hr',
    'busiestCounterId': 'Counter'
  };

  /**
   * Google Sheets column mappings with data types
   */
  private static readonly SHEETS_COLUMN_CONFIG = {
    'date': { header: 'Date', type: 'DATE' },
    'hour': { header: 'Hour', type: 'NUMBER' },
    'totalCustomers': { header: 'Total Customers', type: 'NUMBER' },
    'priorityCustomers': { header: 'Priority Customers', type: 'NUMBER' },
    'avgWaitTimeMinutes': { header: 'Avg Wait Time (min)', type: 'NUMBER', format: '0.00' },
    'avgServiceTimeMinutes': { header: 'Avg Service Time (min)', type: 'NUMBER', format: '0.00' },
    'peakQueueLength': { header: 'Peak Queue Length', type: 'NUMBER' },
    'customersServed': { header: 'Customers Served', type: 'NUMBER' },
    'avgProcessingDurationMinutes': { header: 'Avg Processing Duration (min)', type: 'NUMBER', format: '0.00' },
    'totalProcessingCount': { header: 'Total Processing Count', type: 'NUMBER' },
    'maxProcessingDurationMinutes': { header: 'Max Processing Duration (min)', type: 'NUMBER', format: '0.00' },
    'minProcessingDurationMinutes': { header: 'Min Processing Duration (min)', type: 'NUMBER', format: '0.00' },
    'peakHour': { header: 'Peak Hour', type: 'NUMBER' },
    'busiestCounterId': { header: 'Busiest Counter ID', type: 'NUMBER' }
  };

  /**
   * Exports analytics data with enhanced processing duration metrics
   */
  static async exportAnalytics(options: ExportOptions): Promise<ExportResult> {
    const { startDate, endDate, type, format, includeProcessingMetrics = true } = options;
    
    // Get the raw data
    let data: QueueMetrics[] | DailyQueueSummary[];
    if (type === 'hourly') {
      data = await QueueAnalyticsService.getQueueAnalytics(startDate, endDate);
    } else {
      data = await QueueAnalyticsService.getDailySummaries(startDate, endDate);
    }

    // Filter out processing metrics if not requested
    if (!includeProcessingMetrics) {
      data = data.map(row => {
        const filtered = { ...row };
        delete filtered.avgProcessingDurationMinutes;
        delete filtered.totalProcessingCount;
        delete filtered.maxProcessingDurationMinutes;
        delete filtered.minProcessingDurationMinutes;
        return filtered;
      });
    }

    // Get appropriate headers based on format
    const originalHeaders = data.length > 0 ? Object.keys(data[0]) : [];
    let headers: string[];
    
    switch (format) {
      case 'pdf':
        headers = originalHeaders.map(header => 
          this.PDF_HEADER_MAPPINGS[header] || this.HEADER_MAPPINGS[header] || header
        );
        break;
      case 'sheets':
        headers = originalHeaders.map(header => 
          this.SHEETS_COLUMN_CONFIG[header]?.header || this.HEADER_MAPPINGS[header] || header
        );
        break;
      default:
        headers = originalHeaders.map(header => this.HEADER_MAPPINGS[header] || header);
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `queue-analytics-${type}-${startDate}-${endDate}-${timestamp}.${format}`;

    // Determine content type
    const contentType = this.getContentType(format);

    return {
      data,
      headers,
      filename,
      contentType,
      metadata: {
        totalRecords: data.length,
        dateRange: { start: startDate, end: endDate },
        exportType: type,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Formats data for CSV export with processing duration metrics
   */
  static formatCSVData(data: any[], headers: string[]): string {
    if (data.length === 0) {
      return headers.join(',') + '\n';
    }

    const originalHeaders = Object.keys(data[0]);
    
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row =>
        originalHeaders.map(header => {
          const value = row[header];
          
          // Handle null/undefined values
          if (value === null || value === undefined) {
            return '0';
          }
          
          // Handle string values (escape quotes)
          if (typeof value === 'string') {
            return `"${value.replace(/"/g, '""')}"`;
          }
          
          // Handle numbers (format to 2 decimal places for metrics)
          if (typeof value === 'number') {
            if (header.includes('Minutes') || header.includes('Duration')) {
              return parseFloat(value.toFixed(2));
            }
            return value;
          }
          
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  /**
   * Generates PDF-compatible data structure
   */
  static formatPDFData(data: any[], headers: string[]): { 
    headers: string[], 
    rows: string[][],
    summary: any 
  } {
    const originalHeaders = Object.keys(data[0] || {});
    
    const rows = data.map(row =>
      originalHeaders.map(header => {
        const value = row[header];
        
        if (value === null || value === undefined) {
          return '0';
        }
        
        if (typeof value === 'number') {
          if (header.includes('Minutes') || header.includes('Duration')) {
            return value.toFixed(2);
          }
          return value.toString();
        }
        
        return value.toString();
      })
    );

    // Generate summary statistics
    const summary = this.generateSummaryStatistics(data);

    return { headers, rows, summary };
  }

  /**
   * Formats data for Google Sheets export
   */
  static formatSheetsData(data: any[]): {
    headers: { value: string, type: string, format?: string }[],
    rows: any[][],
    columnConfig: any
  } {
    const originalHeaders = Object.keys(data[0] || {});
    
    const headers = originalHeaders.map(header => ({
      value: this.SHEETS_COLUMN_CONFIG[header]?.header || header,
      type: this.SHEETS_COLUMN_CONFIG[header]?.type || 'STRING',
      format: this.SHEETS_COLUMN_CONFIG[header]?.format
    }));

    const rows = data.map(row =>
      originalHeaders.map(header => {
        const value = row[header];
        const config = this.SHEETS_COLUMN_CONFIG[header];
        
        if (value === null || value === undefined) {
          return config?.type === 'NUMBER' ? 0 : '';
        }
        
        return value;
      })
    );

    return {
      headers,
      rows,
      columnConfig: this.SHEETS_COLUMN_CONFIG
    };
  }

  /**
   * Generates summary statistics for reports
   */
  private static generateSummaryStatistics(data: any[]): any {
    if (data.length === 0) return {};

    const summary: any = {
      totalRecords: data.length,
      dateRange: {
        start: data[data.length - 1]?.date || 'Unknown',
        end: data[0]?.date || 'Unknown'
      }
    };

    // Calculate averages and totals for numeric fields
    const numericFields = [
      'totalCustomers', 'priorityCustomers', 'customersServed',
      'avgWaitTimeMinutes', 'avgServiceTimeMinutes', 
      'avgProcessingDurationMinutes', 'totalProcessingCount',
      'maxProcessingDurationMinutes', 'minProcessingDurationMinutes'
    ];

    numericFields.forEach(field => {
      const values = data
        .map(row => row[field])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        if (field.startsWith('avg') || field.includes('Duration') || field.includes('Minutes')) {
          summary[`${field}_avg`] = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        } else {
          summary[`${field}_total`] = values.reduce((a, b) => a + b, 0);
        }
        
        summary[`${field}_max`] = Math.max(...values);
        summary[`${field}_min`] = Math.min(...values);
      }
    });

    return summary;
  }

  /**
   * Gets content type for different export formats
   */
  private static getContentType(format: string): string {
    switch (format) {
      case 'csv':
        return 'text/csv; charset=utf-8';
      case 'json':
        return 'application/json';
      case 'pdf':
        return 'application/pdf';
      case 'sheets':
        return 'application/vnd.google-apps.spreadsheet';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Enhanced export with processing duration metrics for specific use cases
   */
  static async exportProcessingAnalytics(
    startDate: string, 
    endDate: string, 
    format: 'csv' | 'json' | 'pdf' = 'json'
  ): Promise<any> {
    const query = `
      SELECT 
        DATE(qe.created_at) as date,
        EXTRACT(HOUR FROM qe.created_at) as hour,
        COUNT(*) FILTER (WHERE processing_duration_minutes IS NOT NULL) as processing_events,
        AVG(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as avg_processing_duration,
        MAX(processing_duration_minutes) as max_processing_duration,
        MIN(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as min_processing_duration,
        STDDEV(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as processing_duration_stddev,
        -- Processing time distribution
        COUNT(*) FILTER (WHERE processing_duration_minutes < 5) as under_5min,
        COUNT(*) FILTER (WHERE processing_duration_minutes BETWEEN 5 AND 15) as between_5_15min,
        COUNT(*) FILTER (WHERE processing_duration_minutes BETWEEN 15 AND 30) as between_15_30min,
        COUNT(*) FILTER (WHERE processing_duration_minutes > 30) as over_30min
      FROM queue_events qe
      WHERE DATE(qe.created_at) BETWEEN $1 AND $2
      AND processing_duration_minutes IS NOT NULL
      GROUP BY DATE(qe.created_at), EXTRACT(HOUR FROM qe.created_at)
      ORDER BY date DESC, hour DESC
    `;

    const result = await pool.query(query, [startDate, endDate]);
    
    return {
      data: result.rows,
      summary: this.generateSummaryStatistics(result.rows),
      metadata: {
        totalRecords: result.rows.length,
        dateRange: { start: startDate, end: endDate },
        exportType: 'processing_analytics',
        generatedAt: new Date().toISOString()
      }
    };
  }
}
