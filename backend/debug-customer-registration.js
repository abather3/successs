const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test customer data
const testCustomer = {
  name: 'John Test Customer',
  contact_number: '09123456789',
  email: 'john.test@example.com',
  age: 30,
  address: '123 Test Street, Test City',
  occupation: 'Engineer',
  distribution_info: 'lalamove',
  doctor_assigned: 'Dr. Smith',
  prescription: {
    od: '-1.00',
    os: '-1.25',
    ou: '',
    pd: '32',
    add: ''
  },
  grade_type: 'single',
  lens_type: 'bifocal',
  frame_code: 'FR001',
  estimated_time: {
    days: 1,
    hours: 2,
    minutes: 30
  },
  payment_info: {
    mode: 'cash',
    amount: 500.00
  },
  remarks: 'Test customer registration',
  priority_flags: {
    senior_citizen: false,
    pregnant: false,
    pwd: false
  }
};

async function testCustomerRegistration() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@escashop.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful');
    
    console.log('📝 Registering customer...');
    console.log('Customer data:', JSON.stringify(testCustomer, null, 2));
    
    const response = await axios.post(`${BASE_URL}/customers`, testCustomer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Customer registered successfully');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testCustomerRegistration();
