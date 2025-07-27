import { UserRole, QueueStatus, DistributionType, PaymentMode } from '../../types';
type Schema = any;

/**
 * Validation schema for creating a new customer
 */
export const createCustomerSchema: Schema = {
  name: {
    in: ['body'],
    notEmpty: {
      errorMessage: 'Customer name is required'
    },
    isLength: {
      options: { min: 2, max: 100 },
      errorMessage: 'Customer name must be between 2 and 100 characters'
    },
    trim: true
  },
  contact_number: {
    in: ['body'],
    notEmpty: {
      errorMessage: 'Contact number is required'
    },
    matches: {
      options: /^(\+\d{1,3}[- ]?\d{10,11}|\d{10,11})$/,
      errorMessage: 'Invalid contact number format'
    },
    trim: true
  },
  email: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isEmail: {
      errorMessage: 'Invalid email format'
    },
    trim: true
  },
  age: {
    in: ['body'],
    isInt: {
      options: { min: 1, max: 120 },
      errorMessage: 'Age must be between 1 and 120'
    },
    toInt: true
  },
  address: {
    in: ['body'],
    notEmpty: {
      errorMessage: 'Address is required'
    },
    isLength: {
      options: { min: 10, max: 500 },
      errorMessage: 'Address must be between 10 and 500 characters'
    },
    trim: true
  },
  occupation: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Occupation must be less than 100 characters'
    },
    trim: true
  },
  distribution_info: {
    in: ['body'],
    custom: {
      options: (value: any) => {
        return Object.values(DistributionType).includes(value);
      },
      errorMessage: 'Invalid distribution type'
    }
  },
  doctor_assigned: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Doctor name must be less than 100 characters'
    },
    trim: true
  },
  'prescription.od': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.os': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.ou': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.pd': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.add': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  grade_type: {
    in: ['body'],
    notEmpty: {
      errorMessage: 'Grade type is required'
    },
    trim: true
  },
  lens_type: {
    in: ['body'],
    notEmpty: {
      errorMessage: 'Lens type is required'
    },
    trim: true
  },
  frame_code: {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'estimated_time.days': {
    in: ['body'],
    isInt: {
      options: { min: 0, max: 30 },
      errorMessage: 'Estimated days must be between 0 and 30'
    },
    toInt: true
  },
  'estimated_time.hours': {
    in: ['body'],
    isInt: {
      options: { min: 0, max: 23 },
      errorMessage: 'Estimated hours must be between 0 and 23'
    },
    toInt: true
  },
  'estimated_time.minutes': {
    in: ['body'],
    isInt: {
      options: { min: 0, max: 59 },
      errorMessage: 'Estimated minutes must be between 0 and 59'
    },
    toInt: true
  },
  'payment_info.mode': {
    in: ['body'],
    custom: {
      options: (value: any) => {
        return Object.values(PaymentMode).includes(value);
      },
      errorMessage: 'Invalid payment mode'
    }
  },
  'payment_info.amount': {
    in: ['body'],
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Payment amount must be a positive number'
    },
    toFloat: true
  },
  remarks: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 1000 },
      errorMessage: 'Remarks must be less than 1000 characters'
    },
    trim: true
  },
  'priority_flags.senior_citizen': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'Senior citizen flag must be a boolean'
    },
    toBoolean: true
  },
  'priority_flags.pregnant': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'Pregnant flag must be a boolean'
    },
    toBoolean: true
  },
  'priority_flags.pwd': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'PWD flag must be a boolean'
    },
    toBoolean: true
  },
  create_initial_transaction: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'Create initial transaction flag must be a boolean'
    },
    toBoolean: true
  }
};

/**
 * Validation schema for updating a customer
 */
