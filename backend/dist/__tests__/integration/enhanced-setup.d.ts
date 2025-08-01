import 'dotenv/config';
export declare class EnhancedTestSetup {
    private static instance;
    private testData;
    private constructor();
    static getInstance(): EnhancedTestSetup;
    setupTestEnvironment(): Promise<string>;
    createTestSchema(schemaName: string): Promise<void>;
    private createTables;
    createTestUsers(schemaName: string): Promise<{
        superAdminId: any;
        adminId: any;
        salesAgent1Id: any;
        salesAgent2Id: any;
        cashier1Id: any;
        cashier2Id: any;
    }>;
    createTestCustomers(schemaName: string, salesAgentId: number, count?: number): Promise<number[]>;
    createTestTransactions(schemaName: string, customerIds: number[], salesAgentId: number, cashierId: number): Promise<number[]>;
    getTestData(key: string): any;
    cleanupTestSchema(schemaName: string): Promise<void>;
    simulateNetworkDelay(min?: number, max?: number): Promise<void>;
    simulateNetworkFailure(failureRate?: number): Promise<boolean>;
    generateConcurrentOperations(operationCount: number, operation: () => Promise<any>): Promise<any>[];
}
export default EnhancedTestSetup;
//# sourceMappingURL=enhanced-setup.d.ts.map