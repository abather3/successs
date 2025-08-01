#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

/**
 * Breaking Changes Analyzer
 * Analyzes dependency updates for breaking changes and deprecated APIs
 */

class BreakingChangesAnalyzer {
    constructor() {
        this.rootDir = process.cwd();
        this.analysisResults = {
            breakingChanges: [],
            deprecatedAPIs: [],
            incompatibilities: [],
            recommendations: []
        };
    }

    async analyze() {
        console.log('🔍 Analyzing dependencies for breaking changes...');
        
        // Analyze package.json files for major version updates
        await this.analyzePackageUpdates();
        
        // Scan codebase for deprecated API usage
        await this.scanForDeprecatedAPIs();
        
        // Check for known incompatibilities
        await this.checkIncompatibilities();
        
        // Generate recommendations
        this.generateRecommendations();
        
        // Save analysis results
        this.saveResults();
        
        console.log('✅ Breaking changes analysis complete!');
        return this.analysisResults;
    }

    async analyzePackageUpdates() {
        console.log('  📦 Analyzing package updates...');
        
        const workspaces = ['', 'backend', 'frontend'];
        
        for (const workspace of workspaces) {
            const packagePath = workspace 
                ? path.join(this.rootDir, workspace, 'package.json')
                : path.join(this.rootDir, 'package.json');
            
            if (fs.existsSync(packagePath)) {
                await this.analyzePackageFile(packagePath, workspace || 'root');
            }
        }
    }

