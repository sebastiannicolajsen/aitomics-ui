const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Function to read package.json and get dependencies
function getPackageDependencies(pkgPath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8'));
    const dependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.peerDependencies || {},
      ...packageJson.optionalDependencies || {}
    };
    return { version: packageJson.version, dependencies };
  } catch (e) {
    console.error(`Error reading package.json for ${pkgPath}:`, e);
    return { version: '0.0.0', dependencies: {} };
  }
}

// Function to recursively collect all dependencies
function collectDependencies(pkgName, pkgPath, rootNodeModules, collected = new Map()) {
  if (collected.has(pkgName)) {
    return collected;
  }

  const { version, dependencies } = getPackageDependencies(pkgPath);
  collected.set(pkgName, { path: pkgPath, version });

  // Recursively collect dependencies
  for (const [depName, depVersion] of Object.entries(dependencies)) {
    // Skip internal dependencies and those that don't need to be copied
    if (depName === 'aitomics' || depName.startsWith('@types/')) {
      continue;
    }

    const depPath = path.join(rootNodeModules, depName);
    if (fs.existsSync(depPath)) {
      collectDependencies(depName, depPath, rootNodeModules, collected);
    } else {
      console.warn(`Dependency ${depName} not found at ${depPath}`);
    }
  }

  return collected;
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function prepareDependencies() {
  console.log('Preparing flow dependencies...');

  // Get the app path and node_modules location
  const appPath = process.cwd(); // Use current working directory instead of app.getAppPath()
  console.log('App path:', appPath);

  // Find the correct node_modules path
  const possibleNodeModulesPaths = [
    path.join(appPath, 'node_modules'),
    path.join(appPath, '..', 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
    path.join(__dirname, '..', '..', 'node_modules')
  ];

  const rootNodeModules = possibleNodeModulesPaths.find(p => fs.existsSync(p));
  if (!rootNodeModules) {
    throw new Error('Could not find node_modules directory');
  }
  console.log('Using node_modules path:', rootNodeModules);

  // Define main packages
  const mainPackages = [
    { name: 'csv-parse', path: path.join(rootNodeModules, 'csv-parse') },
    { name: 'hash-it', path: path.join(rootNodeModules, 'hash-it') },
    { name: 'yaml', path: path.join(rootNodeModules, 'yaml') },
    { name: 'yaml-schema-validator', path: path.join(rootNodeModules, 'yaml-schema-validator') },
    { name: 'mermaid', path: path.join(rootNodeModules, 'mermaid') },
    { name: 'axios', path: path.join(rootNodeModules, 'axios') },
    { name: 'aitomics', path: path.join(rootNodeModules, 'aitomics') }
  ];

  // Collect all dependencies
  const allDependencies = new Map();
  for (const pkg of mainPackages) {
    collectDependencies(pkg.name, pkg.path, rootNodeModules, allDependencies);
  }

  console.log('Collected dependencies:', 
    Array.from(allDependencies.entries()).map(([name, info]) => ({
      name,
      version: info.version
    }))
  );

  // Create a build-time directory for flow dependencies
  const flowDepsDir = path.join(appPath, 'build', 'flow-dependencies');
  console.log('Creating flow dependencies directory:', flowDepsDir);
  if (!fs.existsSync(flowDepsDir)) {
    fs.mkdirSync(flowDepsDir, { recursive: true });
  }

  // Create package.json with all dependencies
  const packageJsonPath = path.join(flowDepsDir, 'package.json');
  const packageJsonContent = {
    name: 'aitomics-flow-deps',
    version: '1.0.0',
    type: 'commonjs',
    dependencies: Object.fromEntries(
      Array.from(allDependencies.entries()).map(([name, info]) => [name, info.version])
    )
  };
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
  console.log('Created package.json');

  // Create node_modules directory
  const depsNodeModules = path.join(flowDepsDir, 'node_modules');
  if (!fs.existsSync(depsNodeModules)) {
    fs.mkdirSync(depsNodeModules, { recursive: true });
  }

  // Sort packages to ensure dependencies are copied first
  const packagesToCopy = Array.from(allDependencies.entries())
    .map(([name, info]) => ({ name, path: info.path }))
    .sort((a, b) => {
      const aDeps = getPackageDependencies(a.path).dependencies;
      const bDeps = getPackageDependencies(b.path).dependencies;
      if (aDeps[b.name]) return -1;
      if (bDeps[a.name]) return 1;
      return 0;
    });

  // Copy all packages
  for (const pkg of packagesToCopy) {
    const targetPath = path.join(depsNodeModules, pkg.name);
    console.log(`Copying package ${pkg.name}...`);
    if (!fs.existsSync(targetPath)) {
      try {
        copyDir(pkg.path, targetPath);
        console.log(`Copied ${pkg.name}`);
      } catch (e) {
        console.error(`Failed to copy package ${pkg.name}:`, e);
        throw e;
      }
    } else {
      console.log(`Package ${pkg.name} already exists`);
    }
  }

  // Create a version file to track when dependencies were last updated
  const versionInfo = {
    timestamp: Date.now(),
    nodeVersion: process.version,
    dependencies: Array.from(allDependencies.entries()).map(([name, info]) => ({
      name,
      version: info.version
    }))
  };
  fs.writeFileSync(
    path.join(flowDepsDir, 'version.json'),
    JSON.stringify(versionInfo, null, 2)
  );

  console.log('Flow dependencies prepared successfully');
  return flowDepsDir;
}

// Run the preparation if this script is run directly
if (require.main === module) {
  prepareDependencies().catch(console.error);
}

module.exports = { prepareDependencies }; 