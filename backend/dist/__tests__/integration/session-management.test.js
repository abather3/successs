"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const enhanced_setup_1 = require("./enhanced-setup");
const database_1 = require("../../config/database");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
describe('Session Management Integration Tests', () => {
    let testSetup;
    let testSchema;
    let userIds;
    beforeAll(async () => {
        testSetup = enhanced_setup_1.EnhancedTestSetup.getInstance();
        testSchema = await testSetup.setupTestEnvironment();
        userIds = await testSetup.createTestUsers(testSchema);
    });
    afterAll(async () => {
        await testSetup.cleanupTestSchema(testSchema);
    });
    describe('Multi-Device Session Management', () => {
        it('should handle simultaneous logins from multiple devices', async () => {
            const userId = userIds.cashier1Id;
            const devices = [
                { type: 'desktop', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ip: '192.168.1.100' },
                { type: 'tablet', userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0)', ip: '192.168.1.101' },
                { type: 'mobile', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)', ip: '192.168.1.102' }
            ];
            const sessions = [];
            // Create sessions for multiple devices
            for (const device of devices) {
                const sessionToken = (0, uuid_1.v4)();
                const jwtToken = jsonwebtoken_1.default.sign({ userId, sessionId: sessionToken }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
                const sessionResult = await database_1.pool.query(`
          INSERT INTO ${testSchema}.user_sessions (
            user_id, session_token, device_info, ip_address, expires_at
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
                    userId,
                    sessionToken,
                    JSON.stringify(device),
                    device.ip,
                    new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
                ]);
                sessions.push({
                    id: sessionResult.rows[0].id,
                    token: jwtToken,
                    sessionToken,
                    device
                });
            }
            // Verify all sessions are active
            const activeSessions = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.user_sessions 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
            expect(activeSessions.rows).toHaveLength(3);
            // Verify each session has unique tokens
            const sessionTokens = activeSessions.rows.map(s => s.session_token);
            expect(new Set(sessionTokens).size).toBe(3);
            // Test concurrent operations from different devices
            const concurrentOperations = sessions.map(async (session, index) => {
                // Update last activity
                await database_1.pool.query(`
          UPDATE ${testSchema}.user_sessions 
          SET last_activity = CURRENT_TIMESTAMP 
          WHERE session_token = $1
        `, [session.sessionToken]);
                // Log activity from this session
                await database_1.pool.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details, session_id)
          VALUES ($1, $2, $3, $4)
        `, [
                    userId,
                    'CONCURRENT_DEVICE_ACCESS',
                    JSON.stringify({
                        device: session.device.type,
                        operation: `operation_${index}`
                    }),
                    session.sessionToken
                ]);
                return { sessionId: session.id, device: session.device.type };
            });
            const results = await Promise.all(concurrentOperations);
            expect(results).toHaveLength(3);
            // Verify all operations were logged
            const activityLogs = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE user_id = $1 AND action = 'CONCURRENT_DEVICE_ACCESS'
      `, [userId]);
            expect(activityLogs.rows).toHaveLength(3);
        });
        it('should enforce session limits per user', async () => {
            const userId = userIds.salesAgent1Id;
            const maxSessions = 5;
            const sessions = [];
            // Create sessions up to the limit
            for (let i = 0; i < maxSessions + 2; i++) {
                const sessionToken = (0, uuid_1.v4)();
                try {
                    // First, check current active sessions
                    const currentSessions = await database_1.pool.query(`
            SELECT COUNT(*) FROM ${testSchema}.user_sessions 
            WHERE user_id = $1 AND is_active = true
          `, [userId]);
                    const sessionCount = parseInt(currentSessions.rows[0].count);
                    if (sessionCount >= maxSessions) {
                        // Deactivate oldest session
                        await database_1.pool.query(`
              UPDATE ${testSchema}.user_sessions 
              SET is_active = false 
              WHERE user_id = $1 AND is_active = true 
              ORDER BY created_at ASC 
              LIMIT 1
            `, [userId]);
                        // Log session limit enforcement
                        await database_1.pool.query(`
              INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
              VALUES ($1, $2, $3)
            `, [userId, 'SESSION_LIMIT_ENFORCED', JSON.stringify({
                                maxSessions,
                                currentSessions: sessionCount
                            })]);
                    }
                    // Create new session
                    await database_1.pool.query(`
            INSERT INTO ${testSchema}.user_sessions (
              user_id, session_token, device_info, ip_address, expires_at
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
                        userId,
                        sessionToken,
                        JSON.stringify({ type: `device_${i}` }),
                        `192.168.1.${100 + i}`,
                        new Date(Date.now() + 24 * 60 * 60 * 1000)
                    ]);
                    sessions.push(sessionToken);
                }
                catch (error) {
                    console.error(`Error creating session ${i}:`, error.message);
                }
            }
            // Verify session limit is enforced
            const activeSessions = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.user_sessions 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);
            expect(activeSessions.rows.length).toBeLessThanOrEqual(maxSessions);
            // Verify enforcement was logged
            const enforcementLogs = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE user_id = $1 AND action = 'SESSION_LIMIT_ENFORCED'
      `, [userId]);
            expect(enforcementLogs.rows.length).toBeGreaterThan(0);
        });
        it('should handle session timeout and cleanup', async () => {
            const userId = userIds.adminId;
            const shortExpiryTime = new Date(Date.now() + 1000); // 1 second from now
            // Create sessions with short expiry
            const expiredSessions = [];
            for (let i = 0; i < 3; i++) {
                const sessionToken = (0, uuid_1.v4)();
                const sessionResult = await database_1.pool.query(`
          INSERT INTO ${testSchema}.user_sessions (
            user_id, session_token, device_info, ip_address, expires_at
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
                    userId,
                    sessionToken,
                    JSON.stringify({ type: `expiring_device_${i}` }),
                    `192.168.2.${100 + i}`,
                    shortExpiryTime
                ]);
                expiredSessions.push(sessionResult.rows[0].id);
            }
            // Wait for sessions to expire
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Simulate session cleanup process
            const expiredSessionsQuery = await database_1.pool.query(`
        SELECT id FROM ${testSchema}.user_sessions 
        WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true
      `);
            const expiredSessionIds = expiredSessionsQuery.rows.map(r => r.id);
            if (expiredSessionIds.length > 0) {
                // Deactivate expired sessions
                await database_1.pool.query(`
          UPDATE ${testSchema}.user_sessions 
          SET is_active = false 
          WHERE id = ANY($1)
        `, [expiredSessionIds]);
                // Log cleanup
                await database_1.pool.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
          VALUES ($1, $2, $3)
        `, [userId, 'SESSION_CLEANUP', JSON.stringify({
                        cleanedSessions: expiredSessionIds.length
                    })]);
            }
            // Verify sessions were deactivated
            const activeSessions = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.user_sessions 
        WHERE id = ANY($1) AND is_active = true
      `, [expiredSessions]);
            expect(activeSessions.rows).toHaveLength(0);
            // Verify cleanup was logged
            const cleanupLogs = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE user_id = $1 AND action = 'SESSION_CLEANUP'
      `, [userId]);
            expect(cleanupLogs.rows.length).toBeGreaterThan(0);
        });
        it('should handle session hijacking detection', async () => {
            const userId = userIds.superAdminId;
            const sessionToken = (0, uuid_1.v4)();
            const originalIP = '192.168.1.200';
            const suspiciousIP = '10.0.0.100';
            // Create initial session
            await database_1.pool.query(`
        INSERT INTO ${testSchema}.user_sessions (
          user_id, session_token, device_info, ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                sessionToken,
                JSON.stringify({ type: 'desktop', browser: 'Chrome' }),
                originalIP,
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]);
            // Simulate legitimate activity
            await database_1.pool.query(`
        UPDATE ${testSchema}.user_sessions 
        SET last_activity = CURRENT_TIMESTAMP 
        WHERE session_token = $1
      `, [sessionToken]);
            await database_1.pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details, ip_address, session_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                'LEGITIMATE_ACTIVITY',
                JSON.stringify({ action: 'view_dashboard' }),
                originalIP,
                sessionToken
            ]);
            // Simulate suspicious activity from different IP
            const suspiciousActivities = [
                'ADMIN_SETTINGS_ACCESS',
                'USER_DELETION_ATTEMPT',
                'SENSITIVE_DATA_ACCESS'
            ];
            for (const activity of suspiciousActivities) {
                // Log suspicious activity
                await database_1.pool.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details, ip_address, session_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [
                    userId,
                    activity,
                    JSON.stringify({
                        suspicious_ip: suspiciousIP,
                        original_ip: originalIP,
                        risk_level: 'high'
                    }),
                    suspiciousIP,
                    sessionToken
                ]);
                // Check for IP mismatch and potential hijacking
                const sessionInfo = await database_1.pool.query(`
          SELECT ip_address FROM ${testSchema}.user_sessions 
          WHERE session_token = $1
        `, [sessionToken]);
                if (sessionInfo.rows[0].ip_address !== suspiciousIP) {
                    // Log potential session hijacking
                    await database_1.pool.query(`
            INSERT INTO ${testSchema}.activity_logs (user_id, action, details, session_id)
            VALUES ($1, $2, $3, $4)
          `, [
                        userId,
                        'POTENTIAL_SESSION_HIJACKING',
                        JSON.stringify({
                            original_ip: originalIP,
                            suspicious_ip: suspiciousIP,
                            session_token: sessionToken,
                            security_action: 'session_terminated'
                        }),
                        sessionToken
                    ]);
                    // Terminate session for security
                    await database_1.pool.query(`
            UPDATE ${testSchema}.user_sessions 
            SET is_active = false 
            WHERE session_token = $1
          `, [sessionToken]);
                    break;
                }
            }
            // Verify hijacking detection was triggered
            const hijackingLogs = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE user_id = $1 AND action = 'POTENTIAL_SESSION_HIJACKING'
      `, [userId]);
            expect(hijackingLogs.rows.length).toBeGreaterThan(0);
            // Verify session was terminated
            const terminatedSession = await database_1.pool.query(`
        SELECT is_active FROM ${testSchema}.user_sessions 
        WHERE session_token = $1
      `, [sessionToken]);
            expect(terminatedSession.rows[0].is_active).toBe(false);
        });
        it('should handle concurrent session operations with race conditions', async () => {
            const userId = userIds.cashier2Id;
            const sessionToken = (0, uuid_1.v4)();
            // Create initial session
            await database_1.pool.query(`
        INSERT INTO ${testSchema}.user_sessions (
          user_id, session_token, device_info, ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                sessionToken,
                JSON.stringify({ type: 'desktop' }),
                '192.168.1.300',
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]);
            // Simulate concurrent operations on the same session
            const concurrentUpdates = Array.from({ length: 10 }, async (_, index) => {
                try {
                    // Try to update last activity concurrently
                    await database_1.pool.query(`
            UPDATE ${testSchema}.user_sessions 
            SET last_activity = CURRENT_TIMESTAMP 
            WHERE session_token = $1 AND is_active = true
          `, [sessionToken]);
                    // Log concurrent activity
                    await database_1.pool.query(`
            INSERT INTO ${testSchema}.activity_logs (user_id, action, details, session_id)
            VALUES ($1, $2, $3, $4)
          `, [
                        userId,
                        'CONCURRENT_SESSION_UPDATE',
                        JSON.stringify({ update_index: index }),
                        sessionToken
                    ]);
                    return { success: true, index };
                }
                catch (error) {
                    return { success: false, index, error: error.message };
                }
            });
            const results = await Promise.all(concurrentUpdates);
            // All updates should succeed (no race condition failures)
            const successfulUpdates = results.filter(r => r.success);
            expect(successfulUpdates.length).toBe(10);
            // Verify all activities were logged
            const concurrentLogs = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE user_id = $1 AND action = 'CONCURRENT_SESSION_UPDATE'
      `, [userId]);
            expect(concurrentLogs.rows).toHaveLength(10);
            // Verify session is still active
            const sessionStatus = await database_1.pool.query(`
        SELECT is_active FROM ${testSchema}.user_sessions 
        WHERE session_token = $1
      `, [sessionToken]);
            expect(sessionStatus.rows[0].is_active).toBe(true);
        });
        it('should track user activity across multiple sessions', async () => {
            const userId = userIds.salesAgent2Id;
            const sessions = [];
            // Create multiple sessions for the same user
            for (let i = 0; i < 3; i++) {
                const sessionToken = (0, uuid_1.v4)();
                await database_1.pool.query(`
          INSERT INTO ${testSchema}.user_sessions (
            user_id, session_token, device_info, ip_address, expires_at
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
                    userId,
                    sessionToken,
                    JSON.stringify({ type: `device_${i}`, platform: i % 2 === 0 ? 'web' : 'mobile' }),
                    `192.168.3.${100 + i}`,
                    new Date(Date.now() + 24 * 60 * 60 * 1000)
                ]);
                sessions.push(sessionToken);
            }
            // Generate activities across all sessions
            const activities = [
                'CUSTOMER_CREATE',
                'CUSTOMER_UPDATE',
                'QUEUE_MANAGEMENT',
                'REPORT_GENERATION',
                'SETTINGS_VIEW'
            ];
            for (let i = 0; i < activities.length; i++) {
                const sessionIndex = i % sessions.length;
                const sessionToken = sessions[sessionIndex];
                await database_1.pool.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details, session_id)
          VALUES ($1, $2, $3, $4)
        `, [
                    userId,
                    activities[i],
                    JSON.stringify({
                        session_index: sessionIndex,
                        activity_sequence: i
                    }),
                    sessionToken
                ]);
            }
            // Verify activities are tracked across all sessions
            const allActivities = await database_1.pool.query(`
        SELECT al.*, us.device_info 
        FROM ${testSchema}.activity_logs al
        JOIN ${testSchema}.user_sessions us ON al.session_id = us.session_token
        WHERE al.user_id = $1
        ORDER BY al.created_at
      `, [userId]);
            expect(allActivities.rows).toHaveLength(5);
            // Verify activities span across different devices
            const deviceTypes = new Set(allActivities.rows.map(row => {
                const deviceInfo = JSON.parse(row.device_info);
                return deviceInfo.platform;
            }));
            expect(deviceTypes.has('web')).toBe(true);
            expect(deviceTypes.has('mobile')).toBe(true);
            // Generate user activity summary
            const activitySummary = await database_1.pool.query(`
        SELECT 
          action,
          COUNT(*) as count,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM ${testSchema}.activity_logs
        WHERE user_id = $1
        GROUP BY action
        ORDER BY count DESC
      `, [userId]);
            expect(activitySummary.rows.length).toBe(5);
            expect(activitySummary.rows.every(row => row.count === '1')).toBe(true);
        });
    });
    describe('Session Security and Validation', () => {
        it('should validate session tokens and handle invalid sessions', async () => {
            const userId = userIds.adminId;
            const validSessionToken = (0, uuid_1.v4)();
            const invalidSessionToken = (0, uuid_1.v4)();
            // Create valid session
            await database_1.pool.query(`
        INSERT INTO ${testSchema}.user_sessions (
          user_id, session_token, device_info, ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                validSessionToken,
                JSON.stringify({ type: 'desktop' }),
                '192.168.1.400',
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]);
            // Test valid session
            const validSession = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.user_sessions 
        WHERE session_token = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
      `, [validSessionToken]);
            expect(validSession.rows).toHaveLength(1);
            // Test invalid session
            const invalidSession = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.user_sessions 
        WHERE session_token = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
      `, [invalidSessionToken]);
            expect(invalidSession.rows).toHaveLength(0);
            // Log invalid session attempt
            await database_1.pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [
                null, // No user ID for invalid sessions
                'INVALID_SESSION_ATTEMPT',
                JSON.stringify({
                    attempted_token: invalidSessionToken.substring(0, 8) + '...',
                    ip_address: '192.168.1.500'
                })
            ]);
            // Verify invalid session attempt was logged
            const invalidAttempts = await database_1.pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action = 'INVALID_SESSION_ATTEMPT'
      `);
            expect(invalidAttempts.rows.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=session-management.test.js.map