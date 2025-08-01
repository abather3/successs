import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testTransactionFlow() {
  try {
    // 1. Create a new transaction
    const createResponse = await axios.post(`${API_BASE_URL}/transactions`, {
      customer_id: 1, // Assuming customer with ID 1 exists
      or_number: `OR-TEST-${Date.now()}`,
      amount: 1000,
      payment_mode: 'cash',
      sales_agent_id: 1, // Assuming sales agent with ID 1 exists
      cashier_id: 1, // Assuming cashier with ID 1 exists
    }, {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzIyMjk1ODU2LCJleHAiOjE3MjI5MDA2NTZ9.QkFUCEj00_9xKj_Eyb53jV0pW-rUa2zC9k1Q6yR4c2E' } // Replace with a valid admin/cashier token
    });
    const transaction = createResponse.data;
    console.log('Created transaction:', transaction);

    // 2. Create a settlement for the new transaction
    const settlementResponse = await axios.post(`${API_BASE_URL}/transactions/${transaction.id}/settlements`, {
      amount: 500,
      payment_mode: 'cash',
      cashier_id: 1
    }, {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzIyMjk1ODU2LCJleHAiOjE3MjI5MDA2NTZ9.QkFUCEj00_9xKj_Eyb53jV0pW-rUa2zC9k1Q6yR4c2E' } // Replace with a valid admin/cashier token
    });
    console.log('Created settlement:', settlementResponse.data);

    // 3. Get the updated transaction details
    const updatedTransactionResponse = await axios.get(`${API_BASE_URL}/transactions/${transaction.id}`, {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzIyMjk1ODU2LCJleHAiOjE3MjI5MDA2NTZ9.QkFUCEj00_9xKj_Eyb53jV0pW-rUa2zC9k1Q6yR4c2E' } // Replace with a valid admin/cashier token
    });
    console.log('Updated transaction:', updatedTransactionResponse.data);

  } catch (error) {
    console.error('Error testing transaction flow:', error.response ? error.response.data : error.message);
  }
}

testTransactionFlow();

