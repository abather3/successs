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
export declare class AnalyticsExportService {
    /**
     * Enhanced header mappings for better export readability
     */
    private static readonly HEADER_MAPPINGS;
    /**
     * PDF-specific header mappings (shorter for space)
     */
    private static readonly PDF_HEADER_MAPPINGS;
    /**
     * Google Sheets column mappings with data types
     */
    private static readonly SHEETS_COLUMN_CONFIG;
    /**
     * Exports analytics data with enhanced processing duration metrics
     */
    static exportAnalytics(options: ExportOptions): Promise<ExportResult>;
    /**
     * Formats data for CSV export with processing duration metrics
     */
    static formatCSVData(data: any[], headers: string[]): string;
    /**
     * Generates PDF-compatible data structure
     */
    static formatPDFData(data: any[], headers: string[]): {
        headers: string[];
        rows: string[][];
        summary: any;
    };
    /**
     * Formats data for Google Sheets export
     */
    static formatSheetsData(data: any[]): {
        headers: {
            value: string;
            type: string;
            format?: string;
        }[];
        rows: any[][];
        columnConfig: any;
    };
    /**
     * Generates summary statistics for reports
     */
    private static generateSummaryStatistics;
    /**
     * Gets content type for different export formats
     */
    private static getContentType;
    /**
     * Enhanced export with processing duration metrics for specific use cases
     */
    static exportProcessingAnalytics(startDate: string, endDate: string, format?: 'csv' | 'json' | 'pdf'): Promise<any>;
}
//# sourceMappingURL=AnalyticsExportService.d.ts.map