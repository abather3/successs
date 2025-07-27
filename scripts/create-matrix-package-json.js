#!/usr/bin/env node

/**
 * Create Matrix Package.json Script
 * 
 * This script modifies package.json files for dependency matrix testing by:
 * 1. Parsing the dependency combination configuration
 * 2. Creating backup copies of original package.json files
 * 3. Updating package.json files with specific dependency versions
 * 4. Handling version resolution for canary/beta/alpha releases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Resolve package version (handles special cases like 'latest', 'canary.latest', etc.)
 */
function resolvePackageVersion(packageName, versionSpec) {
  try {
    if (versionSpec.includes('canary.latest')) {
      // Get the latest canary version
      const result = execSync(`npm view ${packageName}@canary version --json`, { encoding: 'utf8' });
      return JSON.parse(result);
    } else if (versionSpec.includes('beta.latest')) {
      // Get the latest beta version
      const result = execSync(`npm view ${packageName}@beta version --json`, { encoding: 'utf8' });
      return JSON.parse(result);
    } else if (versionSpec.includes('alpha.latest')) {
      // Get the latest alpha version
      const result = execSync(`npm view ${packageName}@alpha version --json`, { encoding: 'utf8' });
      return JSON.parse(result);
    } else {
      return versionSpec;
    }
  } catch (error) {
    console.warn(`Warning: Could not resolve version for ${packageName}@${versionSpec}, using as-is`);
    return versionSpec;
  }
}

/**
 * Create backup of package.json file
 */
function createBackup(filePath) {
  const backupPath = `${filePath}.matrix-backup`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`✓ Created backup: ${backupPath}`);
  }
}

/**
 * Restore package.json from backup
 */
function restoreFromBackup(filePath) {
  const backupPath = `${filePath}.matrix-backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log(`✓ Restored from backup: ${filePath}`);
  }
}

/**
 * Update package.json with specific dependency versions
 */
function updatePackageJson(filePath, dependencies) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} does not exist, skipping`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  // Update dependencies
  for (const [depName, version] of Object.entries(dependencies)) {
    const resolvedVersion = resolvePackageVersion(depName, version);
    
    // Check in dependencies
    if (packageJson.dependencies && packageJson.dependencies[depName]) {
      packageJson.dependencies[depName] = resolvedVersion;
      modified = true;
      console.log(`✓ Updated ${depName}: ${resolvedVersion} in dependencies`);
    }
    
    // Check in devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies[depName]) {
      packageJson.devDependencies[depName] = resolvedVersion;
      modified = true;
      console.log(`✓ Updated ${depName}: ${resolvedVersion} in devDependencies`);
    }
    
    // Check in peerDependencies
    if (packageJson.peerDependencies && packageJson.peerDependencies[depName]) {
      packageJson.peerDependencies[depName] = resolvedVersion;
      modified = true;
      console.log(`✓ Updated ${depName}: ${resolvedVersion} in peerDependencies`);
    }

    // Handle special package name mappings
    const packageMappings = {
      'mui': '@mui/material',
      'socket.io': 'socket.io',
      'socket.io-client': 'socket.io-client'
    };

    const mappedName = packageMappings[depName] || depName;
    if (mappedName !== depName) {
      // Update mapped dependencies
      if (packageJson.dependencies && packageJson.dependencies[mappedName]) {
        packageJson.dependencies[mappedName] = resolvedVersion;
        modified = true;
        console.log(`✓ Updated ${mappedName}: ${resolvedVersion} in dependencies (mapped from ${depName})`);
      }
      
      if (packageJson.devDependencies && packageJson.devDependencies[mappedName]) {
        packageJson.devDependencies[mappedName] = resolvedVersion;
        modified = true;
        console.log(`✓ Updated ${mappedName}: ${resolvedVersion} in devDependencies (mapped from ${depName})`);
      }
    }
  }

  // Write updated package.json
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
}

/**
 * Handle Node.js version updates
 */
function updateNodeVersion(combination) {
  if (combination.node_version) {
    // Update package.json engines field if it exists
    const rootPackageJsonPath = 'package.json';
    if (fs.existsSync(rootPackageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
      
      if (!packageJson.engines) {
        packageJson.engines = {};
      }
      
      packageJson.engines.node = `>=${combination.node_version}`;
      fs.writeFileSync(rootPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`✓ Updated Node.js version requirement to ${combination.node_version}`);
    }

    // Create .nvmrc file
    fs.writeFileSync('.nvmrc', combination.node_version);
    console.log(`✓ Created .nvmrc with Node.js ${combination.node_version}`);
  }
}

/**
 * Main function
 */
function main() {
  const combinationJson = process.argv[2];
  
  if (!combinationJson) {
    console.error('Usage: node create-matrix-package-json.js <combination-json>');
    process.exit(1);
  }

  let combination;
  try {
    combination = JSON.parse(combinationJson);
  } catch (error) {
    console.error('Error parsing combination JSON:', error.message);
    process.exit(1);
  }

  console.log(`\n🔧 Setting up dependency matrix: ${combination.name}`);
  console.log('=' .repeat(50));

  // Create backups
  const packageFiles = [
    'package.json',
    'backend/package.json',
    'frontend/package.json'
  ];

  packageFiles.forEach(createBackup);

  try {
    // Update Node.js version
    updateNodeVersion(combination);

    // Update backend dependencies
    if (combination.backend) {
      console.log('\n📦 Updating backend dependencies...');
      updatePackageJson('backend/package.json', combination.backend);
    }

    // Update frontend dependencies
    if (combination.frontend) {
      console.log('\n🎨 Updating frontend dependencies...');
      updatePackageJson('frontend/package.json', combination.frontend);
    }

    // Update root dependencies (if any)
    if (combination.root) {
      console.log('\n🏠 Updating root dependencies...');
      updatePackageJson('package.json', combination.root);
    }

    console.log('\n✅ Package.json files updated successfully!');
    
    // Print summary
    console.log('\n📋 Summary of changes:');
    console.log(`Matrix: ${combination.name}`);
    if (combination.node_version) {
      console.log(`Node.js: ${combination.node_version}`);
    }
    
    if (combination.backend) {
      console.log('Backend dependencies:');
      Object.entries(combination.backend).forEach(([name, version]) => {
        console.log(`  - ${name}: ${version}`);
      });
    }
    
    if (combination.frontend) {
      console.log('Frontend dependencies:');
      Object.entries(combination.frontend).forEach(([name, version]) => {
        console.log(`  - ${name}: ${version}`);
      });
    }

    if (combination.expected_issues) {
      console.log('\n⚠️  Expected issues:');
      combination.expected_issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error updating package.json files:', error.message);
    
    // Restore backups on error
    console.log('\n🔄 Restoring backups...');
    packageFiles.forEach(restoreFromBackup);
    
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🔄 Cleaning up...');
  const packageFiles = [
    'package.json',
    'backend/package.json',
    'frontend/package.json'
  ];
  packageFiles.forEach(restoreFromBackup);
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = {
  updatePackageJson,
  resolvePackageVersion,
  createBackup,
  restoreFromBackup
};
