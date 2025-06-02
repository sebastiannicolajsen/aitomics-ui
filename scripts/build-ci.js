const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set environment variables to match CI
process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';
process.env.ELECTRON_VERSION = '28.1.0';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.NPM_CONFIG_FETCH_TIMEOUT = '300000';
process.env.NPM_CONFIG_FETCH_RETRIES = '5';

// Function to clean dist directory
function cleanDist() {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
        console.log('Cleaning dist directory...');
        try {
            // Use rimraf through execSync for more robust deletion
            if (os.platform() === 'win32') {
                execSync(`rimraf "${distPath}"`, { stdio: 'inherit' });
            } else {
                execSync(`rm -rf "${distPath}"`, { stdio: 'inherit' });
            }
        } catch (error) {
            console.warn('Warning: Could not clean dist directory completely:', error.message);
            // Continue with the build process even if cleaning fails
        }
    }
}

// Function to handle icon file permissions on macOS
function handleIconFile() {
    if (os.platform() === 'darwin') {
        const iconPath = path.join(process.cwd(), 'build', 'icon.icns');
        if (fs.existsSync(iconPath)) {
            console.log('Setting icon file permissions...');
            fs.chmodSync(iconPath, 0o644);
        }
    }
}

// Function to run commands with proper error handling
function runCommand(command, errorMessage) {
    try {
        console.log(`Running: ${command}`);
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(errorMessage);
        console.error(error);
        process.exit(1);
    }
}

// Main build process
try {
    console.log('Starting CI-like build process...');
    
    // Clean dist directory
    cleanDist();
    
    // Handle icon file permissions
    handleIconFile();
    
    // Run the build process
    console.log('Building renderer...');
    runCommand('cd src/renderer && npm run build && cd ../..', 'Failed to build renderer');
    
    console.log('Building preload...');
    runCommand('npm run build-preload', 'Failed to build preload');
    
    console.log('Preparing flow dependencies...');
    runCommand('npm run prepare-flow-deps', 'Failed to prepare flow dependencies');
    
    console.log('Running electron-builder...');
    runCommand('npm run dist', 'Failed to build with electron-builder');
    
    console.log('Build completed successfully!');
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
} 