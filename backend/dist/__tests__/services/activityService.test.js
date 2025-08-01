"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const activity_1 = require("../../services/activity");
describe('ActivityService Tests', () => {
    let testPool;
    let originalPool;
    beforeAll(async () => {
        // Use dockerized test database
        testPool = new pg_1.Pool({
            host: 'localhost',
            port: 5433,
            database: 'escashop_test',
            user: 'test_user',
            password: 'test_password',
        });
        // Wait for database to be ready
        let retries = 10;
        while (retries > 0) {
            try {
                await testPool.query('SELECT 1');
                console.log('Test database connected for ActivityService tests');
                break;
            }
            catch (error) {
                console.log(`Waiting for test database... (${retries} retries left)`);
                retries--;
                if (retries === 0)
                    throw new Error('Test database failed to start');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        // Mock the pool in the database config
        const databaseModule = require('../../config/database');
        originalPool = databaseModule.pool;
        databaseModule.pool = testPool;
    }, 60000);
    beforeEach(async () => {
        // Clean up activity logs before each test
        await testPool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY');
    });
    afterAll(async () => {
        // Restore original pool
        if (originalPool) {
            const databaseModule = require('../../config/database');
            databaseModule.pool = originalPool;
        }
        await testPool?.end();
    });
    describe('IP Address Validation and Mapping', () => {
        it('should map "system" string to valid IP address (0.0.0.0)', async () => {
            const logData = {
                user_id: -1,
                action: 'system_operation',
                details: { operation: 'automated_cleanup' },
                ip_address: 'system',
                user_agent: 'SystemService'
            };
            const result = await activity_1.ActivityService.log(logData);
            expect(result).toBeDefined();
            expect(result.ip_address).toBe('0.0.0.0');
            expect(result.user_id).toBe(-1);
            expect(result.action).toBe('system_operation');
            expect(result.user_agent).toBe('SystemService');
            // Verify it was stored correctly in database
            const dbRecord = await testPool.query('SELECT * FROM activity_logs WHERE id = $1', [result.id]);
            expect(dbRecord.rows.length).toBe(1);
            expect(dbRecord.rows[0].ip_address).toBe('0.0.0.0');
            expect(dbRecord.rows[0].user_id).toBe(-1);
        });
        it('should map "scheduler" string to valid IP address (0.0.0.0)', async () => {
            const logData = {
                user_id: -1,
                action: 'scheduled_task',
                details: { task: 'daily_cleanup', scheduled_at: new Date().toISOString() },
                ip_address: 'scheduler',
                user_agent: 'NodeCronScheduler'
            };
            const result = await activity_1.ActivityService.log(logData);
            expect(result).toBeDefined();
            expect(result.ip_address).toBe('0.0.0.0');
            expect(result.user_id).toBe(-1);
            expect(result.action).toBe('scheduled_task');
            expect(result.user_agent).toBe('NodeCronScheduler');
            // Verify database storage
            const dbRecord = await testPool.query('SELECT * FROM activity_logs WHERE id = $1', [result.id]);
            expect(dbRecord.rows.length).toBe(1);
            expect(dbRecord.rows[0].ip_address).toBe('0.0.0.0');
        });
        it('should handle valid IPv4 addresses without modification', async () => {
            const validIpAddresses = [
                '192.168.1.1',
                '127.0.0.1',
                '10.0.0.1',
                '172.16.0.1',
                '8.8.8.8',
                '255.255.255.255',
                '0.0.0.0'
            ];
            for (const ip of validIpAddresses) {
                const logData = {
                    user_id: 1,
                    action: 'user_action',
                    details: { test_ip: ip },
                    ip_address: ip,
                    user_agent: 'TestAgent'
                };
                const result = await activity_1.ActivityService.log(logData);
                expect(result.ip_address).toBe(ip);
                // Verify in database
                const dbRecord = await testPool.query('SELECT * FROM activity_logs WHERE id = $1', [result.id]);
                expect(dbRecord.rows[0].ip_address).toBe(ip);
            }
        });
        it('should handle valid IPv6 addresses without modification', async () => {
            const validIPv6Addresses = [
                '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                'fe80:0000:0000:0000:0202:b3ff:fe1e:8329',
                '::1',
                'fe80::1'
            ];
            for (const ip of validIPv6Addresses) {
                const logData = {
                    user_id: 1,
                    action: 'ipv6_test',
                    details: { ipv6_test: true },
                    ip_address: ip,
                    user_agent: 'IPv6TestAgent'
                };
                const result = await activity_1.ActivityService.log(logData);
                expect(result.ip_address).toBe(ip);
            }
        });
        it('should map any invalid IP string to default IP (0.0.0.0)', async () => {
            const invalidIPStrings = [
                'localhost',
                'invalid_ip',
                'service_name',
                'background_worker',
                '999.999.999.999',
                'not.an.ip.address',
                'cron-job',
                'automated-service'
            ];
            for (const invalidIp of invalidIPStrings) {
                const logData = {
                    user_id: -1,
                    action: 'invalid_ip_test',
                    details: { original_ip: invalidIp },
                    ip_address: invalidIp,
                    user_agent: 'TestService'
                };
                const result = await activity_1.ActivityService.log(logData);
                expect(result.ip_address).toBe('0.0.0.0');
                // Verify in database
                const dbRecord = await testPool.query('SELECT * FROM activity_logs WHERE id = $1', [result.id]);
                expect(dbRecord.rows[0].ip_address).toBe('0.0.0.0');
            }
        });
        it('should handle null and undefined ip_address values', async () => {
            // Test with null ip_address
            const logDataNull = {
                user_id: 1,
                action: 'null_ip_test',
                details: { test: 'null_ip' },
                ip_address: null,
                user_agent: 'TestAgent'
            };
            const resultNull = await activity_1.ActivityService.log(logDataNull);
            expect(resultNull.ip_address).toBeNull();
            // Test with undefined ip_address
            const logDataUndefined = {
                user_id: 1,
                action: 'undefined_ip_test',
                details: { test: 'undefined_ip' },
                // ip_address is omitted (undefined)
                user_agent: 'TestAgent'
            };
            const resultUndefined = await activity_1.ActivityService.log(logDataUndefined);
            expect(resultUndefined.ip_address).toBeNull();
        });
    });
    describe('Service Integration Scenarios', () => {
        it('should handle DailyQueueResetService logging scenarios', async () => {
            // Simulate daily reset success logging
            const successLogData = {
                user_id: -1,
                action: 'daily_queue_reset',
                details: {
                    date: '2024-01-15',
                    customersArchived: 25,
                    completedCustomers: 20,
                    carriedForwardCustomers: 5,
                    avgWaitTime: 15,
                    peakQueueLength: 8
                },
                ip_address: '0.0.0.0',
                user_agent: 'DailyQueueResetService'
            };
            const result = await activity_1.ActivityService.log(successLogData);
            expect(result.ip_address).toBe('0.0.0.0');
            expect(result.user_id).toBe(-1);
            expect(result.action).toBe('daily_queue_reset');
            const details = JSON.parse(result.details);
            expect(details).toHaveProperty('customersArchived');
            expect(details.customersArchived).toBe(25);
            // Simulate daily reset failure logging
            const failureLogData = {
                user_id: -1,
                action: 'daily_reset_failed',
                details: { error: 'Database connection failed' },
                ip_address: '0.0.0.0',
                user_agent: 'DailyQueueResetService'
            };
            const failureResult = await activity_1.ActivityService.log(failureLogData);
            expect(failureResult.action).toBe('daily_reset_failed');
            expect(failureResult.user_id).toBe(-1);
            expect(failureResult.ip_address).toBe('0.0.0.0');
            const failureDetails = JSON.parse(failureResult.details);
            expect(failureDetails.error).toBe('Database connection failed');
        });
        it('should handle scheduler service logging with system/scheduler IP mapping', async () => {
            const schedulerScenarios = [
                {
                    input_ip: 'system',
                    action: 'automated_backup',
                    user_agent: 'SystemBackupService'
                },
                {
                    input_ip: 'scheduler',
                    action: 'queue_analysis_job',
                    user_agent: 'CronScheduler'
                },
                {
                    input_ip: 'cron-service',
                    action: 'daily_report_generation',
                    user_agent: 'ReportGeneratorService'
                }
            ];
            for (const scenario of schedulerScenarios) {
                const logData = {
                    user_id: -1,
                    action: scenario.action,
                    details: {
                        automated: true,
                        timestamp: new Date().toISOString(),
                        service: scenario.user_agent
                    },
                    ip_address: scenario.input_ip,
                    user_agent: scenario.user_agent
                };
                const result = await activity_1.ActivityService.log(logData);
                // All non-IP strings should be mapped to 0.0.0.0
                expect(result.ip_address).toBe('0.0.0.0');
                expect(result.user_id).toBe(-1);
                expect(result.action).toBe(scenario.action);
                expect(result.user_agent).toBe(scenario.user_agent);
                // Verify details are properly JSON encoded
                const details = JSON.parse(result.details);
                expect(details.automated).toBe(true);
                expect(details.service).toBe(scenario.user_agent);
            }
        });
        it('should ensure inserts succeed with system/scheduler mapped to valid IP', async () => {
            // Test bulk inserts to ensure no database constraint violations
            const bulkLogData = [
                {
                    user_id: -1,
                    action: 'system_startup',
                    details: { event: 'application_started' },
                    ip_address: 'system',
                    user_agent: 'ApplicationBootstrap'
                },
                {
                    user_id: -1,
                    action: 'scheduled_cleanup',
                    details: { cleaned_records: 150 },
                    ip_address: 'scheduler',
                    user_agent: 'CleanupScheduler'
                },
                {
                    user_id: -1,
                    action: 'background_task',
                    details: { task_type: 'email_queue_processing' },
                    ip_address: 'worker-service',
                    user_agent: 'BackgroundWorker'
                }
            ];
            const results = [];
            for (const logData of bulkLogData) {
                const result = await activity_1.ActivityService.log(logData);
                results.push(result);
            }
            expect(results.length).toBe(3);
            results.forEach(result => {
                expect(result.ip_address).toBe('0.0.0.0');
                expect(result.user_id).toBe(-1);
                expect(result.id).toBeDefined();
            });
            // Verify all records were successfully inserted
            const dbCount = await testPool.query('SELECT COUNT(*) FROM activity_logs');
            expect(parseInt(dbCount.rows[0].count)).toBe(3);
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle very long IP address strings gracefully', async () => {
            const longInvalidIP = 'a'.repeat(1000); // Very long invalid IP
            const logData = {
                user_id: 1,
                action: 'long_ip_test',
                details: { test: 'long_invalid_ip' },
                ip_address: longInvalidIP,
                user_agent: 'TestAgent'
            };
            const result = await activity_1.ActivityService.log(logData);
            expect(result.ip_address).toBe('0.0.0.0');
        });
        it('should handle special characters in IP address field', async () => {
            const specialCharIPs = [
                'system@service',
                'scheduler#worker',
                'service.name',
                'worker_process',
                'cron-job-1'
            ];
            for (const specialIP of specialCharIPs) {
                const logData = {
                    user_id: -1,
                    action: 'special_char_ip_test',
                    details: { original_ip: specialIP },
                    ip_address: specialIP,
                    user_agent: 'SpecialCharTest'
                };
                const result = await activity_1.ActivityService.log(logData);
                expect(result.ip_address).toBe('0.0.0.0');
            }
        });
        it('should properly serialize complex details objects', async () => {
            const complexDetails = {
                nested: {
                    object: {
                        with: 'multiple levels'
                    }
                },
                array: [1, 2, 3, 'string', { nested: true }],
                boolean: true,
                null_value: null,
                number: 42,
                date: new Date().toISOString()
            };
            const logData = {
                user_id: 1,
                action: 'complex_details_test',
                details: complexDetails,
                ip_address: 'system',
                user_agent: 'ComplexDetailsTest'
            };
            const result = await activity_1.ActivityService.log(logData);
            expect(result.ip_address).toBe('0.0.0.0');
            const deserializedDetails = JSON.parse(result.details);
            expect(deserializedDetails.nested.object.with).toBe('multiple levels');
            expect(deserializedDetails.array).toHaveLength(5);
            expect(deserializedDetails.boolean).toBe(true);
            expect(deserializedDetails.null_value).toBeNull();
            expect(deserializedDetails.number).toBe(42);
        });
    });
    describe('Database Integration', () => {
        it('should properly store and retrieve activity logs with mapped IP addresses', async () => {
            const testCases = [
                { input: 'system', expected: '0.0.0.0', action: 'system_test' },
                { input: 'scheduler', expected: '0.0.0.0', action: 'scheduler_test' },
                { input: '192.168.1.100', expected: '192.168.1.100', action: 'valid_ip_test' },
                { input: 'invalid-service', expected: '0.0.0.0', action: 'invalid_service_test' }
            ];
            const insertedIds = [];
            // Insert test data
            for (const testCase of testCases) {
                const logData = {
                    user_id: testCase.input === 'system' || testCase.input === 'scheduler' ? -1 : 1,
                    action: testCase.action,
                    details: { test_case: testCase.input },
                    ip_address: testCase.input,
                    user_agent: 'IntegrationTest'
                };
                const result = await activity_1.ActivityService.log(logData);
                insertedIds.push(result.id);
                expect(result.ip_address).toBe(testCase.expected);
            }
            // Verify using direct database queries
            for (let i = 0; i < insertedIds.length; i++) {
                const dbRecord = await testPool.query('SELECT * FROM activity_logs WHERE id = $1', [insertedIds[i]]);
                expect(dbRecord.rows.length).toBe(1);
                expect(dbRecord.rows[0].ip_address).toBe(testCases[i].expected);
                expect(dbRecord.rows[0].action).toBe(testCases[i].action);
                const details = JSON.parse(dbRecord.rows[0].details);
                expect(details.test_case).toBe(testCases[i].input);
            }
        });
        it('should handle concurrent activity logging without conflicts', async () => {
            const concurrentPromises = [];
            // Create 10 concurrent logging operations
            for (let i = 0; i < 10; i++) {
                const logData = {
                    user_id: -1,
                    action: `concurrent_test_${i}`,
                    details: {
                        test_id: i,
                        concurrent: true,
                        timestamp: Date.now()
                    },
                    ip_address: i % 2 === 0 ? 'system' : 'scheduler',
                    user_agent: 'ConcurrencyTest'
                };
                concurrentPromises.push(activity_1.ActivityService.log(logData));
            }
            const results = await Promise.all(concurrentPromises);
            expect(results.length).toBe(10);
            results.forEach((result, index) => {
                expect(result.ip_address).toBe('0.0.0.0');
                expect(result.action).toBe(`concurrent_test_${index}`);
                expect(result.user_id).toBe(-1);
            });
            // Verify all records exist in database
            const dbCount = await testPool.query('SELECT COUNT(*) FROM activity_logs WHERE action LIKE $1', ['concurrent_test_%']);
            expect(parseInt(dbCount.rows[0].count)).toBe(10);
        });
    });
});
//# sourceMappingURL=activityService.test.js.map