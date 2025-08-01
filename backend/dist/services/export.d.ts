export declare class ExportService {
    private static GOOGLE_SHEETS_URL;
    /**
     * Export single customer to Excel
     */
    static exportCustomerToExcel(customerId: number): Promise<Buffer>;
    /**
     * Export single customer to PDF
     */
    static exportCustomerToPDF(customerId: number): Promise<Buffer>;
    /**
     * Export single customer to Google Sheets
     */
    static exportCustomerToGoogleSheets(customerId: number): Promise<any>;
    /**
     * Export multiple customers to Excel
     */
    static exportCustomersToExcel(searchTerm?: string, statusFilter?: string, dateFilter?: {
        start: string;
        end: string;
    }): Promise<Buffer>;
    /**
     * Export multiple customers to PDF
     */
    static exportCustomersToPDF(searchTerm?: string, statusFilter?: string, dateFilter?: {
        start: string;
        end: string;
    }): Promise<Buffer>;
    /**
     * Export multiple customers to Google Sheets
     */
    static exportCustomersToGoogleSheets(searchTerm?: string, statusFilter?: string, dateFilter?: {
        start: string;
        end: string;
    }): Promise<any>;
    /**
     * Format customer data for export
     */
    private static formatCustomerData;
    /**
     * Format payment mode for display
     */
    private static formatPaymentMode;
    /**
     * Format priority flags for display
     */
    private static formatPriorityFlags;
}
//# sourceMappingURL=export.d.ts.map