"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TransactionApi_1 = require("../../client/TransactionApi");
const types_1 = require("../../types");
// Mock fetch globally
global.fetch = jest.fn();
describe('TransactionApi', () => {
    let api;
    const mockFetch = fetch;
    beforeEach(() => {
        api = new TransactionApi_1.TransactionApi('/api', 'test-token');
        mockFetch.mockClear();
    });
    describe('Constructor and Authentication', () => {
        it('should initialize with default values', () => {
            const defaultApi = new TransactionApi_1.TransactionApi();
            expect(defaultApi).toBeDefined();
        });
        it('should set auth token', () => {
            api.setAuthToken('new-token');
            expect(api).toBeDefined();
            // Note: headers are private, so we can't directly test this
            // but we can verify it works in the next test
        });
    });
    describe('Settlement Methods', () => {
        describe('createSettlement', () => {
            it('should create a settlement successfully', async () => {
                const mockResponse = {
                    transaction: {
                        id: 1,
                        amount: 1000,
                        paid_amount: 500,
                        balance_amount: 500,
                        payment_status: types_1.PaymentStatus.PARTIAL,
                        customer_name: 'John Doe',
                        sales_agent_name: 'Agent Smith',
                        cashier_name: 'Cashier One'
                    },
                    settlements: [
                        {
                            id: 1,
                            transaction_id: 1,
                            amount: 500,
                            payment_mode: types_1.PaymentMode.GCASH,
                            cashier_id: 2,
                            paid_at: new Date(),
                            created_at: new Date()
                        }
                    ]
                };
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });
                const result = await api.createSettlement(1, {
                    amount: 500,
                    payment_mode: types_1.PaymentMode.GCASH,
                    cashier_id: 2
                });
                expect(mockFetch).toHaveBeenCalledWith('/api/transactions/1/settlements', expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token'
                    }),
                    body: JSON.stringify({
                        amount: 500,
                        payment_mode: types_1.PaymentMode.GCASH,
                        cashier_id: 2
                    })
                }));
                expect(result.data).toEqual(mockResponse);
                expect(result.error).toBeUndefined();
            });
            it('should handle settlement creation errors', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    json: async () => ({ error: 'Settlement amount exceeds remaining balance' }),
                });
                const result = await api.createSettlement(1, {
                    amount: 1000,
                    payment_mode: types_1.PaymentMode.GCASH,
                    cashier_id: 2
                });
                expect(result.error).toBe('Settlement amount exceeds remaining balance');
                expect(result.data).toBeUndefined();
            });
        });
        describe('getSettlements', () => {
            it('should get settlements successfully', async () => {
                const mockSettlements = [
                    {
                        id: 1,
                        transaction_id: 1,
                        amount: 300,
                        payment_mode: types_1.PaymentMode.CASH,
                        cashier_id: 1,
                        paid_at: new Date(),
                        created_at: new Date(),
                        cashier_name: 'Cashier One'
                    },
                    {
                        id: 2,
                        transaction_id: 1,
                        amount: 200,
                        payment_mode: types_1.PaymentMode.GCASH,
                        cashier_id: 2,
                        paid_at: new Date(),
                        created_at: new Date(),
                        cashier_name: 'Cashier Two'
                    }
                ];
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSettlements,
                });
                const result = await api.getSettlements(1);
                expect(mockFetch).toHaveBeenCalledWith('/api/transactions/1/settlements', expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token'
                    })
                }));
                expect(result.data).toEqual(mockSettlements);
                expect(result.error).toBeUndefined();
            });
            it('should handle get settlements errors', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    json: async () => ({ error: 'Transaction not found' }),
                });
                const result = await api.getSettlements(999);
                expect(result.error).toBe('Transaction not found');
                expect(result.data).toBeUndefined();
            });
        });
    });
    describe('Transaction Methods', () => {
        describe('getTransactions', () => {
            it('should get transactions with payment fields', async () => {
                const mockResponse = {
                    transactions: [
                        {
                            id: 1,
                            customer_id: 1,
                            or_number: 'OR-001',
                            amount: 1000,
                            payment_mode: types_1.PaymentMode.CASH,
                            sales_agent_id: 1,
                            cashier_id: 1,
                            transaction_date: new Date(),
                            created_at: new Date(),
                            paid_amount: 1000,
                            balance_amount: 0,
                            payment_status: types_1.PaymentStatus.PAID,
                            customer_name: 'John Doe',
                            sales_agent_name: 'Agent Smith',
                            cashier_name: 'Cashier One'
                        }
                    ],
                    pagination: {
                        current_page: 1,
                        per_page: 10,
                        total: 1,
                        total_pages: 1
                    }
                };
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });
                const result = await api.getTransactions({
                    page: 1,
                    limit: 10,
                    paymentMode: types_1.PaymentMode.CASH
                });
                expect(mockFetch).toHaveBeenCalledWith('/api/transactions?page=1&limit=10&paymentMode=cash', expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token'
                    })
                }));
                expect(result.data).toEqual(mockResponse);
                expect(result.error).toBeUndefined();
            });
            it('should handle date filters correctly', async () => {
                const startDate = new Date('2024-01-01');
                const endDate = new Date('2024-12-31');
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ transactions: [], pagination: {} }),
                });
                await api.getTransactions({
                    startDate,
                    endDate,
                    salesAgentId: 1,
                    customerId: 2
                });
                expect(mockFetch).toHaveBeenCalledWith(`/api/transactions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&salesAgentId=1&customerId=2`, expect.any(Object));
            });
        });
        describe('getTransaction', () => {
            it('should get a single transaction', async () => {
                const mockTransaction = {
                    id: 1,
                    customer_id: 1,
                    or_number: 'OR-001',
                    amount: 1000,
                    payment_mode: types_1.PaymentMode.CASH,
                    sales_agent_id: 1,
                    cashier_id: 1,
                    transaction_date: new Date(),
                    created_at: new Date(),
                    paid_amount: 1000,
                    balance_amount: 0,
                    payment_status: types_1.PaymentStatus.PAID,
                    customer_name: 'John Doe',
                    sales_agent_name: 'Agent Smith',
                    cashier_name: 'Cashier One'
                };
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockTransaction,
                });
                const result = await api.getTransaction(1);
                expect(mockFetch).toHaveBeenCalledWith('/api/transactions/1', expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token'
                    })
                }));
                expect(result.data).toEqual(mockTransaction);
                expect(result.error).toBeUndefined();
            });
        });
        describe('createTransaction', () => {
            it('should create a transaction', async () => {
                const transactionData = {
                    customer_id: 1,
                    or_number: 'OR-001',
                    amount: 1000,
                    payment_mode: types_1.PaymentMode.CASH,
                    sales_agent_id: 1,
                    cashier_id: 1
                };
                const mockResponse = {
                    id: 1,
                    ...transactionData,
                    transaction_date: new Date(),
                    created_at: new Date(),
                    paid_amount: 1000,
                    balance_amount: 0,
                    payment_status: types_1.PaymentStatus.PAID
                };
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse,
                });
                const result = await api.createTransaction(transactionData);
                expect(mockFetch).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token'
                    }),
                    body: JSON.stringify(transactionData)
                }));
                expect(result.data).toEqual(mockResponse);
                expect(result.error).toBeUndefined();
            });
        });
    });
    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            const result = await api.getTransactions();
            expect(result.error).toBe('Network error');
            expect(result.data).toBeUndefined();
        });
        it('should handle HTTP errors without JSON body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => { throw new Error('No JSON'); },
            });
            const result = await api.getTransactions();
            expect(result.error).toBe('HTTP 500: Internal Server Error');
            expect(result.data).toBeUndefined();
        });
        it('should handle unknown errors', async () => {
            mockFetch.mockRejectedValueOnce('Unknown error');
            const result = await api.getTransactions();
            expect(result.error).toBe('Network error occurred');
            expect(result.data).toBeUndefined();
        });
    });
    describe('Reporting Methods', () => {
        it('should get daily summary', async () => {
            const mockSummary = {
                totalAmount: 5000,
                totalTransactions: 10,
                paymentModeBreakdown: {
                    cash: { amount: 3000, count: 6 },
                    gcash: { amount: 2000, count: 4 }
                },
                salesAgentBreakdown: [
                    { agent_name: 'Agent 1', amount: 3000, count: 6 },
                    { agent_name: 'Agent 2', amount: 2000, count: 4 }
                ]
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSummary,
            });
            const result = await api.getDailySummary(new Date('2024-01-01'));
            expect(mockFetch).toHaveBeenCalledWith('/api/transactions/reports/daily?date=2024-01-01T00:00:00.000Z', expect.any(Object));
            expect(result.data).toEqual(mockSummary);
            expect(result.error).toBeUndefined();
        });
        it('should get monthly report', async () => {
            const mockReport = {
                dailyBreakdown: [
                    { date: '2024-01-01', amount: 1000, transactions: 5 },
                    { date: '2024-01-02', amount: 2000, transactions: 8 }
                ],
                totalAmount: 3000,
                totalTransactions: 13,
                topSalesAgents: [
                    { agent_name: 'Agent 1', amount: 2000, transactions: 8 },
                    { agent_name: 'Agent 2', amount: 1000, transactions: 5 }
                ]
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockReport,
            });
            const result = await api.getMonthlyReport(2024, 1);
            expect(mockFetch).toHaveBeenCalledWith('/api/transactions/reports/monthly?year=2024&month=1', expect.any(Object));
            expect(result.data).toEqual(mockReport);
            expect(result.error).toBeUndefined();
        });
        it('should get saved daily report when it exists', async () => {
            const mockReport = {
                id: 1,
                date: '2024-01-01',
                totalAmount: 5000,
                totalTransactions: 10,
                expenses: [],
                funds: [],
                pettyCashStart: 1000,
                pettyCashEnd: 1200,
                created_at: '2024-01-01T10:00:00Z'
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockReport,
            });
            const result = await api.getSavedDailyReport('2024-01-01');
            expect(mockFetch).toHaveBeenCalledWith('/api/transactions/reports/daily/2024-01-01', expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer test-token'
                })
            }));
            expect(result.data).toEqual(mockReport);
            expect(result.error).toBeUndefined();
        });
        it('should get normalized response when daily report does not exist', async () => {
            const mockResponse = { exists: false };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const result = await api.getSavedDailyReport('2024-01-15');
            expect(mockFetch).toHaveBeenCalledWith('/api/transactions/reports/daily/2024-01-15', expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer test-token'
                })
            }));
            expect(result.data).toEqual({ exists: false });
            expect(result.error).toBeUndefined();
        });
    });
    describe('Export Methods', () => {
        it('should export transactions', async () => {
            const mockExport = {
                format: 'excel',
                exportedAt: '2024-01-01T00:00:00.000Z',
                totalRecords: 100,
                data: []
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockExport,
            });
            const result = await api.exportTransactions({
                format: 'excel',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31')
            });
            expect(mockFetch).toHaveBeenCalledWith('/api/transactions/export', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    format: 'excel',
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-12-31T00:00:00.000Z'
                })
            }));
            expect(result.data).toEqual(mockExport);
            expect(result.error).toBeUndefined();
        });
    });
});
//# sourceMappingURL=TransactionApi.test.js.map