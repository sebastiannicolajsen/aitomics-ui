const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Check if we're in a CI environment
if (process.env.CI) {
  console.log('Running in CI environment, skipping release creation');
  process.exit(0);
}

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse current version
const currentVersion = packageJson.version;
const versionMatch = currentVersion.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);

if (!versionMatch) {
  console.error('Invalid version format. Expected format: x.x.x-beta.x');
  process.exit(1);
}

// Increment beta version
const [, baseVersion, betaNumber] = versionMatch;
const newBetaNumber = parseInt(betaNumber, 10) + 1;
const newVersion = `${baseVersion}-beta.${newBetaNumber}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Files to include in the release
const filesToStage = [
  'package.json',
  'src/renderer/src/components/VersionInfo.tsx',
  'src/renderer/src/types/electron.d.ts'
];

try {
  // Stage files
  execSync(`git add ${filesToStage.join(' ')}`, { stdio: 'inherit' });

  // Commit changes
  execSync(`git commit -m "Update version to ${newVersion}"`, { stdio: 'inherit' });

  // Push to main
  execSync('git push origin main', { stdio: 'inherit' });

  // Create and push tag
  execSync(`git tag -a v${newVersion} -m "Beta release ${newBetaNumber}"`, { stdio: 'inherit' });
  execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });

  console.log(`\n🎉 Successfully released version ${newVersion}!`);
} catch (error) {
  console.error('\n❌ Error during release process:', error.message);
  // Revert package.json version if something went wrong
  packageJson.version = currentVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  process.exit(1);
} 