const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/escashop',
});

// Sample data
const sampleTransactions = [
  // Today's transactions
  {
    customer_id: 1,
    or_number: 'OR-2025-001',
    amount: 1500.00,
    payment_mode: 'cash',
    sales_agent_id: 1,
    cashier_id: 1,
    transaction_date: new Date()
  },
  {
    customer_id: 2,
    or_number: 'OR-2025-002',
    amount: 2250.50,
    payment_mode: 'gcash',
    sales_agent_id: 1,
    cashier_id: 1,
    transaction_date: new Date()
  },
  {
    customer_id: 3,
    or_number: 'OR-2025-003',
    amount: 800.75,
    payment_mode: 'maya',
    sales_agent_id: 2,
    cashier_id: 1,
    transaction_date: new Date()
  },
  {
    customer_id: 4,
    or_number: 'OR-2025-004',
    amount: 3200.00,
    payment_mode: 'credit_card',
    sales_agent_id: 2,
    cashier_id: 1,
    transaction_date: new Date()
  },
  {
    customer_id: 5,
    or_number: 'OR-2025-005',
    amount: 1800.25,
    payment_mode: 'bank_transfer',
    sales_agent_id: 1,
    cashier_id: 1,
    transaction_date: new Date()
  },
  // Yesterday's transactions
  {
    customer_id: 6,
    or_number: 'OR-2025-006',
    amount: 950.00,
    payment_mode: 'cash',
    sales_agent_id: 2,
    cashier_id: 1,
    transaction_date: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
  },
  {
    customer_id: 7,
    or_number: 'OR-2025-007',
    amount: 1100.50,
    payment_mode: 'gcash',
    sales_agent_id: 1,
    cashier_id: 1,
    transaction_date: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
  },
  // Day before yesterday
  {
    customer_id: 8,
    or_number: 'OR-2025-008',
    amount: 750.00,
    payment_mode: 'maya',
    sales_agent_id: 2,
    cashier_id: 1,
    transaction_date: new Date(Date.now() - 48 * 60 * 60 * 1000) // Day before yesterday
  },
  {
    customer_id: 9,
    or_number: 'OR-2025-009',
    amount: 2500.00,
    payment_mode: 'credit_card',
    sales_agent_id: 1,
    cashier_id: 1,
    transaction_date: new Date(Date.now() - 48 * 60 * 60 * 1000) // Day before yesterday
  },
  {
    customer_id: 10,
    or_number: 'OR-2025-010',
    amount: 1200.75,
    payment_mode: 'bank_transfer',
    sales_agent_id: 2,
    cashier_id: 1,
    transaction_date: new Date(Date.now() - 48 * 60 * 60 * 1000) // Day before yesterday
  }
];

// Sample users data
const sampleUsers = [
  {
    email: 'admin@escashop.com',
    full_name: 'System Administrator',
    password_hash: '$2b$12$Xg7s8k9J0Ym5XKd0QqZt4eN2vH6L8mP4gF9s1R7uT3yW2V1C5q8Z3x',
    role: 'admin'
  },
  {
    email: 'sales@escashop.com',
    full_name: 'John Sales Agent',
    password_hash: '$2b$12$Xg7s8k9J0Ym5XKd0QqZt4eN2vH6L8mP4gF9s1R7uT3yW2V1C5q8Z3x',
    role: 'sales'
  },
  {
    email: 'cashier@escashop.com',
    full_name: 'Mary Cashier',
    password_hash: '$2b$12$Xg7s8k9J0Ym5XKd0QqZt4eN2vH6L8mP4gF9s1R7uT3yW2V1C5q8Z3x',
    role: 'cashier'
  }
];

