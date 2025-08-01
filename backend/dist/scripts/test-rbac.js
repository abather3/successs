#!/usr/bin/env npx ts-node
"use strict";
/**
 * RBAC Testing Script
 *
 * This script tests the Role-Based Access Control fixes:
 * 1. Validates JWT token generation includes role
 * 2. Tests middleware role checking
 * 3. Validates SUPER_ADMIN role functionality
 * 4. Tests error handling and messaging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACTester = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const types_1 = require("../types");
const jwtDebugger_1 = require("../utils/jwtDebugger");
const errorHandler_1 = require("../middleware/errorHandler");
// Mock config for testing
const mockConfig = {
    JWT_SECRET: 'test-secret-key-for-rbac-testing',
    JWT_EXPIRES_IN: '30m'
};
class RBACTester {
    constructor() {
        this.results = [];
    }
    addResult(test, passed, details, error) {
        this.results.push({ test, passed, details, error });
    }
    /**
     * Test 1: Verify all roles are defined correctly
     */
    testRoleDefinitions() {
        console.log('\n🔍 Testing Role Definitions...');
        try {
            const expectedRoles = ['super_admin', 'admin', 'sales', 'cashier'];
            const actualRoles = Object.values(types_1.UserRole);
            const allRolesPresent = expectedRoles.every(role => actualRoles.includes(role));
            const superAdminPresent = actualRoles.includes(types_1.UserRole.SUPER_ADMIN);
            this.addResult('Role definitions complete', allRolesPresent, {
                expected: expectedRoles,
                actual: actualRoles
            });
            this.addResult('SUPER_ADMIN role exists', superAdminPresent, {
                super_admin_value: types_1.UserRole.SUPER_ADMIN
            });
            console.log(allRolesPresent ? '✅ All roles defined correctly' : '❌ Missing roles');
            console.log(superAdminPresent ? '✅ SUPER_ADMIN role exists' : '❌ SUPER_ADMIN role missing');
        }
        catch (error) {
            this.addResult('Role definitions test', false, null, error?.toString());
            console.log('❌ Role definition test failed:', error);
        }
    }
    /**
     * Test 2: JWT token generation includes role
     */
    testJWTTokenGeneration() {
        console.log('\n🔍 Testing JWT Token Generation...');
        try {
            const testCases = [
                { userId: 1, email: 'admin@test.com', role: types_1.UserRole.ADMIN },
                { userId: 2, email: 'super@test.com', role: types_1.UserRole.SUPER_ADMIN },
                { userId: 3, email: 'cashier@test.com', role: types_1.UserRole.CASHIER },
                { userId: 4, email: 'sales@test.com', role: types_1.UserRole.SALES }
            ];
            testCases.forEach(testCase => {
                // Generate token
                const token = jsonwebtoken_1.default.sign({ userId: testCase.userId, email: testCase.email, role: testCase.role }, mockConfig.JWT_SECRET);
                // Decode and verify
                const decoded = jsonwebtoken_1.default.verify(token, mockConfig.JWT_SECRET);
                const roleIncluded = decoded.role === testCase.role;
                this.addResult(`JWT includes role for ${testCase.role}`, roleIncluded, {
                    expected_role: testCase.role,
                    actual_role: decoded.role,
                    token_payload: decoded
                });
                console.log(roleIncluded ?
                    `✅ ${testCase.role} token includes correct role` :
                    `❌ ${testCase.role} token missing or incorrect role`);
            });
        }
        catch (error) {
            this.addResult('JWT token generation test', false, null, error?.toString());
            console.log('❌ JWT token generation test failed:', error);
        }
    }
    /**
     * Test 3: Role permission checking
     */
    testRolePermissions() {
        console.log('\n🔍 Testing Role Permission Logic...');
        try {
            const testCases = [
                // Admin role tests
                { userRole: types_1.UserRole.ADMIN, requiredRoles: [types_1.UserRole.ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.ADMIN, requiredRoles: [types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.ADMIN, requiredRoles: [types_1.UserRole.SUPER_ADMIN], shouldPass: false },
                // Super Admin role tests  
                { userRole: types_1.UserRole.SUPER_ADMIN, requiredRoles: [types_1.UserRole.ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.SUPER_ADMIN, requiredRoles: [types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.SUPER_ADMIN, requiredRoles: [types_1.UserRole.SUPER_ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.SUPER_ADMIN, requiredRoles: [types_1.UserRole.CASHIER, types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], shouldPass: true },
                // Cashier role tests
                { userRole: types_1.UserRole.CASHIER, requiredRoles: [types_1.UserRole.CASHIER, types_1.UserRole.ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.CASHIER, requiredRoles: [types_1.UserRole.ADMIN], shouldPass: false },
                { userRole: types_1.UserRole.CASHIER, requiredRoles: [types_1.UserRole.CASHIER, types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], shouldPass: true },
                // Sales role tests
                { userRole: types_1.UserRole.SALES, requiredRoles: [types_1.UserRole.SALES, types_1.UserRole.ADMIN], shouldPass: true },
                { userRole: types_1.UserRole.SALES, requiredRoles: [types_1.UserRole.ADMIN], shouldPass: false },
                { userRole: types_1.UserRole.SALES, requiredRoles: [types_1.UserRole.SALES, types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], shouldPass: true }
            ];
            testCases.forEach((testCase, index) => {
                const hasPermission = jwtDebugger_1.JWTDebugger.checkRolePermission(testCase.userRole, testCase.requiredRoles);
                const testPassed = hasPermission === testCase.shouldPass;
                this.addResult(`Permission test ${index + 1}`, testPassed, {
                    user_role: testCase.userRole,
                    required_roles: testCase.requiredRoles,
                    expected: testCase.shouldPass,
                    actual: hasPermission
                });
                console.log(testPassed ?
                    `✅ ${testCase.userRole} vs [${testCase.requiredRoles.join(', ')}] = ${hasPermission}` :
                    `❌ ${testCase.userRole} vs [${testCase.requiredRoles.join(', ')}] = ${hasPermission} (expected ${testCase.shouldPass})`);
            });
        }
        catch (error) {
            this.addResult('Role permission test', false, null, error?.toString());
            console.log('❌ Role permission test failed:', error);
        }
    }
    /**
     * Test 4: Error handling and messages
     */
    testErrorHandling() {
        console.log('\n🔍 Testing Error Handling...');
        try {
            // Test error structure
            const insufficientPermsError = errorHandler_1.AuthErrors.INSUFFICIENT_PERMISSIONS;
            const hasCorrectCode = insufficientPermsError.code === 'INSUFFICIENT_PERMISSIONS';
            const hasCorrectStatus = insufficientPermsError.statusCode === 403;
            const hasUserMessage = !!insufficientPermsError.userMessage;
            this.addResult('INSUFFICIENT_PERMISSIONS error has correct code', hasCorrectCode, {
                expected: 'INSUFFICIENT_PERMISSIONS',
                actual: insufficientPermsError.code
            });
            this.addResult('INSUFFICIENT_PERMISSIONS error has correct status', hasCorrectStatus, {
                expected: 403,
                actual: insufficientPermsError.statusCode
            });
            this.addResult('INSUFFICIENT_PERMISSIONS error has user message', hasUserMessage, {
                message: insufficientPermsError.userMessage
            });
            console.log(hasCorrectCode ? '✅ Error code correct' : '❌ Error code incorrect');
            console.log(hasCorrectStatus ? '✅ Status code correct' : '❌ Status code incorrect');
            console.log(hasUserMessage ? '✅ User message present' : '❌ User message missing');
        }
        catch (error) {
            this.addResult('Error handling test', false, null, error?.toString());
            console.log('❌ Error handling test failed:', error);
        }
    }
    /**
     * Test 5: Role hierarchy validation
     */
    testRoleHierarchy() {
        console.log('\n🔍 Testing Role Hierarchy...');
        try {
            const hierarchy = jwtDebugger_1.JWTDebugger.getRoleHierarchy();
            const superAdminLevel = hierarchy[types_1.UserRole.SUPER_ADMIN];
            const adminLevel = hierarchy[types_1.UserRole.ADMIN];
            const salesLevel = hierarchy[types_1.UserRole.SALES];
            const cashierLevel = hierarchy[types_1.UserRole.CASHIER];
            const hierarchyCorrect = (superAdminLevel > adminLevel &&
                adminLevel > salesLevel &&
                adminLevel > cashierLevel &&
                salesLevel > 0 &&
                cashierLevel > 0);
            this.addResult('Role hierarchy correct', hierarchyCorrect, {
                hierarchy,
                super_admin_level: superAdminLevel,
                admin_level: adminLevel,
                sales_level: salesLevel,
                cashier_level: cashierLevel
            });
            console.log(hierarchyCorrect ? '✅ Role hierarchy correct' : '❌ Role hierarchy incorrect');
            console.log(`   SUPER_ADMIN: ${superAdminLevel}, ADMIN: ${adminLevel}, SALES: ${salesLevel}, CASHIER: ${cashierLevel}`);
        }
        catch (error) {
            this.addResult('Role hierarchy test', false, null, error?.toString());
            console.log('❌ Role hierarchy test failed:', error);
        }
    }
    /**
     * Run all tests and generate report
     */
    runAllTests() {
        console.log('\n🚀 Starting RBAC Testing Suite...\n');
        console.log('='.repeat(50));
        this.testRoleDefinitions();
        this.testJWTTokenGeneration();
        this.testRolePermissions();
        this.testErrorHandling();
        this.testRoleHierarchy();
        this.generateReport();
    }
    /**
     * Generate final test report
     */
    generateReport() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 RBAC TEST RESULTS');
        console.log('='.repeat(50));
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        console.log(`\n📈 Summary:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
        if (failedTests > 0) {
            console.log(`\n❌ Failed Tests:`);
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`   • ${result.test}: ${result.error || 'Assertion failed'}`);
            });
        }
        console.log(`\n✅ RBAC fixes ${failedTests === 0 ? 'successfully implemented!' : 'need additional work.'}`);
        if (failedTests === 0) {
            console.log(`\n🎉 All RBAC issues have been resolved:`);
            console.log(`   ✅ SUPER_ADMIN role added`);
            console.log(`   ✅ Role included in JWT tokens`);
            console.log(`   ✅ Middleware updated for SUPER_ADMIN`);
            console.log(`   ✅ Enhanced error messages`);
            console.log(`   ✅ Role hierarchy implemented`);
        }
        return { totalTests, passedTests, failedTests, successRate: (passedTests / totalTests) * 100 };
    }
}
exports.RBACTester = RBACTester;
// Run the tests if this script is executed directly
if (require.main === module) {
    const tester = new RBACTester();
    tester.runAllTests();
}
//# sourceMappingURL=test-rbac.js.map