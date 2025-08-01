#!/usr/bin/env npx ts-node
/**
 * RBAC Testing Script
 *
 * This script tests the Role-Based Access Control fixes:
 * 1. Validates JWT token generation includes role
 * 2. Tests middleware role checking
 * 3. Validates SUPER_ADMIN role functionality
 * 4. Tests error handling and messaging
 */
declare class RBACTester {
    private results;
    private addResult;
    /**
     * Test 1: Verify all roles are defined correctly
     */
    testRoleDefinitions(): void;
    /**
     * Test 2: JWT token generation includes role
     */
    testJWTTokenGeneration(): void;
    /**
     * Test 3: Role permission checking
     */
    testRolePermissions(): void;
    /**
     * Test 4: Error handling and messages
     */
    testErrorHandling(): void;
    /**
     * Test 5: Role hierarchy validation
     */
    testRoleHierarchy(): void;
    /**
     * Run all tests and generate report
     */
    runAllTests(): void;
    /**
     * Generate final test report
     */
    generateReport(): {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        successRate: number;
    };
}
export { RBACTester };
//# sourceMappingURL=test-rbac.d.ts.map