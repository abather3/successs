#!/usr/bin/env node

/**
 * Security Monitoring and Alerting System
 * 
 * This script provides comprehensive security monitoring for the EscaShop application,
 * including vulnerability detection, dependency analysis, and alerting mechanisms.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityMonitor {
    constructor() {
        this.rootDir = process.cwd();
        this.reportDir = path.join(this.rootDir, 'security-reports');
        this.configFile = path.join(this.rootDir, 'security-config.json');
        
        // Default configuration
        this.config = {
            severityThresholds: {
                critical: 0,  // No critical vulnerabilities allowed
                high: 2,      // Maximum 2 high severity vulnerabilities
                moderate: 10, // Maximum 10 moderate severity vulnerabilities
                low: 50       // Maximum 50 low severity vulnerabilities
            },
            alertChannels: {
                slack: true,
                email: true,
                github: true
            },
            scanFrequency: {
                dependencies: 'daily',
                codebase: 'weekly'
            },
            exclusions: [
                // Packages to exclude from alerts (false positives)
            ]
        };

        this.loadConfig();
        this.ensureReportDirectory();
    }

    loadConfig() {
        if (fs.existsSync(this.configFile)) {
            try {
                const userConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...this.config, ...userConfig };
                console.log('📋 Loaded security configuration');
            } catch (error) {
                console.warn('⚠️  Error loading security config, using defaults');
            }
        }
    }

    ensureReportDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    async runComprehensiveScan() {
        console.log('🔒 Starting comprehensive security scan...');
        
        const results = {
            timestamp: new Date().toISOString(),
            scans: {},
            summary: {
                totalVulnerabilities: 0,
                severityBreakdown: { critical: 0, high: 0, moderate: 0, low: 0 },
                newVulnerabilities: 0,
                resolvedVulnerabilities: 0
            },
            alerts: []
        };

        try {
            // Run npm audit for all workspaces
            results.scans.npmAudit = await this.runNpmAuditScan();
            
            // Run dependency analysis
            results.scans.dependencyAnalysis = await this.runDependencyAnalysis();
            
            // Run code security scan
            results.scans.codeSecurity = await this.runCodeSecurityScan();
            
            // Check for outdated dependencies
            results.scans.outdatedPackages = await this.checkOutdatedPackages();
            
            // Analyze results and generate alerts
            this.analyzeResults(results);
            
            // Save comprehensive report
            this.saveSecurityReport(results);
            
            // Send alerts if necessary
            await this.sendAlerts(results);
            
            console.log('✅ Security scan completed successfully');
            return results;
            
        } catch (error) {
            console.error('❌ Security scan failed:', error.message);
            throw error;
        }
    }

    async runNpmAuditScan() {
        console.log('  📦 Running npm audit scan...');
        
        const workspaces = ['', 'backend', 'frontend'];
        const auditResults = {};

        for (const workspace of workspaces) {
            const workspaceDir = workspace 
                ? path.join(this.rootDir, workspace) 
                : this.rootDir;
            
            if (!fs.existsSync(path.join(workspaceDir, 'package.json'))) {
                continue;
            }

            try {
                const workspaceName = workspace || 'root';
                console.log(`    Scanning ${workspaceName}...`);
                
                // Run npm audit and capture JSON output
                const auditOutput = execSync('npm audit --json', { 
                    cwd: workspaceDir,
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                auditResults[workspaceName] = JSON.parse(auditOutput);
                
            } catch (error) {
                // npm audit exits with non-zero code when vulnerabilities are found
                if (error.stdout) {
                    try {
                        auditResults[workspace || 'root'] = JSON.parse(error.stdout);
                    } catch (parseError) {
                        console.warn(`    ⚠️  Could not parse audit output for ${workspace || 'root'}`);
                        auditResults[workspace || 'root'] = { error: parseError.message };
                    }
                } else {
                    auditResults[workspace || 'root'] = { error: error.message };
                }
            }
        }

        return auditResults;
    }

    async runDependencyAnalysis() {
        console.log('  🔍 Running dependency analysis...');
        
        try {
            // Use our existing dependency analyzer
            execSync('node scripts/analyze-dependencies.js', {
                cwd: this.rootDir,
                stdio: 'inherit'
            });
            
            return { status: 'completed', timestamp: new Date().toISOString() };
        } catch (error) {
            return { status: 'failed', error: error.message };
        }
    }

    async runCodeSecurityScan() {
        console.log('  🔍 Running code security scan...');
        
        const results = {
            eslintSecurity: {},
            secretsDetection: {},
            dependencyUsage: {}
        };

        // Run ESLint security rules for backend
        try {
            if (fs.existsSync(path.join(this.rootDir, 'backend'))) {
                execSync('npm run lint:security', {
                    cwd: path.join(this.rootDir, 'backend'),
                    stdio: 'pipe'
                });
                results.eslintSecurity.backend = { status: 'passed', issues: 0 };
            }
        } catch (error) {
            results.eslintSecurity.backend = { 
                status: 'failed', 
                error: error.message,
                issues: this.parseESLintOutput(error.stdout || '')
            };
        }

        // Check for hardcoded secrets (basic implementation)
        results.secretsDetection = await this.detectSecrets();

        return results;
    }

    async detectSecrets() {
        console.log('    🔐 Detecting potential secrets...');
        
        const secretPatterns = [
            { name: 'API Key', pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/gi },
            { name: 'Password', pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi },
            { name: 'JWT Secret', pattern: /jwt[_-]?secret\s*[:=]\s*['"][^'"]{20,}['"]/gi },
            { name: 'Database URL', pattern: /database[_-]?url\s*[:=]\s*['"]postgresql:\/\/[^'"]+['"]/gi },
            { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi }
        ];

        const findings = [];
        const sourceDirectories = ['backend/src', 'frontend/src', 'scripts'];

        for (const dir of sourceDirectories) {
            const dirPath = path.join(this.rootDir, dir);
            if (fs.existsSync(dirPath)) {
                const files = this.getAllFiles(dirPath, ['.js', '.ts', '.jsx', '.tsx', '.json']);
                
                for (const file of files) {
                    // Skip node_modules and test files
                    if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
                        continue;
                    }

                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        
                        for (const { name, pattern } of secretPatterns) {
                            const matches = content.match(pattern);
                            if (matches) {
                                findings.push({
                                    type: name,
                                    file: path.relative(this.rootDir, file),
                                    matches: matches.length,
                                    severity: name === 'Private Key' ? 'critical' : 'high'
                                });
                            }
                        }
                    } catch (error) {
                        // Skip files that can't be read
                        continue;
                    }
                }
            }
        }

        return {
            totalFindings: findings.length,
            findings: findings.slice(0, 10), // Limit output
            status: findings.length > 0 ? 'vulnerabilities_found' : 'clean'
        };
    }

    async checkOutdatedPackages() {
        console.log('  📊 Checking for outdated packages...');
        
        const workspaces = ['', 'backend', 'frontend'];
        const outdatedResults = {};

        for (const workspace of workspaces) {
            const workspaceDir = workspace 
                ? path.join(this.rootDir, workspace) 
                : this.rootDir;
            
            if (!fs.existsSync(path.join(workspaceDir, 'package.json'))) {
                continue;
            }

            try {
                const workspaceName = workspace || 'root';
                const outdatedOutput = execSync('npm outdated --json', {
                    cwd: workspaceDir,
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                outdatedResults[workspaceName] = JSON.parse(outdatedOutput || '{}');
            } catch (error) {
                // npm outdated returns non-zero exit code when packages are outdated
                if (error.stdout) {
                    try {
                        outdatedResults[workspace || 'root'] = JSON.parse(error.stdout || '{}');
                    } catch (parseError) {
                        outdatedResults[workspace || 'root'] = {};
                    }
                } else {
                    outdatedResults[workspace || 'root'] = {};
                }
            }
        }

        return outdatedResults;
    }

    analyzeResults(results) {
        console.log('  📊 Analyzing security scan results...');
        
        // Process npm audit results
        Object.values(results.scans.npmAudit).forEach(auditResult => {
            if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
                Object.entries(auditResult.metadata.vulnerabilities).forEach(([severity, count]) => {
                    results.summary.severityBreakdown[severity] += count;
                    results.summary.totalVulnerabilities += count;
                });
            }
        });

        // Process code security findings
        if (results.scans.codeSecurity.secretsDetection.findings) {
            results.scans.codeSecurity.secretsDetection.findings.forEach(finding => {
                const severity = finding.severity || 'moderate';
                results.summary.severityBreakdown[severity] += finding.matches;
                results.summary.totalVulnerabilities += finding.matches;
            });
        }

        // Generate alerts based on thresholds
        Object.entries(this.config.severityThresholds).forEach(([severity, threshold]) => {
            const count = results.summary.severityBreakdown[severity];
            if (count > threshold) {
                results.alerts.push({
                    type: 'threshold_exceeded',
                    severity: severity,
                    message: `${severity.toUpperCase()} vulnerability threshold exceeded: ${count}/${threshold}`,
                    count: count,
                    threshold: threshold,
                    priority: severity === 'critical' ? 'urgent' : severity === 'high' ? 'high' : 'medium'
                });
            }
        });

        // Add alerts for secrets detection
        if (results.scans.codeSecurity.secretsDetection.totalFindings > 0) {
            results.alerts.push({
                type: 'secrets_detected',
                severity: 'critical',
                message: `Potential secrets detected in codebase: ${results.scans.codeSecurity.secretsDetection.totalFindings} findings`,
                count: results.scans.codeSecurity.secretsDetection.totalFindings,
                priority: 'urgent'
            });
        }
    }

    saveSecurityReport(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportDir, `security-report-${timestamp}.json`);
        const summaryFile = path.join(this.reportDir, 'latest-security-summary.json');
        
        // Save detailed report
        fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
        
        // Save summary for quick access
        fs.writeFileSync(summaryFile, JSON.stringify({
            timestamp: results.timestamp,
            summary: results.summary,
            alerts: results.alerts,
            reportFile: reportFile
        }, null, 2));

        console.log(`📋 Security report saved: ${reportFile}`);
    }

    async sendAlerts(results) {
        if (results.alerts.length === 0) {
            console.log('✅ No security alerts to send');
            return;
        }

        console.log(`🚨 Sending ${results.alerts.length} security alerts...`);

        // Prepare alert message
        const urgentAlerts = results.alerts.filter(alert => alert.priority === 'urgent');
        const highAlerts = results.alerts.filter(alert => alert.priority === 'high');
        
        if (urgentAlerts.length > 0) {
            await this.sendUrgentAlerts(urgentAlerts, results);
        }
        
        if (highAlerts.length > 0) {
            await this.sendHighPriorityAlerts(highAlerts, results);
        }
    }

    async sendUrgentAlerts(alerts, results) {
        const message = this.formatAlertMessage(alerts, results, 'URGENT');
        
        // In a real implementation, these would send actual notifications
        console.log('🚨 URGENT SECURITY ALERT:');
        console.log(message);
        
        // Log alert for GitHub Actions to pick up
        if (process.env.GITHUB_ACTIONS) {
            console.log('::error::URGENT SECURITY ALERT - Critical vulnerabilities detected');
            fs.writeFileSync(path.join(this.reportDir, 'urgent-alert.txt'), message);
        }
    }

    async sendHighPriorityAlerts(alerts, results) {
        const message = this.formatAlertMessage(alerts, results, 'HIGH');
        
        console.log('⚠️ HIGH PRIORITY SECURITY ALERT:');
        console.log(message);
        
        // Log alert for GitHub Actions to pick up
        if (process.env.GITHUB_ACTIONS) {
            console.log('::warning::HIGH PRIORITY SECURITY ALERT - Security issues detected');
            fs.writeFileSync(path.join(this.reportDir, 'high-priority-alert.txt'), message);
        }
    }

    formatAlertMessage(alerts, results, priority) {
        let message = `🚨 ${priority} SECURITY ALERT - EscaShop\n\n`;
        message += `Detection Time: ${new Date(results.timestamp).toLocaleString()}\n`;
        message += `Total Vulnerabilities: ${results.summary.totalVulnerabilities}\n\n`;
        
        message += 'Severity Breakdown:\n';
        Object.entries(results.summary.severityBreakdown).forEach(([severity, count]) => {
            if (count > 0) {
                message += `  ${severity.toUpperCase()}: ${count}\n`;
            }
        });
        
        message += '\nAlert Details:\n';
        alerts.forEach((alert, index) => {
            message += `${index + 1}. ${alert.message}\n`;
        });
        
        message += '\nImmediate Actions Required:\n';
        message += '1. Review detailed security report\n';
        message += '2. Patch critical and high severity vulnerabilities\n';
        message += '3. Update affected dependencies\n';
        message += '4. Verify fixes with security scan\n';
        
        return message;
    }

    getAllFiles(dirPath, extensions) {
        let files = [];
        
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                    files = files.concat(this.getAllFiles(fullPath, extensions));
                } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
        
        return files;
    }

    parseESLintOutput(output) {
        // Basic ESLint output parsing - in a real implementation this would be more robust
        const lines = output.split('\n');
        const issues = lines.filter(line => line.includes('error') || line.includes('warning')).length;
        return issues;
    }
}

// CLI interface
async function main() {
    const command = process.argv[2] || 'scan';
    const monitor = new SecurityMonitor();

    try {
        switch (command) {
            case 'scan':
            case 'full-scan':
                await monitor.runComprehensiveScan();
                break;
            case 'config':
                console.log('Current security configuration:');
                console.log(JSON.stringify(monitor.config, null, 2));
                break;
            default:
                console.log('Usage: node security-monitoring.js [scan|config]');
                console.log('  scan     - Run comprehensive security scan');
                console.log('  config   - Display current configuration');
        }
    } catch (error) {
        console.error('Security monitoring failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SecurityMonitor;