    async analyzePackageFile(packagePath, workspace) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        for (const [depName, currentVersion] of Object.entries(dependencies)) {
            try {
                const latestVersion = await this.getLatestVersion(depName);
                const currentSemver = semver.coerce(currentVersion);
                const latestSemver = semver.coerce(latestVersion);
                
                if (currentSemver && latestSemver) {
                    const majorDiff = semver.major(latestSemver) - semver.major(currentSemver);
                    
                    if (majorDiff > 0) {
                        const breakingChange = {
                            package: depName,
                            workspace,
                            currentVersion: currentSemver.version,
                            latestVersion: latestSemver.version,
                            majorVersionsAhead: majorDiff,
                            potentialBreakingChanges: await this.getBreakingChanges(depName, currentSemver, latestSemver)
                        };
                        
                        this.analysisResults.breakingChanges.push(breakingChange);
                    }
                }
            } catch (error) {
                console.warn(`  ⚠️  Could not analyze ${depName}: ${error.message}`);
            }
        }
    }

    async getLatestVersion(packageName) {
        try {
            const result = execSync(`npm view ${packageName} version`, { encoding: 'utf8' });
            return result.trim();
        } catch (error) {
            console.warn(`Warning: Could not get latest version for ${packageName}: ${error.message}`);
            return null;
        }
    }

    async getBreakingChanges(packageName, currentVersion, latestVersion) {
        const knownBreakingChanges = {
            'react': {
                '19.0.0': [
                    'Server Components architecture changes',
                    'New JSX transform requirements',
                    'Concurrent features enabled by default',
                    'Legacy mode removal'
                ],
                '20.0.0': [
                    'Complete rewrite of reconciler',
                    'New component lifecycle',
                    'Different prop handling'
                ]
            },
            'express': {
                '5.0.0': [
                    'Middleware signature changes',
                    'Router API updates',
                    'Error handling modifications',
                    'Path parameter parsing changes'
                ]
            },
            'socket.io': {
                '5.0.0': [
                    'Connection handling changes',
                    'Adapter API modifications',
                    'Namespace behavior updates',
                    'Protocol version changes'
                ]
            },
            '@mui/material': {
                '8.0.0': [
                    'Theme structure changes',
                    'Component prop updates',
                    'CSS-in-JS engine changes',
                    'Breaking changes in component APIs'
                ]
            },
            'react-router-dom': {
                '8.0.0': [
                    'Data API changes',
                    'Loader/Action function signatures',
                    'Route component structure',
                    'Navigation API updates'
                ]
            }
        };

        const changes = [];
        const packageChanges = knownBreakingChanges[packageName];
        
        if (packageChanges) {
            Object.entries(packageChanges).forEach(([version, versionChanges]) => {
                if (semver.gte(latestVersion, version) && semver.lt(currentVersion, version)) {
                    changes.push(...versionChanges.map(change => ({
                        version,
                        change
                    })));
                }
            });
        }

        return changes;
    }

    async scanForDeprecatedAPIs() {
        console.log('  🔍 Scanning for deprecated API usage...');
        
        const deprecatedPatterns = [
            // React deprecated patterns
            {
                pattern: /componentWillMount|componentWillReceiveProps|componentWillUpdate/g,
                type: 'React Legacy Lifecycle',
                severity: 'high',
                replacement: 'Use componentDidMount, componentDidUpdate, or hooks'
            },
            {
                pattern: /React\.createClass/g,
                type: 'React createClass',
                severity: 'high', 
                replacement: 'Use ES6 classes or functional components'
            },
            {
                pattern: /findDOMNode/g,
                type: 'React findDOMNode',
                severity: 'medium',
                replacement: 'Use refs instead'
            },
            
            // Express deprecated patterns
            {
                pattern: /req\.param\(/g,
                type: 'Express req.param',
                severity: 'medium',
                replacement: 'Use req.params, req.query, or req.body'
            },
            {
                pattern: /express\.bodyParser/g,
                type: 'Express bodyParser',
                severity: 'high',
                replacement: 'Use body-parser middleware directly'
            },
            
            // Node.js deprecated patterns
            {
                pattern: /Buffer\(\d+\)/g,
                type: 'Buffer constructor',
                severity: 'high',
                replacement: 'Use Buffer.alloc() or Buffer.from()'
            },
            {
                pattern: /new Buffer\(/g,
                type: 'Buffer constructor',
                severity: 'high',
                replacement: 'Use Buffer.alloc() or Buffer.from()'
            },
            
            // Socket.IO deprecated patterns
            {
                pattern: /socket\.set|socket\.get/g,
                type: 'Socket.IO get/set',
                severity: 'medium',
                replacement: 'Use socket.handshake or custom properties'
            }
        ];

        const sourceDirectories = ['backend/src', 'frontend/src'];
        
        for (const dir of sourceDirectories) {
            const dirPath = path.join(this.rootDir, dir);
            if (fs.existsSync(dirPath)) {
                await this.scanDirectory(dirPath, deprecatedPatterns);
            }
        }
    }

    async scanDirectory(dirPath, patterns) {
        const files = this.getAllFiles(dirPath, ['.js', '.ts', '.jsx', '.tsx']);
        
        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(this.rootDir, filePath);
            
            patterns.forEach(({ pattern, type, severity, replacement }) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const lines = content.substring(0, match.index).split('\n');
                    const lineNumber = lines.length;
                    const lineContent = lines[lines.length - 1] + match[0];
                    
                    this.analysisResults.deprecatedAPIs.push({
                        file: relativePath,
                        line: lineNumber,
                        column: match.index - content.lastIndexOf('\n', match.index - 1) - 1,
                        type,
                        severity,
                        pattern: match[0],
                        lineContent: lineContent.trim(),
                        replacement
                    });
                }
            });
        }
    }

    getAllFiles(dirPath, extensions) {
        let files = [];
        
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                files = files.concat(this.getAllFiles(fullPath, extensions));
            } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    async checkIncompatibilities() {
        console.log('  ⚠️  Checking for known incompatibilities...');
        
        const incompatibilityRules = [
            {
                condition: (deps) => deps.react && deps['@mui/material'] && 
                           semver.major(semver.coerce(deps.react)) >= 19 && 
                           semver.major(semver.coerce(deps['@mui/material'])) < 8,
                message: 'React 19+ may have compatibility issues with MUI v7 and below',
                severity: 'high',
                solution: 'Upgrade @mui/material to v8.x when available'
            },
            {
                condition: (deps) => deps['socket.io'] && deps['socket.io-client'] &&
                           semver.major(semver.coerce(deps['socket.io'])) !== 
                           semver.major(semver.coerce(deps['socket.io-client'])),
                message: 'Socket.IO server and client major versions should match',
                severity: 'high',
                solution: 'Ensure socket.io and socket.io-client have matching major versions'
            },
            {
                condition: (deps) => deps.express && 
                           semver.major(semver.coerce(deps.express)) >= 5,
                message: 'Express 5.x has breaking changes in middleware and routing',
                severity: 'medium',
                solution: 'Review Express 5.x migration guide and update middleware'
            },
            {
                condition: (deps) => deps.node && 
                           semver.major(semver.coerce(deps.node)) >= 22,
                message: 'Node.js 22+ may have breaking changes affecting some packages',
                severity: 'medium',
                solution: 'Test thoroughly with Node.js 22+ and update incompatible packages'
            }
        ];

        const packageFiles = [
            path.join(this.rootDir, 'package.json'),
            path.join(this.rootDir, 'backend', 'package.json'),
            path.join(this.rootDir, 'frontend', 'package.json')
        ];

        for (const packageFile of packageFiles) {
            if (fs.existsSync(packageFile)) {
                const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                incompatibilityRules.forEach(rule => {
                    if (rule.condition(deps)) {
                        this.analysisResults.incompatibilities.push({
                            file: path.relative(this.rootDir, packageFile),
                            message: rule.message,
                            severity: rule.severity,
                            solution: rule.solution
                        });
                    }
                });
            }
        }
    }

    generateRecommendations() {
        console.log('  💡 Generating recommendations...');
        
        const recommendations = [];
        
        // High-priority breaking changes
        const highPriorityChanges = this.analysisResults.breakingChanges
            .filter(change => change.majorVersionsAhead >= 2);
        
        if (highPriorityChanges.length > 0) {
            recommendations.push({
                type: 'critical',
                title: 'Multiple Major Version Updates Required',
                description: `${highPriorityChanges.length} packages have 2+ major versions to update`,
                action: 'Plan gradual migration strategy with thorough testing',
                packages: highPriorityChanges.map(c => c.package)
            });
        }

        // Deprecated API usage
        const highSeverityDeprecations = this.analysisResults.deprecatedAPIs
            .filter(api => api.severity === 'high');
        
        if (highSeverityDeprecations.length > 0) {
            recommendations.push({
                type: 'high',
                title: 'Critical Deprecated APIs Found',
                description: `${highSeverityDeprecations.length} high-severity deprecated API usages detected`,
                action: 'Replace deprecated APIs before major version updates',
                details: highSeverityDeprecations.slice(0, 5).map(api => ({
                    file: api.file,
                    type: api.type,
                    replacement: api.replacement
                }))
            });
        }

        // Incompatibilities
        const highSeverityIncompatibilities = this.analysisResults.incompatibilities
            .filter(inc => inc.severity === 'high');
        
        if (highSeverityIncompatibilities.length > 0) {
            recommendations.push({
                type: 'high',
                title: 'Package Incompatibilities Detected',
                description: `${highSeverityIncompatibilities.length} critical incompatibilities found`,
                action: 'Resolve incompatibilities before proceeding with updates',
                details: highSeverityIncompatibilities
            });
        }

        // Test coverage recommendations
        recommendations.push({
            type: 'medium',
            title: 'Comprehensive Testing Required',
            description: 'Major dependency updates require extensive testing',
            action: 'Run full test suite including visual regression tests',
            checklist: [
                'Unit tests for all affected components',
                'Integration tests for API changes',
                'E2E tests for user flows',
                'Visual regression tests for UI changes',
                'Performance testing for optimization regressions'
            ]
        });

        this.analysisResults.recommendations = recommendations;
    }

    saveResults() {
        const resultsDir = path.join(this.rootDir, 'dependency-analysis');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        // Save detailed results
        fs.writeFileSync(
            path.join(resultsDir, 'breaking-changes-analysis.json'),
            JSON.stringify(this.analysisResults, null, 2)
        );

        // Generate human-readable report
        const report = this.generateHumanReadableReport();
        fs.writeFileSync(
            path.join(resultsDir, 'breaking-changes-report.md'),
            report
        );

        console.log(`📋 Analysis results saved to ${resultsDir}`);
    }

    generateHumanReadableReport() {
        const { breakingChanges, deprecatedAPIs, incompatibilities, recommendations } = this.analysisResults;
        
        let report = `# Dependency Breaking Changes Analysis Report

Generated: ${new Date().toLocaleString()}

## Summary

- **Breaking Changes**: ${breakingChanges.length} packages with major version updates
- **Deprecated APIs**: ${deprecatedAPIs.length} deprecated API usages found
- **Incompatibilities**: ${incompatibilities.length} potential incompatibilities detected
- **Recommendations**: ${recommendations.length} action items

`;

        if (breakingChanges.length > 0) {
            report += `## Breaking Changes

| Package | Current Version | Latest Version | Major Versions Behind |
|---------|----------------|----------------|----------------------|
`;
            breakingChanges.forEach(change => {
                report += `| ${change.package} | ${change.currentVersion} | ${change.latestVersion} | ${change.majorVersionsAhead} |\n`;
            });
            report += '\n';
        }

        if (deprecatedAPIs.length > 0) {
            report += `## Deprecated API Usage

| File | Line | Type | Pattern | Replacement |
|------|------|------|---------|-------------|
`;
            deprecatedAPIs.slice(0, 20).forEach(api => {
                report += `| ${api.file} | ${api.line} | ${api.type} | \`${api.pattern}\` | ${api.replacement} |\n`;
            });
            
            if (deprecatedAPIs.length > 20) {
                report += `\n... and ${deprecatedAPIs.length - 20} more issues\n`;
            }
            report += '\n';
        }

        if (incompatibilities.length > 0) {
            report += `## Incompatibilities

`;
            incompatibilities.forEach(inc => {
                report += `### ${inc.severity.toUpperCase()}: ${inc.message}

**File**: ${inc.file}
**Solution**: ${inc.solution}

`;
            });
        }

        if (recommendations.length > 0) {
            report += `## Recommendations

`;
            recommendations.forEach((rec, index) => {
                report += `### ${index + 1}. ${rec.title} (${rec.type.toUpperCase()})

${rec.description}

**Action**: ${rec.action}

`;
                if (rec.checklist) {
                    report += 'Checklist:\n';
                    rec.checklist.forEach(item => {
                        report += `- [ ] ${item}\n`;
                    });
                    report += '\n';
                }
            });
        }

        return report;
    }
}

// Run analysis if called directly
if (require.main === module) {
    const analyzer = new BreakingChangesAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = BreakingChangesAnalyzer;
