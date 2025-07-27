#!/usr/bin/env node

/**
 * Generate Final Compatibility Matrix Script
 * 
 * This script aggregates all test results and generates a comprehensive compatibility matrix report.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Parse test results from artifacts
 */
function parseTestResults(artifactsPath) {
  const results = [];
  
  if (!fs.existsSync(artifactsPath)) {
    console.warn(`Artifacts path ${artifactsPath} does not exist`);
    return results;
  }

  const artifactDirs = fs.readdirSync(artifactsPath).filter(dir => 
    fs.statSync(path.join(artifactsPath, dir)).isDirectory()
  );

  for (const dir of artifactDirs) {
    console.log(`Processing artifact directory: ${dir}`);
    
    // Extract combination type and name from directory name
    const [type, ...nameParts] = dir.replace('-test-results-', '|').split('|');
    const combinationName = nameParts.join('|');
    
    const result = {
      type: type,
      combination: combinationName,
      status: 'unknown',
      buildSuccess: false,
      testsPassed: 0,
      testsFailed: 0,
      coverage: 0,
      issues: []
    };

    // Look for test result files
    const artifactPath = path.join(artifactsPath, dir);
    
    // Check for backend coverage
    const backendCoveragePath = path.join(artifactPath, 'backend', 'coverage', 'coverage-summary.json');
    if (fs.existsSync(backendCoveragePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(backendCoveragePath, 'utf8'));
        result.backendCoverage = coverage.total;
      } catch (error) {
        console.warn(`Could not parse backend coverage for ${dir}:`, error.message);
      }
    }

    // Check for frontend coverage
    const frontendCoveragePath = path.join(artifactPath, 'frontend', 'coverage', 'coverage-summary.json');
    if (fs.existsSync(frontendCoveragePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(frontendCoveragePath, 'utf8'));
        result.frontendCoverage = coverage.total;
      } catch (error) {
        console.warn(`Could not parse frontend coverage for ${dir}:`, error.message);
      }
    }

    // Check for playwright test results
    const playwrightResultPath = path.join(artifactPath, 'test-results');
    if (fs.existsSync(playwrightResultPath)) {
      result.e2eTestsRun = true;
    }

    // Check for compatibility report
    const compatibilityReportPath = path.join(artifactPath, 'compatibility-reports');
    if (fs.existsSync(compatibilityReportPath)) {
      const reportFiles = fs.readdirSync(compatibilityReportPath);
      for (const reportFile of reportFiles) {
        if (reportFile.endsWith('-report.json')) {
          try {
            const report = JSON.parse(fs.readFileSync(path.join(compatibilityReportPath, reportFile), 'utf8'));
            result.compatibilityReport = report;
            result.status = report.isCompatible ? 'compatible' : 'incompatible';
          } catch (error) {
            console.warn(`Could not parse compatibility report ${reportFile}:`, error.message);
          }
        }
      }
    }

    // Determine overall status
    if (result.status === 'unknown') {
      if (result.backendCoverage || result.frontendCoverage || result.e2eTestsRun) {
        result.status = 'partial';
      } else {
        result.status = 'failed';
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Load dependency matrix configuration
 */
function loadDependencyMatrix() {
  try {
    const yamlContent = fs.readFileSync('dependency-matrix.yml', 'utf8');
    return yaml.load(yamlContent);
  } catch (error) {
    console.error('Could not load dependency-matrix.yml:', error.message);
    return null;
  }
}

/**
 * Generate HTML report
 */
function generateHtmlReport(results, matrixConfig) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EscaShop Dependency Compatibility Matrix</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        .matrix-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .matrix-table th,
        .matrix-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: center;
        }
        .matrix-table th {
            background-color: #34495e;
            color: white;
            font-weight: bold;
        }
        .status-compatible {
            background-color: #2ecc71;
            color: white;
        }
        .status-incompatible {
            background-color: #e74c3c;
            color: white;
        }
        .status-partial {
            background-color: #f39c12;
            color: white;
        }
        .status-failed {
            background-color: #95a5a6;
            color: white;
        }
        .status-unknown {
            background-color: #bdc3c7;
            color: #2c3e50;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .summary-card {
            background: #ecf0f1;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        .summary-card .number {
            font-size: 2em;
            font-weight: bold;
            color: #34495e;
        }
        .details {
            margin-top: 30px;
        }
        .details h2 {
            color: #2c3e50;
            border-bottom: 2px solid #34495e;
            padding-bottom: 10px;
        }
        .combination-details {
            margin: 15px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background: #fafafa;
        }
        .dependency-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin: 10px 0;
        }
        .dependency-item {
            background: white;
            padding: 8px;
            border-radius: 4px;
            border-left: 4px solid #3498db;
        }
        .timestamp {
            text-align: center;
            color: #7f8c8d;
            margin-top: 30px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 EscaShop Dependency Compatibility Matrix</h1>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Combinations</h3>
                <div class="number">${results.length}</div>
            </div>
            <div class="summary-card">
                <h3>Compatible</h3>
                <div class="number" style="color: #2ecc71">${results.filter(r => r.status === 'compatible').length}</div>
            </div>
            <div class="summary-card">
                <h3>Incompatible</h3>
                <div class="number" style="color: #e74c3c">${results.filter(r => r.status === 'incompatible').length}</div>
            </div>
            <div class="summary-card">
                <h3>Partial/Failed</h3>
                <div class="number" style="color: #f39c12">${results.filter(r => ['partial', 'failed', 'unknown'].includes(r.status)).length}</div>
            </div>
        </div>

        <table class="matrix-table">
            <thead>
                <tr>
                    <th>Combination</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Backend Coverage</th>
                    <th>Frontend Coverage</th>
                    <th>E2E Tests</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td><strong>${result.combination}</strong></td>
                        <td><span style="text-transform: capitalize; padding: 4px 8px; background: #ecf0f1; border-radius: 3px;">${result.type}</span></td>
                        <td class="status-${result.status}">${result.status.toUpperCase()}</td>
                        <td>${result.backendCoverage ? `${result.backendCoverage.lines.pct}%` : 'N/A'}</td>
                        <td>${result.frontendCoverage ? `${result.frontendCoverage.lines.pct}%` : 'N/A'}</td>
                        <td>${result.e2eTestsRun ? '✅' : '❌'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="details">
            <h2>🔍 Detailed Results</h2>
            ${results.map(result => `
                <div class="combination-details">
                    <h3>${result.combination} (${result.type})</h3>
                    <p><strong>Status:</strong> <span class="status-${result.status}" style="padding: 2px 8px; border-radius: 3px;">${result.status.toUpperCase()}</span></p>
                    
                    ${result.compatibilityReport ? `
                        <h4>Dependencies:</h4>
                        ${result.compatibilityReport.frontendDependencies ? `
                            <div>
                                <strong>Frontend:</strong>
                                <div class="dependency-list">
                                    ${Object.entries(result.compatibilityReport.frontendDependencies).map(([name, version]) => 
                                        `<div class="dependency-item">${name}: ${version}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${result.compatibilityReport.backendDependencies ? `
                            <div>
                                <strong>Backend:</strong>
                                <div class="dependency-list">
                                    ${Object.entries(result.compatibilityReport.backendDependencies).map(([name, version]) => 
                                        `<div class="dependency-item">${name}: ${version}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <p><strong>Node.js:</strong> ${result.compatibilityReport.nodeVersion}</p>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            Report generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
  `;

  return html;
}

/**
 * Generate markdown summary
 */
function generateMarkdownSummary(results) {
  const compatible = results.filter(r => r.status === 'compatible').length;
  const incompatible = results.filter(r => r.status === 'incompatible').length;
  const partial = results.filter(r => ['partial', 'failed', 'unknown'].includes(r.status)).length;

  const markdown = `
# 📊 Dependency Compatibility Matrix Results

## Summary
- **Total Combinations Tested:** ${results.length}
- **✅ Compatible:** ${compatible}
- **❌ Incompatible:** ${incompatible}  
- **⚠️ Partial/Failed:** ${partial}

## Results by Category

### Baseline Tests (Current Stable Versions)
${results.filter(r => r.type === 'baseline').map(r => 
  `- **${r.combination}**: ${r.status === 'compatible' ? '✅' : r.status === 'incompatible' ? '❌' : '⚠️'} ${r.status.toUpperCase()}`
).join('\n')}

### Next Major Version Tests
${results.filter(r => r.type === 'next-major').map(r => 
  `- **${r.combination}**: ${r.status === 'compatible' ? '✅' : r.status === 'incompatible' ? '❌' : '⚠️'} ${r.status.toUpperCase()}`
).join('\n')}

### Mixed Version Tests
${results.filter(r => r.type === 'mixed-version').map(r => 
  `- **${r.combination}**: ${r.status === 'compatible' ? '✅' : r.status === 'incompatible' ? '❌' : '⚠️'} ${r.status.toUpperCase()}`
).join('\n')}

## Recommendations

${compatible === results.length ? 
  '🎉 All dependency combinations are compatible! Your application is ready for the tested dependency updates.' :
  incompatible > 0 ?
    `⚠️ ${incompatible} combinations show incompatibilities. Review the detailed reports before upgrading dependencies.` :
    '⚠️ Some tests could not complete successfully. Review the test infrastructure and try again.'
}

---
*Report generated on ${new Date().toLocaleString()}*
  `;

  return markdown;
}

/**
 * Main function
 */
function main() {
  console.log('🔄 Generating final compatibility matrix...');

  // Parse test results from artifacts
  const results = parseTestResults('test-artifacts');
  
  // Load matrix configuration
  const matrixConfig = loadDependencyMatrix();

  // Generate reports
  const htmlReport = generateHtmlReport(results, matrixConfig);
  const markdownSummary = generateMarkdownSummary(results);
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      compatible: results.filter(r => r.status === 'compatible').length,
      incompatible: results.filter(r => r.status === 'incompatible').length,
      partial: results.filter(r => ['partial', 'failed', 'unknown'].includes(r.status)).length
    },
    results: results,
    matrixConfig: matrixConfig
  };

  // Write reports
  fs.writeFileSync('compatibility-matrix.html', htmlReport);
  fs.writeFileSync('compatibility-matrix.json', JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync('compatibility-summary.md', markdownSummary);

  console.log('✅ Final compatibility matrix generated:');
  console.log('  - compatibility-matrix.html (detailed HTML report)');
  console.log('  - compatibility-matrix.json (machine-readable data)');
  console.log('  - compatibility-summary.md (summary for PR comments)');

  // Print summary to console
  console.log('\n📊 Summary:');
  console.log(`Total combinations: ${results.length}`);
  console.log(`Compatible: ${results.filter(r => r.status === 'compatible').length}`);
  console.log(`Incompatible: ${results.filter(r => r.status === 'incompatible').length}`);
  console.log(`Partial/Failed: ${results.filter(r => ['partial', 'failed', 'unknown'].includes(r.status)).length}`);
}

// Simple yaml loader (since js-yaml might not be available)
const yaml = {
  load: (content) => {
    try {
      // This is a very basic YAML parser - in production, use a proper library
      return require('js-yaml').load(content);
    } catch (error) {
      console.warn('js-yaml not available, using fallback parser');
      // Fallback: return empty config
      return { dependencies: {}, test_matrices: {} };
    }
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  parseTestResults,
  generateHtmlReport,
  generateMarkdownSummary,
  main
};