// Sample customers data  
const sampleCustomers = [
  { or_number: 'OR-2025-001', name: 'Alice Johnson', contact_number: '+1234567890', email: 'alice@example.com', age: 25, address: '123 Main St', grade_type: 'Single Vision', lens_type: 'CR-39', distribution_info: 'pickup', sales_agent_id: 1, prescription: '{}', payment_info: '{"mode":"cash","amount":1500}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 1 },
  { or_number: 'OR-2025-002', name: 'Bob Smith', contact_number: '+1234567891', email: 'bob@example.com', age: 30, address: '456 Oak Ave', grade_type: 'Progressive', lens_type: 'Polycarbonate', distribution_info: 'lalamove', sales_agent_id: 1, prescription: '{}', payment_info: '{"mode":"gcash","amount":2250.50}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 2 },
  { or_number: 'OR-2025-003', name: 'Carol Davis', contact_number: '+1234567892', email: 'carol@example.com', age: 28, address: '789 Pine Rd', grade_type: 'Bifocal', lens_type: 'High Index', distribution_info: 'lbc', sales_agent_id: 2, prescription: '{}', payment_info: '{"mode":"maya","amount":800.75}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 3 },
  { or_number: 'OR-2025-004', name: 'David Wilson', contact_number: '+1234567893', email: 'david@example.com', age: 35, address: '321 Elm St', grade_type: 'Single Vision', lens_type: 'Trivex', distribution_info: 'pickup', sales_agent_id: 2, prescription: '{}', payment_info: '{"mode":"credit_card","amount":3200}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 4 },
  { or_number: 'OR-2025-005', name: 'Eva Brown', contact_number: '+1234567894', email: 'eva@example.com', age: 32, address: '654 Maple Dr', grade_type: 'Progressive', lens_type: 'CR-39', distribution_info: 'lalamove', sales_agent_id: 1, prescription: '{}', payment_info: '{"mode":"bank_transfer","amount":1800.25}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 5 },
  { or_number: 'OR-2025-006', name: 'Frank Green', contact_number: '+1234567895', email: 'frank@example.com', age: 40, address: '987 Cedar Ln', grade_type: 'Bifocal', lens_type: 'Polycarbonate', distribution_info: 'pickup', sales_agent_id: 2, prescription: '{}', payment_info: '{"mode":"cash","amount":950}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 6 },
  { or_number: 'OR-2025-007', name: 'Grace Lee', contact_number: '+1234567896', email: 'grace@example.com', age: 27, address: '147 Birch Ct', grade_type: 'Single Vision', lens_type: 'High Index', distribution_info: 'lbc', sales_agent_id: 1, prescription: '{}', payment_info: '{"mode":"gcash","amount":1100.50}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 7 },
  { or_number: 'OR-2025-008', name: 'Henry White', contact_number: '+1234567897', email: 'henry@example.com', age: 38, address: '258 Spruce St', grade_type: 'Progressive', lens_type: 'Trivex', distribution_info: 'pickup', sales_agent_id: 2, prescription: '{}', payment_info: '{"mode":"maya","amount":750}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 8 },
  { or_number: 'OR-2025-009', name: 'Iris Black', contact_number: '+1234567898', email: 'iris@example.com', age: 33, address: '369 Willow Ave', grade_type: 'Bifocal', lens_type: 'CR-39', distribution_info: 'lalamove', sales_agent_id: 1, prescription: '{}', payment_info: '{"mode":"credit_card","amount":2500}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 9 },
  { or_number: 'OR-2025-010', name: 'Jack Gray', contact_number: '+1234567899', email: 'jack@example.com', age: 29, address: '741 Ash Blvd', grade_type: 'Single Vision', lens_type: 'Polycarbonate', distribution_info: 'pickup', sales_agent_id: 2, prescription: '{}', payment_info: '{"mode":"bank_transfer","amount":1200.75}', priority_flags: '{"senior_citizen":false,"pregnant":false,"pwd":false}', queue_status: 'completed', token_number: 10 }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Insert users
    console.log('👥 Inserting users...');
    for (const user of sampleUsers) {
      await pool.query(`
        INSERT INTO users (email, full_name, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.email, user.full_name, user.password_hash, user.role, 'active']);
    }
    
    // Insert customers
    console.log('👤 Inserting customers...');
    for (const customer of sampleCustomers) {
      await pool.query(`
        INSERT INTO customers (
          or_number, name, contact_number, email, age, address, 
          grade_type, lens_type, distribution_info, sales_agent_id, 
          prescription, payment_info, priority_flags, queue_status, token_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        customer.or_number, customer.name, customer.contact_number, customer.email,
        customer.age, customer.address, customer.grade_type, customer.lens_type,
        customer.distribution_info, customer.sales_agent_id, customer.prescription,
        customer.payment_info, customer.priority_flags, customer.queue_status,
        customer.token_number
      ]);
    }
    
    // Insert transactions
    console.log('💰 Inserting transactions...');
    for (const transaction of sampleTransactions) {
      await pool.query(`
        INSERT INTO transactions (
          customer_id, or_number, amount, payment_mode, sales_agent_id, 
          cashier_id, transaction_date, paid_amount, payment_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        transaction.customer_id, transaction.or_number, transaction.amount,
        transaction.payment_mode, transaction.sales_agent_id, transaction.cashier_id,
        transaction.transaction_date, transaction.amount, 'paid'
      ]);
    }
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Inserted ${sampleTransactions.length} transactions`);
    console.log(`👥 Inserted ${sampleUsers.length} users`);
    console.log(`👤 Inserted ${sampleCustomers.length} customers`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

// Run the seeding
seedDatabase();
