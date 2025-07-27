#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running Automated Tests for Settlement Functionality');
console.log('=' .repeat(60));

// Test configurations
const tests = [
  {
    name: '1. Unit Tests - WebSocket Emission',
    command: 'npm',
    args: ['test', '--testNamePattern="WebSocket Emission Tests"'],
    cwd: __dirname,
    description: 'Verify that createSettlement only triggers one WebSocket emission'
  },
  {
    name: '2. Integration Tests - Concurrent Settlements',
    command: 'npm', 
    args: ['test', '--testNamePattern="Concurrent Settlement Integration Tests"'],
    cwd: __dirname,
    description: 'Simulate concurrent settlement requests and verify database integrity'
  },
  {
    name: '3. Frontend Tests - UI Render Optimization',
    command: 'npm',
    args: ['test', '--testNamePattern="Settlement Form Render Tests"'],
    cwd: path.join(__dirname, '../frontend'),
    description: 'Assert that UI updates exactly once without extra renders'
  }
];

// Function to run a single test
function runTest(testConfig) {
  return new Promise((resolve, reject) => {
    console.log(`\n🏃 Running: ${testConfig.name}`);
    console.log(`📝 Description: ${testConfig.description}`);
    console.log(`📂 Directory: ${testConfig.cwd}`);
    console.log(`⚡ Command: ${testConfig.command} ${testConfig.args.join(' ')}`);
    console.log('-'.repeat(50));

    const process = spawn(testConfig.command, testConfig.args, {
      cwd: testConfig.cwd,
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testConfig.name} - PASSED`);
        resolve(code);
      } else {
        console.log(`❌ ${testConfig.name} - FAILED (exit code: ${code})`);
        resolve(code); // Don't reject to allow other tests to run
      }
    });

    process.on('error', (error) => {
      console.error(`💥 Error running ${testConfig.name}:`, error.message);
      resolve(1); // Don't reject to allow other tests to run
    });
  });
}

// Run all tests sequentially
async function runAllTests() {
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push({
      name: test.name,
      passed: result === 0,
      exitCode: result
    });
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.name}`);
    
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  console.log('-'.repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  
  if (failedCount === 0) {
    console.log('\n🎉 All tests passed! Settlement functionality is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚡ Test execution interrupted by user.');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚡ Test execution terminated.');
  process.exit(1);
});

// Start test execution
console.log('Starting automated test suite...\n');
runAllTests().catch((error) => {
  console.error('💥 Fatal error during test execution:', error);
  process.exit(1);
});
