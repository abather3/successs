/**
 * Export Helper Utility
 * Provides robust export functionality with proper error handling
 */

interface ExportOptions {
  format: 'excel' | 'pdf' | 'sheets';
  endpoint: string;
  filename?: string;
  method?: 'GET' | 'POST';
  body?: any;
}

interface ExportResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class ExportHelper {
  private static getAuthToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private static async downloadBlob(blob: Blob, filename: string): Promise<void> {
    try {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  private static async handleResponse(response: Response, format: string, filename: string): Promise<ExportResult> {
    console.log(`[ExportHelper] Handling ${format} export response, status: ${response.status}`);
    
    if (!response.ok) {
      // Try to get error message from response
      const contentType = response.headers.get('content-type');
      console.log(`[ExportHelper] Error response content-type: ${contentType}`);
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.error || `Failed to export to ${format.toUpperCase()}`
          };
        } catch (jsonError) {
          console.error('[ExportHelper] Failed to parse error JSON:', jsonError);
          return {
            success: false,
            error: `Export failed: ${response.status} ${response.statusText}`
          };
        }
      } else {
        return {
          success: false,
          error: `Export failed: ${response.status} ${response.statusText}`
        };
      }
    }

    // Handle successful response
    const contentType = response.headers.get('content-type');
    console.log(`[ExportHelper] Success response content-type: ${contentType}`);

    if (format === 'sheets') {
      // Google Sheets export should return JSON
      if (contentType && contentType.includes('application/json')) {
        try {
          const result = await response.json();
          return {
            success: true,
            message: 'Data exported to Google Sheets successfully!'
          };
        } catch (jsonError) {
          console.error('[ExportHelper] Failed to parse success JSON for sheets:', jsonError);
          return {
            success: false,
            error: 'Invalid response from Google Sheets export'
          };
        }
      } else {
        return {
          success: false,
          error: 'Invalid response format from Google Sheets export'
        };
      }
    } else {
      // Excel/PDF exports should return binary data
      if (contentType && contentType.includes('application/json')) {
        // This means an error was returned as JSON despite status 200
        try {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.error || `Failed to export to ${format.toUpperCase()}`
          };
        } catch (jsonError) {
          console.error('[ExportHelper] Failed to parse unexpected JSON:', jsonError);
          return {
            success: false,
            error: 'Unexpected response format'
          };
        }
      } else {
        // This is the expected binary file
        try {
          const blob = await response.blob();
          if (blob.size === 0) {
            return {
              success: false,
              error: 'Received empty file'
            };
          }
          
          await this.downloadBlob(blob, filename);
          return {
            success: true,
            message: `File exported to ${format.toUpperCase()} successfully!`
          };
        } catch (blobError) {
          console.error('[ExportHelper] Failed to process blob:', blobError);
          return {
            success: false,
            error: 'Failed to process downloaded file'
          };
        }
      }
    }
  }

  public static async exportData(options: ExportOptions): Promise<ExportResult> {
    const { format, endpoint, filename, method = 'GET', body } = options;
    
    console.log(`[ExportHelper] Starting ${format} export to ${endpoint}`);
    
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'Authentication token not found. Please log in again.'
      };
    }

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(method === 'POST' && { 'Content-Type': 'application/json' })
        }
      };

      if (method === 'POST' && body) {
        requestOptions.body = JSON.stringify(body);
      }

      console.log(`[ExportHelper] Making ${method} request to ${endpoint}`);
      const response = await fetch(endpoint, requestOptions);
      
      const defaultFilename = filename || `export.${format === 'excel' ? 'xlsx' : format}`;
      return await this.handleResponse(response, format, defaultFilename);
      
    } catch (error) {
      console.error(`[ExportHelper] Network error during ${format} export:`, error);
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Convenience methods for specific export types
  public static async exportCustomerToExcel(customerId: number): Promise<ExportResult> {
    return this.exportData({
      format: 'excel',
      endpoint: `/api/customers/${customerId}/export/excel`,
      filename: `customer-${customerId}.xlsx`
    });
  }

  public static async exportCustomerToPDF(customerId: number): Promise<ExportResult> {
    return this.exportData({
      format: 'pdf',
      endpoint: `/api/customers/${customerId}/export/pdf`,
      filename: `customer-${customerId}.pdf`
    });
  }

  public static async exportCustomerToSheets(customerId: number): Promise<ExportResult> {
    return this.exportData({
      format: 'sheets',
      endpoint: `/api/customers/${customerId}/export/sheets`,
      method: 'POST',
      body: {}
    });
  }

  public static async exportCustomersToExcel(filters?: any): Promise<ExportResult> {
    return this.exportData({
      format: 'excel',
      endpoint: '/api/customers/export/excel',
      method: 'POST',
      filename: 'customers-export.xlsx',
      body: filters || {}
    });
  }

  public static async exportCustomersToPDF(filters?: any): Promise<ExportResult> {
    return this.exportData({
      format: 'pdf',
      endpoint: '/api/customers/export/pdf',
      method: 'POST',
      filename: 'customers-export.pdf',
      body: filters || {}
    });
  }

  public static async exportCustomersToSheets(filters?: any): Promise<ExportResult> {
    return this.exportData({
      format: 'sheets',
      endpoint: '/api/customers/export/sheets',
      method: 'POST',
      body: filters || {}
    });
  }
}
