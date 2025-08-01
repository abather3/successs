import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import axios from 'axios';
import { CustomerService } from './customer';
import { Customer } from '../types';
import { config } from '../config/config';

export class ExportService {
  private static GOOGLE_SHEETS_URL = config.GOOGLE_SHEETS_URL;

  /**
   * Export single customer to Excel
   */
  static async exportCustomerToExcel(customerId: number): Promise<Buffer> {
    try {
      console.log(`[ExportService] Starting Excel export for customer ID: ${customerId}`);
      
      const customer = await CustomerService.findById(customerId);
      if (!customer) {
        console.error(`[ExportService] Customer not found: ${customerId}`);
        throw new Error('Customer not found');
      }
      
      console.log(`[ExportService] Found customer: ${customer.name} (${customer.or_number})`);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Customer Data');

      // Add headers
      const headers = [
        'Customer Name', 'Contact Number', 'Email', 'Age', 'Address',
        'Occupation', 'Distribution Method', 'Sales Agent', 'Doctor Assigned',
        'OD (Right Eye)', 'OS (Left Eye)', 'OU (Both Eyes)', 'PD (Pupillary Distance)',
        'ADD (Addition)', 'Grade Type', 'Lens Type', 'Frame Code', 'Payment Method',
        'Payment Amount', 'OR Number', 'Priority Flags', 'Remarks', 'Queue Status', 'Token Number',
        'Estimated Time (min)', 'Registration Date'
      ];

      worksheet.addRow(headers);

      // Format headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4285F4' }
      };

      // Add customer data
      const rowData = this.formatCustomerData(customer);
      worksheet.addRow(rowData);

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      // Generate buffer
      console.log(`[ExportService] Generating Excel buffer for customer ${customer.name}`);
      const buffer = await workbook.xlsx.writeBuffer();
      console.log(`[ExportService] Excel export completed successfully, buffer size: ${buffer.byteLength}`);
      return Buffer.from(buffer);
    } catch (error) {
      console.error(`[ExportService] Error in exportCustomerToExcel:`, error);
      throw error;
    }
  }

  /**
   * Export single customer to PDF
   */
  static async exportCustomerToPDF(customerId: number): Promise<Buffer> {
    const customer = await CustomerService.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('EscaShop Optical - Customer Details', 20, 20);
    
    // Customer info
    doc.setFontSize(12);
    let y = 40;
    const lineHeight = 8;
    
    const customerInfo = [
      `Customer Name: ${customer.name}`,
      `Contact Number: ${customer.contact_number}`,
      `Email: ${customer.email || 'N/A'}`,
      `Age: ${customer.age}`,
      `Address: ${customer.address}`,
      `Occupation: ${customer.occupation || 'N/A'}`,
      `Distribution Method: ${customer.distribution_info}`,
      `Sales Agent: ${customer.sales_agent_name || 'N/A'}`,
      `Doctor Assigned: ${customer.doctor_assigned || 'N/A'}`,
      '',
      'Prescription Details:',
      `OD (Right Eye): ${customer.prescription.od}`,
      `OS (Left Eye): ${customer.prescription.os}`,
      `OU (Both Eyes): ${customer.prescription.ou}`,
      `PD (Pupillary Distance): ${customer.prescription.pd}`,
      `ADD (Addition): ${customer.prescription.add}`,
      `Grade Type: ${customer.grade_type}`,
      `Lens Type: ${customer.lens_type}`,
      `Frame Code: ${customer.frame_code}`,
      '',
      'Payment Information:',
      `Payment Method: ${this.formatPaymentMode(customer.payment_info.mode)}`,
      `Payment Amount: ₱${customer.payment_info.amount}`,
      `OR Number: ${customer.or_number}`,
      '',
      'Additional Information:',
      `Priority Flags: ${this.formatPriorityFlags(customer.priority_flags)}`,
      `Remarks: ${customer.remarks || 'N/A'}`,
      `Queue Status: ${customer.queue_status}`,
      `Token Number: #${customer.token_number}`,
      `Estimated Time: ${customer.estimated_time} minutes`,
      `Registration Date: ${new Date(customer.created_at).toLocaleDateString()}`
    ];

    customerInfo.forEach(line => {
      if (line === '') {
        y += lineHeight / 2;
        return;
      }
      
      if (line.includes(':') && !line.startsWith('  ')) {
        if (line.endsWith(':')) {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
      }
      
      doc.text(line, 20, y);
      y += lineHeight;
      
      // Add new page if needed
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Export single customer to Google Sheets
   */
  static async exportCustomerToGoogleSheets(customerId: number): Promise<any> {
    const customer = await CustomerService.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (!this.GOOGLE_SHEETS_URL) {
      throw new Error('Google Sheets URL not configured');
    }

    const response = await axios.post(this.GOOGLE_SHEETS_URL, {
      action: 'single',
      customer: customer
    });

    return response.data;
  }

  /**
   * Export multiple customers to Excel
   */
  static async exportCustomersToExcel(searchTerm?: string, statusFilter?: string, dateFilter?: { start: string, end: string }): Promise<Buffer> {
    const filters = {
      searchTerm,
      status: statusFilter as any,
      startDate: dateFilter?.start ? new Date(dateFilter.start) : undefined,
      endDate: dateFilter?.end ? new Date(dateFilter.end) : undefined
    };

    const result = await CustomerService.list(filters, 1000, 0); // Get up to 1000 customers
    const customers = result.customers;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    // Add headers
    const headers = [
      'Customer Name', 'Contact Number', 'Email', 'Age', 'Address',
      'Occupation', 'Distribution Method', 'Sales Agent', 'Doctor Assigned',
      'OD (Right Eye)', 'OS (Left Eye)', 'OU (Both Eyes)', 'PD (Pupillary Distance)',
      'ADD (Addition)', 'Grade Type', 'Lens Type', 'Frame Code', 'Payment Method',
      'Payment Amount', 'OR Number', 'Priority Flags', 'Remarks', 'Queue Status', 'Token Number',
      'Estimated Time (min)', 'Registration Date'
    ];

    worksheet.addRow(headers);

    // Format headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4285F4' }
    };

    // Add customer data
    customers.forEach(customer => {
      const rowData = this.formatCustomerData(customer);
      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export multiple customers to PDF
   */
  static async exportCustomersToPDF(searchTerm?: string, statusFilter?: string, dateFilter?: { start: string, end: string }): Promise<Buffer> {
    const filters = {
      searchTerm,
      status: statusFilter as any,
      startDate: dateFilter?.start ? new Date(dateFilter.start) : undefined,
      endDate: dateFilter?.end ? new Date(dateFilter.end) : undefined
    };

    const result = await CustomerService.list(filters, 1000, 0);
    const customers = result.customers;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('EscaShop Optical - Customer List', 20, 20);
    
    doc.setFontSize(10);
    let y = 40;
    const lineHeight = 6;
    
    // Headers
    doc.setFont('helvetica', 'bold');
    doc.text('Name', 20, y);
    doc.text('Contact', 70, y);
    doc.text('Amount', 120, y);
    doc.text('OR #', 150, y);
    doc.text('Status', 175, y);
    y += lineHeight;
    
    // Draw line
    doc.line(20, y, 200, y);
    y += lineHeight;
    
    // Customer data
    doc.setFont('helvetica', 'normal');
    customers.forEach(customer => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(customer.name.substring(0, 15), 20, y);
      doc.text(customer.contact_number, 70, y);
      doc.text(`₱${customer.payment_info.amount}`, 120, y);
      doc.text(customer.or_number, 150, y);
      doc.text(customer.queue_status.substring(0, 10), 175, y);
      y += lineHeight;
    });

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Export multiple customers to Google Sheets
   */
  static async exportCustomersToGoogleSheets(searchTerm?: string, statusFilter?: string, dateFilter?: { start: string, end: string }): Promise<any> {
    const filters = {
      searchTerm,
      status: statusFilter as any,
      startDate: dateFilter?.start ? new Date(dateFilter.start) : undefined,
      endDate: dateFilter?.end ? new Date(dateFilter.end) : undefined
    };

    const result = await CustomerService.list(filters, 1000, 0);
    const customers = result.customers;

    if (!this.GOOGLE_SHEETS_URL) {
      throw new Error('Google Sheets URL not configured');
    }

    const response = await axios.post(this.GOOGLE_SHEETS_URL, {
      action: 'bulk',
      customers: customers
    });

    return response.data;
  }

  /**
   * Format customer data for export
   */
  private static formatCustomerData(customer: Customer): any[] {
    return [
      customer.name,
      customer.contact_number,
      customer.email || '',
      customer.age,
      customer.address,
      customer.occupation || '',
      customer.distribution_info,
      customer.sales_agent_name || '',
      customer.doctor_assigned || '',
      customer.prescription.od,
      customer.prescription.os,
      customer.prescription.ou,
      customer.prescription.pd,
      customer.prescription.add,
      customer.grade_type,
      customer.lens_type,
      customer.frame_code,
      this.formatPaymentMode(customer.payment_info.mode),
      `₱${customer.payment_info.amount}`,
      customer.or_number,
      this.formatPriorityFlags(customer.priority_flags),
      customer.remarks || '',
      customer.queue_status,
      customer.token_number,
      customer.estimated_time,
      new Date(customer.created_at).toLocaleDateString()
    ];
  }

  /**
   * Format payment mode for display
   */
  private static formatPaymentMode(mode: string): string {
    const labels: { [key: string]: string } = {
      'gcash': 'GCash',
      'maya': 'Maya',
      'bank_transfer': 'Bank Transfer',
      'credit_card': 'Credit Card',
      'cash': 'Cash'
    };
    return labels[mode] || mode;
  }

  /**
   * Format priority flags for display
   */
  private static formatPriorityFlags(flags: any): string {
    const priorities: string[] = [];
    if (flags.senior_citizen) priorities.push('Senior Citizen');
    if (flags.pregnant) priorities.push('Pregnant');
    if (flags.pwd) priorities.push('PWD');
    return priorities.join(', ') || 'None';
  }
}