export const updateCustomerSchema: Schema = {
  id: {
    in: ['params'],
    isInt: {
      options: { min: 1 },
      errorMessage: 'Invalid customer ID'
    },
    toInt: true
  },
  name: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { min: 2, max: 100 },
      errorMessage: 'Customer name must be between 2 and 100 characters'
    },
    trim: true
  },
  contact_number: {
    in: ['body'],
    optional: { options: { nullable: true } },
    matches: {
      options: /^(\+\d{1,3}[- ]?\d{10,11}|\d{10,11})$/,
      errorMessage: 'Invalid contact number format'
    },
    trim: true
  },
  email: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isEmail: {
      errorMessage: 'Invalid email format'
    },
    trim: true
  },
  age: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 1, max: 120 },
      errorMessage: 'Age must be between 1 and 120'
    },
    toInt: true
  },
  address: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { min: 10, max: 500 },
      errorMessage: 'Address must be between 10 and 500 characters'
    },
    trim: true
  },
  occupation: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Occupation must be less than 100 characters'
    },
    trim: true
  },
  distribution_info: {
    in: ['body'],
    optional: { options: { nullable: true } },
    custom: {
      options: (value: any) => {
        return Object.values(DistributionType).includes(value);
      },
      errorMessage: 'Invalid distribution type'
    }
  },
  doctor_assigned: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Doctor name must be less than 100 characters'
    },
    trim: true
  },
  'prescription.od': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.os': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.ou': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.pd': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'prescription.add': {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  grade_type: {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  lens_type: {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  frame_code: {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  },
  'estimated_time.days': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 0, max: 30 },
      errorMessage: 'Estimated days must be between 0 and 30'
    },
    toInt: true
  },
  'estimated_time.hours': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 0, max: 23 },
      errorMessage: 'Estimated hours must be between 0 and 23'
    },
    toInt: true
  },
  'estimated_time.minutes': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 0, max: 59 },
      errorMessage: 'Estimated minutes must be between 0 and 59'
    },
    toInt: true
  },
  'payment_info.mode': {
    in: ['body'],
    optional: { options: { nullable: true } },
    custom: {
      options: (value: any) => {
        return Object.values(PaymentMode).includes(value);
      },
      errorMessage: 'Invalid payment mode'
    }
  },
  'payment_info.amount': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Payment amount must be a positive number'
    },
    toFloat: true
  },
  remarks: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 1000 },
      errorMessage: 'Remarks must be less than 1000 characters'
    },
    trim: true
  },
  'priority_flags.senior_citizen': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'Senior citizen flag must be a boolean'
    },
    toBoolean: true
  },
  'priority_flags.pregnant': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'Pregnant flag must be a boolean'
    },
    toBoolean: true
  },
  'priority_flags.pwd': {
    in: ['body'],
    optional: { options: { nullable: true } },
    isBoolean: {
      errorMessage: 'PWD flag must be a boolean'
    },
    toBoolean: true
  }
};

/**
 * Validation schema for updating customer status
 */
export const updateCustomerStatusSchema: Schema = {
  id: {
    in: ['params'],
    isInt: {
      options: { min: 1 },
      errorMessage: 'Invalid customer ID'
    },
    toInt: true
  },
  status: {
    in: ['body'],
    custom: {
      options: (value: any) => {
        return Object.values(QueueStatus).includes(value);
      },
      errorMessage: 'Invalid queue status'
    }
  }
};

/**
 * Validation schema for customer listing with filters
 */
export const listCustomersSchema: Schema = {
  status: {
    in: ['query'],
    optional: { options: { nullable: true } },
    custom: {
      options: (value: any) => {
        return Object.values(QueueStatus).includes(value);
      },
      errorMessage: 'Invalid status filter'
    }
  },
  salesAgentId: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 1 },
      errorMessage: 'Invalid sales agent ID'
    },
    toInt: true
  },
  startDate: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isISO8601: {
      errorMessage: 'Invalid start date format'
    },
    toDate: true
  },
  endDate: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isISO8601: {
      errorMessage: 'Invalid end date format'
    },
    toDate: true
  },
  searchTerm: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 100 },
      errorMessage: 'Search term must be less than 100 characters'
    },
    trim: true
  },
  sortBy: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isIn: {
      options: [['created_at', 'name', 'status', 'queue_position']],
      errorMessage: 'Invalid sort field'
    }
  },
  sortOrder: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isIn: {
      options: [['asc', 'desc']],
      errorMessage: 'Sort order must be asc or desc'
    }
  },
  page: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 1 },
      errorMessage: 'Page must be a positive integer'
    },
    toInt: true
  },
  limit: {
    in: ['query'],
    optional: { options: { nullable: true } },
    isInt: {
      options: { min: 1, max: 100 },
      errorMessage: 'Limit must be between 1 and 100'
    },
    toInt: true
  }
};

/**
 * Validation schema for customer notification
 */
export const notifyCustomerSchema: Schema = {
  id: {
    in: ['params'],
    isInt: {
      options: { min: 1 },
      errorMessage: 'Invalid customer ID'
    },
    toInt: true
  },
  type: {
    in: ['body'],
    isIn: {
      options: [['ready', 'delay', 'pickup_reminder', 'custom']],
      errorMessage: 'Invalid notification type'
    }
  },
  customMessage: {
    in: ['body'],
    optional: { options: { nullable: true } },
    isLength: {
      options: { max: 500 },
      errorMessage: 'Custom message must be less than 500 characters'
    },
    trim: true
  },
  estimated_time: {
    in: ['body'],
    optional: { options: { nullable: true } },
    trim: true
  }
};
