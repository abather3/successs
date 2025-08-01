#!/usr/bin/env node

/**
 * Process Security Results Script
 * 
 * This script processes security scan results and determines if any
 * critical vulnerabilities were found. It outputs data to be used in GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

/**
 * Main function
 */
function main() {
  const reportDir = process.argv[2] || 'security-reports';
  const severityThreshold = process.argv[3] || 'moderate';

  const severityOrder = ['low', 'moderate', 'high', 'critical'];
  const severityIndex = severityOrder.indexOf(severityThreshold);
  const foundIssues = {
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0
  };

  if (!fs.existsSync(reportDir)) {
    console.error(`Security report directory does not exist: ${reportDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(reportDir);

  files.forEach(file => {
    const filePath = path.join(reportDir, file);
    if (file.endsWith('.json')) {
      const report = JSON.parse(fs.readFileSync(filePath));

      if (report.metadata && report.metadata.vulnerabilities) {
        Object.entries(report.metadata.vulnerabilities).forEach(([level, count]) => {
          if (severityOrder.indexOf(level) >= severityIndex) {
            foundIssues[level] += count;
          }
        });
      }
    }
  });

  console.log('Security Scan Summary:');
  console.log(`  - Low: ${foundIssues.low}`);
  console.log(`  - Moderate: ${foundIssues.moderate}`);
  console.log(`  - High: ${foundIssues.high}`);
  console.log(`  - Critical: ${foundIssues.critical}`);

  const summary = `
## Security Scan Summary

- **Low**: ${foundIssues.low} issues found
- **Moderate**: ${foundIssues.moderate} issues found
- **High**: ${foundIssues.high} issues found
- **Critical**: ${foundIssues.critical} issues found

---

Scan completed on: ${new Date().toLocaleString()}.
Please review the reports for more details and take action if necessary.
`;

  fs.writeFileSync(path.join(reportDir, 'security-summary.md'), summary);

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const outputPath = process.env.GITHUB_OUTPUT;
    const outputs = [
      `critical-found=${foundIssues.critical > 0}`,
      `high-found=${foundIssues.high > 0}`,
      `moderate-found=${foundIssues.moderate > 0}`,
      `report-path=${path.join(reportDir, 'security-summary.md')}`
    ];
    fs.appendFileSync(outputPath, outputs.join('\n') + '\n');
  } else {
    // Fallback for local testing
    console.log(`critical-found=${foundIssues.critical > 0}`);
    console.log(`high-found=${foundIssues.high > 0}`);
    console.log(`moderate-found=${foundIssues.moderate > 0}`);
    console.log(`report-path=${path.join(reportDir, 'security-summary.md')}`);
  }
}

main();
