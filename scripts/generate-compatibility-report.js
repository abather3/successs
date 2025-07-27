#!/usr/bin/env node

/**
 * Generate Compatibility Report Script
 * 
 * This script generates a compatibility report based on test results of different dependency combinations.
 */

const fs = require('fs');
const path = require('path');

/**
 * Main function
 */
function main() {
  const combinationName = process.argv[2];
  const combinationJson = process.argv[3];
  
  if (!combinationName || !combinationJson) {
    console.error('Usage: node generate-compatibility-report.js <combination-name> <combination-json>');
    process.exit(1);
  }

  let combination;
  try {
    combination = JSON.parse(combinationJson);
  } catch (error) {
    console.error('Error parsing combination JSON:', error.message);
    process.exit(1);
  }

  console.log(`🔍 Generating compatibility report for: ${combinationName}`);

  // Collect test results (dummy values for illustration purpose)
  const testResults = {
    unitTests: { passed: 100, failed: 0 },
    integrationTests: { passed: 50, failed: 5 },
    e2eTests: { passed: 25, failed: 2 },
  };

  // Analyze results
  const isCompatible = testResults.integrationTests.failed === 0;

  // Prepare report data
  const reportData = {
    combination: combinationName,
    nodeVersion: combination.node_version,
    frontendDependencies: combination.frontend,
    backendDependencies: combination.backend,
    testResults,
    isCompatible,
    timestamp: new Date().toISOString(),
  };

  // Save the report to a JSON file
  const reportDir = 'compatibility-reports';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }

  const reportPath = path.join(reportDir, `${combinationName}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  console.log(`✓ Report generated: ${reportPath}`);

  // Display summary
  console.log(`\n📄 Compatibility Report Summary:`);
  console.log(`Combination: ${combinationName}`);
  console.log(`Node.js Version: ${combination.node_version}`);
  console.log('Compatible:', isCompatible ? '✅ Yes' : '❌ No');
  console.log('Failures:', JSON.stringify(testResults));

  if (!isCompatible) {
    console.warn('⚠️  Incompatibilities detected! Check detailed report.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

