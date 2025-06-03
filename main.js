const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { parse } = require('csv-parse/sync');
const { spawn } = require('child_process');
const Module = require('module');  // Add Module for proper module loading
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');

// Get the correct path for the scripts directory
const scriptsPath = app.isPackaged 
  ? path.join(process.resourcesPath, 'app.asar.unpacked/scripts')
  : path.join(__dirname, 'scripts');

// Import prepareDependencies with the correct path
const { prepareDependencies } = require(path.join(scriptsPath, 'prepare-flow-deps'));

// Set up logging
let logStream;
try {
  const logFile = path.join(app.getPath('userData'), 'app.log');
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  // Store original console methods
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console)
  };

  // Create logging function
  function logToFile(level, ...args) {
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      const logMessage = `[${timestamp}] [${level}] ${message}\n`;
      
      // Write to file
      if (logStream && logStream.writable) {
        logStream.write(logMessage);
      }
      
      // Call original console method
      if (typeof originalConsole[level] === 'function') {
        originalConsole[level](...args);
      }
    } catch (err) {
      // If logging fails, at least try to write to original console
      if (typeof originalConsole[level] === 'function') {
        originalConsole[level](...args);
      }
    }
  }

  // Override console methods
  console.log = (...args) => logToFile('INFO', ...args);
  console.error = (...args) => logToFile('ERROR', ...args);
  console.warn = (...args) => logToFile('WARN', ...args);
  console.debug = (...args) => logToFile('DEBUG', ...args);

  // Log initial app info
  console.log('Logging initialized');
  console.log('App paths:', {
    userData: app.getPath('userData'),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    logFile
  });
} catch (err) {
  // If logging setup fails, at least log the error to the original console
  console.error('Failed to initialize logging:', err);
}

// Initialize store for project data
const store = new Store({
  name: 'projects',
  clearInvalidConfig: true
});

// Initialize store for actions
const actionStore = new Store({
  name: 'actions',
  clearInvalidConfig: true
});

// Initialize store for app settings
const appStore = new Store({
  name: 'app-settings',
  clearInvalidConfig: true
});

// Set development mode only if not packaged and NODE_ENV is not explicitly set to production
if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'development';
} else {
  process.env.NODE_ENV = 'production';
}

console.log('Starting app in mode:', process.env.NODE_ENV);

let mainWindow = null;
let currentFlowProcess = null;
let isAppReady = false;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'checking');
  }
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'available', info);
  }
});

autoUpdater.on('update-not-available', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'not-available');
  }
});

autoUpdater.on('error', (err) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'error', err.message);
  }
});

// Register IPC handlers
function registerIpcHandlers() {
  // Test IPC handler
  ipcMain.handle('test-ipc', () => {
    return 'IPC test successful';
  });

  // Add flow execution handler
  ipcMain.handle('execute-flow', async (event, code) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      throw new Error('No focused window found');
    }

    try {
      console.log('[FLOW_DEBUG] ===== Starting Flow Execution =====');
      
      // Check and update dependencies if needed
      const flowDepsDir = await checkAndUpdateDependencies();
      console.log('[FLOW_DEBUG] Using flow dependencies from:', flowDepsDir);
      
      // Verify the dependencies directory structure
      try {
        const depsNodeModules = path.join(flowDepsDir, 'node_modules');
        console.log('[FLOW_DEBUG] Checking dependencies directory structure:');
        console.log('[FLOW_DEBUG] - Dependencies directory exists:', fs.existsSync(flowDepsDir));
        console.log('[FLOW_DEBUG] - node_modules exists:', fs.existsSync(depsNodeModules));
        if (fs.existsSync(depsNodeModules)) {
          const csvParsePath = path.join(depsNodeModules, 'csv-parse');
          console.log('[FLOW_DEBUG] - csv-parse exists:', fs.existsSync(csvParsePath));
          if (fs.existsSync(csvParsePath)) {
            console.log('[FLOW_DEBUG] - csv-parse contents:', fs.readdirSync(csvParsePath));
            const packageJsonPath = path.join(csvParsePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
              console.log('[FLOW_DEBUG] - csv-parse package.json:', packageJson);
            }
          }
        }
      } catch (e) {
        console.error('[FLOW_DEBUG] Error checking dependencies:', e);
      }

      // Create temporary directory for this execution
      const tempDir = path.join(app.getPath('temp'), 'aitomics-flow');
      console.log('[FLOW_DEBUG] Creating temp directory:', tempDir);
      try {
        // Clean up any existing temp directory
        if (fs.existsSync(tempDir)) {
          console.log('[FLOW_DEBUG] Cleaning up existing temp directory');
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('[FLOW_DEBUG] Temp directory created successfully');
      } catch (e) {
        console.error('[FLOW_DEBUG] Failed to create temp directory:', e);
        throw new Error(`Failed to create temp directory: ${e.message}`);
      }

      // Create a symbolic link to the prepared node_modules
      const tempNodeModules = path.join(tempDir, 'node_modules');
      try {
        console.log('[FLOW_DEBUG] Creating symbolic link from:', path.join(flowDepsDir, 'node_modules'), 'to:', tempNodeModules);
        // Verify source exists before creating symlink
        const sourcePath = path.join(flowDepsDir, 'node_modules');
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Source node_modules directory does not exist: ${sourcePath}`);
        }
        fs.symlinkSync(sourcePath, tempNodeModules, 'dir');
        console.log('[FLOW_DEBUG] Created symbolic link to prepared node_modules');
        
        // Verify the symlink was created correctly
        if (!fs.existsSync(tempNodeModules)) {
          throw new Error('Symbolic link was not created successfully');
        }
        console.log('[FLOW_DEBUG] Verified symbolic link exists');
        
        // Check if csv-parse is accessible through the symlink
        const csvParsePath = path.join(tempNodeModules, 'csv-parse');
        console.log('[FLOW_DEBUG] Checking csv-parse through symlink:');
        console.log('[FLOW_DEBUG] - csv-parse exists:', fs.existsSync(csvParsePath));
        if (fs.existsSync(csvParsePath)) {
          console.log('[FLOW_DEBUG] - csv-parse contents:', fs.readdirSync(csvParsePath));
        }
      } catch (e) {
        console.error('[FLOW_DEBUG] Failed to create symbolic link:', e);
        // Clean up temp directory before rethrowing
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('[FLOW_DEBUG] Failed to clean up temp directory after symlink error:', cleanupError);
        }
        throw new Error(`Failed to create symbolic link: ${e.message}`);
      }

      // Copy the package.json from the prepared dependencies
      try {
        fs.copyFileSync(
          path.join(flowDepsDir, 'package.json'),
          path.join(tempDir, 'package.json')
        );
        console.log('[FLOW_DEBUG] Copied package.json from prepared dependencies');
      } catch (e) {
        console.error('[FLOW_DEBUG] Failed to copy package.json:', e);
        // Clean up temp directory before rethrowing
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('[FLOW_DEBUG] Failed to clean up temp directory after copy error:', cleanupError);
        }
        throw new Error(`Failed to copy package.json: ${e.message}`);
      }

      // Create the flow execution file
      const tempFile = path.join(tempDir, `flow-${Date.now()}.js`);
      console.log('[FLOW_DEBUG] Temp file path:', tempFile);

      // Wrap the code to handle console output and module resolution
      console.log('[FLOW_DEBUG] Writing wrapped code to temp file');
      const wrappedCode = [
        // Set up module resolution
        "const Module = require('module');",
        "const originalResolveFilename = Module._resolveFilename;",
        "const path = require('path');",
        "const fs = require('fs');",
        "",
        // Override module resolution to include our paths
        "Module._resolveFilename = function(request, parent, isMain, options) {",
        "  console.log('[FLOW_DEBUG] Resolving module:', request);",
        "  console.log('[FLOW_DEBUG] Parent module:', parent ? parent.filename : 'none');",
        "  try {",
        "    // First try the original resolution",
        "    const result = originalResolveFilename(request, parent, isMain, options);",
        "    console.log('[FLOW_DEBUG] Original resolution succeeded:', result);",
        "    return result;",
        "  } catch (err) {",
        "    console.log('[FLOW_DEBUG] Original resolution failed:', err.message);",
        "    // Try to resolve in our node_modules",
        `    const additionalPaths = ${JSON.stringify([tempNodeModules])};`,
        "    console.log('[FLOW_DEBUG] Trying additional paths:', additionalPaths);",
        "    for (const nodeModulesPath of additionalPaths) {",
        "      try {",
        "        // Try direct resolution first",
        "        console.log('[FLOW_DEBUG] Trying direct resolution in:', nodeModulesPath);",
        "        const fullPath = require.resolve(request, { paths: [nodeModulesPath] });",
        "        if (fullPath) {",
        "          console.log('[FLOW_DEBUG] Direct resolution succeeded:', fullPath);",
        "          return fullPath;",
        "        }",
        "      } catch (e) {",
        "        console.log('[FLOW_DEBUG] Direct resolution failed:', e.message);",
        "        // If direct resolution fails, try to find the package.json and resolve from there",
        "        try {",
        "          const packageName = request.split('/')[0];",
        "          const packageJsonPath = path.join(nodeModulesPath, packageName, 'package.json');",
        "          console.log('[FLOW_DEBUG] Looking for package.json at:', packageJsonPath);",
        "          if (fs.existsSync(packageJsonPath)) {",
        "            console.log('[FLOW_DEBUG] Found package.json');",
        "            const packageJson = require(packageJsonPath);",
        "            const mainFile = packageJson.main || 'index.js';",
        "            const mainPath = path.join(nodeModulesPath, packageName, mainFile);",
        "            console.log('[FLOW_DEBUG] Looking for main file at:', mainPath);",
        "            if (fs.existsSync(mainPath)) {",
        "              console.log('[FLOW_DEBUG] Found main file');",
        "              return mainPath;",
        "            }",
        "            // If main file doesn't exist, try index.js",
        "            const indexPath = path.join(nodeModulesPath, packageName, 'index.js');",
        "            console.log('[FLOW_DEBUG] Looking for index.js at:', indexPath);",
        "            if (fs.existsSync(indexPath)) {",
        "              console.log('[FLOW_DEBUG] Found index.js');",
        "              return indexPath;",
        "            }",
        "          }",
        "        } catch (packageErr) {",
        "          console.log('[FLOW_DEBUG] Package resolution failed:', packageErr.message);",
        "        }",
        "      }",
        "    }",
        "    // If all resolution attempts fail, throw the original error",
        "    console.error('[FLOW_DEBUG] Module resolution failed for:', request);",
        "    console.error('[FLOW_DEBUG] Tried paths:', additionalPaths);",
        "    throw err;",
        "  }",
        "};",
        "",
        // Add debug logging for module resolution
        "const originalRequire = Module.prototype.require;",
        "Module.prototype.require = function(request) {",
        "  try {",
        "    console.log('[FLOW_DEBUG] Requiring module:', request);",
        "    const result = originalRequire.apply(this, arguments);",
        "    console.log('[FLOW_DEBUG] Successfully required:', request);",
        "    return result;",
        "  } catch (err) {",
        "    console.error('[FLOW_DEBUG] Failed to require:', request);",
        "    console.error('[FLOW_DEBUG] Error:', err.message);",
        "    throw err;",
        "  }",
        "};",
        "",
        // Override console methods to use a single channel
        "const originalConsole = console;",
        "console = {",
        "  log: (...args) => {",
        "    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');",
        "    process.stdout.write(JSON.stringify({ type: 'log', message }) + '\\n');",
        "  },",
        "  error: (...args) => {",
        "    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');",
        "    process.stdout.write(JSON.stringify({ type: 'error', message }) + '\\n');",
        "  },",
        "  warn: (...args) => {",
        "    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');",
        "    process.stdout.write(JSON.stringify({ type: 'warn', message }) + '\\n');",
        "  }",
        "};",
        "",
        // Add status messages at the start
        "console.log('Starting flow execution...');",
        "",
        // Add process event handlers
        "process.on('exit', (code) => {",
        "  const message = code === 0 ? 'Flow execution completed successfully' : `Flow execution failed with code ${code}`;",
        "  console.log(message);",
        "});",
        "",
        "process.on('uncaughtException', (error) => {",
        "  console.error('Uncaught exception:', error.message);",
        "  console.error('Stack trace:', error.stack);",
        "  process.exit(1);",
        "});",
        "",
        // Add stdin handler for termination
        "process.stdin.on('data', (data) => {",
        "  try {",
        "    const message = JSON.parse(data.toString());",
        "    if (message.type === 'terminate') {",
        "      console.error('[FLOW_ERROR] Terminated by user');",
        "      process.exit(1);",
        "    }",
        "  } catch (e) {",
        "    // Ignore parsing errors",
        "  }",
        "});",
        "",
        // Wrap the flow execution in a Promise and ensure proper cleanup
        "new Promise(async (resolve, reject) => {",
        "  try {",
        "    // Execute the flow code and await its completion",
        "    // The generated code creates a flowExecutionPromise that we need to await",
        code,
        "",
        "    // Wait for the flow execution to complete",
        "    const result = await flowExecutionPromise;",
        "",
        "    // Clean up temporary files only after flow execution is complete",
        "    try {",
        `      fs.unlinkSync(${JSON.stringify(path.join(tempDir, 'package.json'))});`,
        "      fs.rmSync(tempNodeModules, { recursive: true, force: true });",
        "    } catch (e) {",
        "      // Ignore cleanup errors",
        "    }",
        "",
        "    // Log completion and resolve with the result",
        "    console.log('Flow execution completed successfully');",
        "    resolve(result);",
        "  } catch (error) {",
        "    // Log error and reject",
        "    console.error('Flow execution failed:', error.message);",
        "    console.error('Stack trace:', error.stack);",
        "    reject(error);",
        "  }",
        "}).then((result) => {",
        "  // Ensure process exits after successful execution",
        "  process.exit(0);",
        "}).catch((error) => {",
        "  // Ensure process exits after failed execution",
        "  process.exit(1);",
        "});"
      ].join('\n');

      fs.writeFileSync(tempFile, wrappedCode);
      console.log('[FLOW_DEBUG] Wrote wrapped code to temp file');

      // Get the correct Node.js executable path
      let nodeExecutable;
      if (app.isPackaged) {
        // In packaged app, use the bundled Node.js
        if (process.platform === 'win32') {
          nodeExecutable = path.join(process.resourcesPath, 'app.asar.unpacked/node.exe');
        } else {
          nodeExecutable = path.join(process.resourcesPath, 'app.asar.unpacked/node');
        }
        
        // Make sure the executable has the right permissions on Unix-like systems
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(nodeExecutable, '755');
          } catch (e) {
            console.error('[FLOW_DEBUG] Error setting Node.js permissions:', e);
          }
        }
        
        console.log('[FLOW_DEBUG] Using bundled Node.js at:', nodeExecutable);
        
        if (!fs.existsSync(nodeExecutable)) {
          throw new Error('Bundled Node.js not found. Please rebuild the application.');
        }
      } else {
        // In development, use the system Node.js
        nodeExecutable = process.execPath;
      }

      console.log('[FLOW_DEBUG] Using Node.js executable:', nodeExecutable);
      console.log('[FLOW_DEBUG] Node.js executable exists:', fs.existsSync(nodeExecutable));

      // Store the child process reference
      console.log('[FLOW_DEBUG] Spawning child process with:', {
        nodeExecutable,
        tempFile,
        env: {
          ...process.env,
          NODE_PATH: tempNodeModules,
          FORCE_COLOR: '1',
          DEBUG_COLORS: '1',
          ELECTRON_RUN_AS_NODE: '1'  // Important: Run as Node.js process
        }
      });

      currentFlowProcess = spawn(nodeExecutable, [tempFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_PATH: tempNodeModules,
          FORCE_COLOR: '1',
          DEBUG_COLORS: '1',
          ELECTRON_RUN_AS_NODE: '1'  // Important: Run as Node.js process
        },
        shell: false,
        detached: false  // Ensure process is not detached
      });

      // Log process events immediately
      currentFlowProcess.on('error', (error) => {
        console.error('[FLOW_DEBUG] Child process error:', error);
        mainWindow.webContents.send('flow-log', `[FLOW_ERROR] Child process error: ${error.message}`);
      });

      currentFlowProcess.on('exit', (code, signal) => {
        console.log('[FLOW_DEBUG] Child process exited:', { code, signal });
        if (code !== 0) {
          mainWindow.webContents.send('flow-log', `[FLOW_ERROR] Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}`);
        }
      });

      // Add stderr handling
      currentFlowProcess.stderr.on('data', (data) => {
        const errorMessage = data.toString();
        console.error('[FLOW_DEBUG] Child process stderr:', errorMessage);
        // Send the error to the renderer process
        mainWindow.webContents.send('flow-log', `[FLOW_ERROR] ${errorMessage}`);
      });

      return new Promise((resolve, reject) => {
        // Track sent messages to prevent duplicates
        const sentMessages = new Set();
        let buffer = '';
        let executionCount = 0;

        // Send debug logs directly to renderer
        const sendDebugLog = (message) => {
          const debugMessage = `[FLOW_DEBUG] ${message}`;
          mainWindow.webContents.send('flow-log', debugMessage);
        };

        sendDebugLog('Starting flow execution process');

        // Helper function to send logs
        const sendLog = (line) => {
          try {
            // Parse the line and create a unique key that includes both type and message
            const logData = JSON.parse(line);
            const message = logData.type === 'error' ? `Error: ${logData.message}` :
                          logData.type === 'warn' ? `Warning: ${logData.message}` :
                          logData.message;
            
            const cleanMessage = message.trim();
            
            // Special handling for [FLOW] logs - they should never be considered duplicates
            if (cleanMessage.startsWith('[FLOW]')) {
              mainWindow.webContents.send('flow-log', cleanMessage);
              return;
            }
            
            // For other logs, create a unique key that includes both type and message
            const uniqueKey = `${logData.type}:${cleanMessage}`;
            
            sendDebugLog(`Processing log: ${JSON.stringify({ 
              message: cleanMessage, 
              type: logData.type,
              uniqueKey,
              alreadySeen: sentMessages.has(uniqueKey)
            })}`);
            
            if (cleanMessage && !sentMessages.has(uniqueKey)) {
              sentMessages.add(uniqueKey);
              // Only send if we haven't seen this exact message before
              mainWindow.webContents.send('flow-log', cleanMessage);
            }
          } catch (e) {
            // If the line isn't valid JSON, treat it as a plain message
            const cleanMessage = line.trim();
            
            // Special handling for [FLOW] logs - they should never be considered duplicates
            if (cleanMessage.startsWith('[FLOW]')) {
              mainWindow.webContents.send('flow-log', cleanMessage);
              return;
            }
            
            const uniqueKey = `plain:${cleanMessage}`;
            
            sendDebugLog(`Processing plain log: ${JSON.stringify({ 
              message: cleanMessage, 
              uniqueKey,
              alreadySeen: sentMessages.has(uniqueKey)
            })}`);
            
            if (cleanMessage && !sentMessages.has(uniqueKey)) {
              sentMessages.add(uniqueKey);
              mainWindow.webContents.send('flow-log', cleanMessage);
            }
          }
        };

        // Handle stdout from the child process
        currentFlowProcess.stdout.on('data', (data) => {
          sendDebugLog(`Received stdout data: ${data.toString()}`);
          // Add new data to buffer
          buffer += data.toString();
          
          // Process complete lines
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line.trim()) {
              try {
                // Try to parse as JSON first
                const logData = JSON.parse(line);
                const message = logData.type === 'error' ? `[FLOW_ERROR] ${logData.message}` :
                              logData.type === 'warn' ? `[FLOW_WARN] ${logData.message}` :
                              logData.message;
                
                const cleanMessage = message.trim();
                const uniqueKey = `${logData.type}:${cleanMessage}`;
                
                if (cleanMessage && !sentMessages.has(uniqueKey)) {
                  sentMessages.add(uniqueKey);
                  mainWindow.webContents.send('flow-log', cleanMessage);
                }
              } catch (e) {
                // If not JSON, treat as plain message
                const cleanMessage = line.trim();
                if (cleanMessage) {
                  const uniqueKey = `plain:${cleanMessage}`;
                  if (!sentMessages.has(uniqueKey)) {
                    sentMessages.add(uniqueKey);
                    mainWindow.webContents.send('flow-log', cleanMessage);
                  }
                }
              }
            }
          }
        });

        // Handle process close with more detailed error reporting
        currentFlowProcess.on('close', (code) => {
          sendDebugLog(`Child process closed with code: ${code}`);
          
          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const logData = JSON.parse(buffer);
              const message = logData.type === 'error' ? `[FLOW_ERROR] ${logData.message}` :
                            logData.type === 'warn' ? `[FLOW_WARN] ${logData.message}` :
                            logData.message;
              mainWindow.webContents.send('flow-log', message.trim());
            } catch (e) {
              mainWindow.webContents.send('flow-log', buffer.trim());
            }
          }

          // Clean up the temporary file
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            console.error('[FLOW_DEBUG] Error cleaning up temp file:', e);
          }

          if (code === 0) {
            resolve();
          } else {
            const errorMessage = `Flow execution failed with code ${code}`;
            console.error('[FLOW_DEBUG]', errorMessage);
            mainWindow.webContents.send('flow-log', `[FLOW_ERROR] ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        });

        // Set a timeout
        setTimeout(() => {
          sendDebugLog('Flow execution timed out');
          currentFlowProcess.kill();
          reject(new Error('Flow execution timed out after 5 minutes'));
        }, 300000); // 5 minute timeout
      });
    } catch (error) {
      throw error;
    }
  });

  // Add handler to terminate the flow
  ipcMain.handle('terminate-flow', async () => {
    if (currentFlowProcess) {
      try {
        // First try graceful termination
        try {
          // Ensure stdin is writable
          if (currentFlowProcess.stdin.writable) {
            currentFlowProcess.stdin.write(JSON.stringify({ type: 'terminate' }) + '\n');
            // End stdin to ensure the message is sent
            currentFlowProcess.stdin.end();
          }
        } catch (e) {
          console.error('[FLOW_DEBUG] Error sending terminate message:', e);
        }

        // Give a small delay for graceful termination
        await new Promise(resolve => setTimeout(resolve, 100));

        // Force kill the process and all its children
        if (process.platform === 'win32') {
          // On Windows, use taskkill with /F (force) and /T (tree)
          const { execSync } = require('child_process');
          try {
            execSync(`taskkill /pid ${currentFlowProcess.pid} /T /F`);
          } catch (e) {
            // Ignore errors if process is already gone
          }
        } else {
          // On Unix-like systems, try SIGTERM first, then SIGKILL
          try {
            // First try SIGTERM
            process.kill(currentFlowProcess.pid, 'SIGTERM');
            
            // Wait a bit for graceful termination
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if process is still running
            try {
              process.kill(currentFlowProcess.pid, 0);
              // If we get here, process is still running, use SIGKILL
              process.kill(currentFlowProcess.pid, 'SIGKILL');
            } catch (e) {
              // Process is already gone, which is what we want
            }
          } catch (e) {
            // If SIGTERM fails, try SIGKILL directly
            try {
              process.kill(currentFlowProcess.pid, 'SIGKILL');
            } catch (e2) {
              // Ignore errors if process is already gone
            }
          }
        }

        // Double-check if process is still running
        try {
          process.kill(currentFlowProcess.pid, 0); // This will throw if process doesn't exist
          // If we get here, process is still running, try one more time
          if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            execSync(`taskkill /pid ${currentFlowProcess.pid} /F`);
          } else {
            process.kill(currentFlowProcess.pid, 'SIGKILL');
          }
        } catch (e) {
          // Process is already gone, which is what we want
        }

        // Ensure all streams are closed
        try {
          currentFlowProcess.stdin.destroy();
          currentFlowProcess.stdout.destroy();
          currentFlowProcess.stderr.destroy();
        } catch (e) {
          // Ignore stream destruction errors
        }

        // Clear the reference
        currentFlowProcess = null;
      } catch (error) {
        console.error('[FLOW_DEBUG] Error terminating flow:', error);
        throw error;
      }
    }
  });

  // IPC handlers for project management
  ipcMain.handle('get-projects', () => {
    return store.get('projects') || [];
  });

  ipcMain.handle('show-open-dialog', async (event, options) => {
    const win = BrowserWindow.getFocusedWindow();
    return await dialog.showOpenDialog(win, options);
  });

  ipcMain.handle('show-save-dialog', async (event, options) => {
    const win = BrowserWindow.getFocusedWindow();
    return await dialog.showSaveDialog(win, options);
  });

  ipcMain.handle('save-projects', (event, projects) => {
    store.set('projects', projects);
    return projects;
  });

  ipcMain.handle('save-project', (event, project) => {
    const projects = store.get('projects') || [];
    // Ensure all blocks have a name property
    project.blocks = project.blocks.map(block => ({
      ...block,
      name: block.name || '',
    }));
    projects.push(project);
    store.set('projects', projects);
    return project;
  });

  ipcMain.handle('update-project', (event, project) => {
    try {
      const projects = store.get('projects') || [];
      const index = projects.findIndex(p => p.id === project.id);
      if (index !== -1) {
        // Ensure all blocks have a name property
        project.blocks = project.blocks.map(block => ({
          ...block,
          name: block.name || '',
        }));
        // Ensure edges are properly updated
        project.edges = project.edges || [];
        projects[index] = project;
        store.set('projects', projects);
        return project;
      }
      return null;
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  });

  // Export projects to a JSON file
  ipcMain.handle('export-projects', async (event, projects) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Projects',
      defaultPath: 'aitomics-projects.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8');
    }
  });

  // Import projects from a JSON file
  ipcMain.handle('import-projects', async (event, importedProjects) => {
    // Merge imported projects with existing ones (by id)
    const projects = store.get('projects') || [];
    let newProjects = Array.isArray(importedProjects) ? importedProjects : [importedProjects];
    // Ensure all blocks have a name property
    newProjects = newProjects.map(project => ({
      ...project,
      blocks: project.blocks.map(block => ({
        ...block,
        name: block.name || '',
      })),
    }));
    // Avoid duplicates by id
    newProjects = newProjects.filter(np => !projects.some(p => p.id === np.id));
    const merged = [...projects, ...newProjects];
    store.set('projects', merged);
    return merged;
  });

  // Delete a project
  ipcMain.handle('delete-project', (event, projectId) => {
    const projects = store.get('projects') || [];
    const updatedProjects = projects.filter(p => p.id !== projectId);
    store.set('projects', updatedProjects);
    return true;
  });

  // IPC handlers for action management
  ipcMain.handle('save-action', (event, action) => {
    const actions = actionStore.get('actions') || [];
    const index = actions.findIndex(a => a.id === action.id);
    
    if (index !== -1) {
      actions[index] = action;
    } else {
      actions.push(action);
    }
    
    actionStore.set('actions', actions);
    return action;
  });

  ipcMain.handle('get-actions', () => {
    return actionStore.get('actions') || [];
  });

  ipcMain.handle('delete-action', async (event, actionId) => {
    try {
      console.log('Starting deletion of action:', actionId);
      
      // Delete from actions store
      const actions = actionStore.get('actions') || [];
      console.log('Current actions in store:', actions.map(a => ({ id: a.id, name: a.name })));
      
      if (!actions.some(a => a.id === actionId)) {
        console.log('Action not found in store:', actionId);
        return true; // Action already deleted or doesn't exist
      }
      
      const updatedActions = actions.filter(a => a.id !== actionId);
      console.log('Actions after filtering:', updatedActions.map(a => ({ id: a.id, name: a.name })));
      
      // Ensure we're setting the entire actions array
      actionStore.set('actions', updatedActions);
      console.log('Actions store updated');
      
      return true;
    } catch (error) {
      console.error('Error deleting action:', error);
      return false;
    }
  });

  // Export actions to a JSON file
  ipcMain.handle('export-actions', async (event, actions) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Actions',
      defaultPath: 'aitomics-actions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(actions, null, 2), 'utf-8');
    }
  });

  // Import actions from a JSON file
  ipcMain.handle('import-actions', async (event, importedActions) => {
    // Merge imported actions with existing ones (by id)
    const actions = actionStore.get('actions') || [];
    let newActions = Array.isArray(importedActions) ? importedActions : [importedActions];
    // Avoid duplicates by id
    newActions = newActions.filter(na => !actions.some(a => a.id === na.id));
    const merged = [...actions, ...newActions];
    actionStore.set('actions', merged);
    return merged;
  });

  // Export data (projects and/or actions) to a JSON file
  ipcMain.handle('export-data', async (event, data) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
      title: data.projects ? 'Export Projects' : 'Export Actions',
      defaultPath: data.projects ? 'aitomics-projects.json' : 'aitomics-actions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  });

  // Add CSV parsing handler
  ipcMain.handle('parse-csv', async (event, filePath) => {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      return [];
    }
  });

  // Add IPC handler for opening external links
  ipcMain.handle('open-external-link', async (event, url) => {
    await shell.openExternal(url);
  });

  // Add handler to open file location
  ipcMain.handle('open-file-location', async (event, filePath) => {
    try {
      // Use shell to open the file's location in the system's file explorer
      await shell.showItemInFolder(filePath);
      return true;
    } catch (error) {
      console.error('Error opening file location:', error);
      throw error;
    }
  });

  // Add handler for fetching LM Studio models
  ipcMain.handle('fetch-lm-studio-models', async () => {
    try {
      const response = await fetch('http://127.0.0.1:1234/api/v0/models');
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      return { success: true, data: data.data || [] };
    } catch (error) {
      console.error('Error fetching LM Studio models:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch models. Please ensure LM Studio is running and developer mode is enabled.'
      };
    }
  });

  // Add version info handler
  ipcMain.handle('get-version-info', () => {
    return {
      appVersion: app.getVersion(),
      aitomicsVersion: require('./node_modules/aitomics/package.json').version
    };
  });

  // Add update handlers
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });
}

function createWindow() {
  // Get absolute paths for both possible icon locations
  const rendererIconPath = path.join(__dirname, 'src/renderer/public/logo512.png');
  const buildIconPath = path.join(__dirname, 'build/icon.png');
  const resourcesIconPath = app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : null;
  
  // Determine which icon to use
  let iconPath;
  if (app.isPackaged) {
    // In packaged app, try resources path first, then fall back to build path
    iconPath = resourcesIconPath && fs.existsSync(resourcesIconPath) ? resourcesIconPath : buildIconPath;
  } else {
    // In development, use PNG for all platforms
    iconPath = buildIconPath;
  }
  
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Platform:', process.platform);
  console.log('Is Packaged:', app.isPackaged);
  console.log('Icon paths:', {
    renderer: rendererIconPath,
    build: buildIconPath,
    resources: resourcesIconPath,
    selected: iconPath,
    exists: iconPath ? fs.existsSync(iconPath) : false
  });
  
  // Set app name for macOS before window creation
  if (process.platform === 'darwin') {
    app.setName('Aitomics UI');
    app.setAppUserModelId('com.aitomics.ui');
  }

  // Create window with minimal configuration first
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aitomics UI',
    show: false, // Don't show until ready
    icon: iconPath, // Set icon in window creation
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'src/renderer/src/preload.js')
    }
  });

  // Set icon after window creation
  if (iconPath) {
    try {
      // Try different methods to set the icon
      if (process.platform === 'darwin') {
        // On macOS, try setting the dock icon first
        if (app.dock) {
          app.dock.setIcon(iconPath);
          console.log('Set dock icon');
        }
        
        // Then try setting the window icon
        mainWindow.setIcon(iconPath);
        console.log('Set window icon');
        
        // Finally, try setting the app icon
        app.setAppUserModelId('com.aitomics.ui');
        console.log('Set app model ID');
      } else {
        // On other platforms, just set the window icon
        mainWindow.setIcon(iconPath);
        console.log('Set window icon (non-macOS)');
      }
    } catch (error) {
      console.error('Error setting icon:', error);
      // Log more details about the error
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        path: iconPath,
        exists: fs.existsSync(iconPath),
        stats: fs.existsSync(iconPath) ? fs.statSync(iconPath) : null
      });
    }
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Try setting icon one more time after window is shown
    if (iconPath && process.platform === 'darwin') {
      try {
        app.dock?.setIcon(iconPath);
        console.log('Set dock icon after window show');
      } catch (error) {
        console.error('Error setting dock icon after show:', error);
      }
    }
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    console.log('Loading development app from http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the correct path relative to the app
    let indexPath;
    if (app.isPackaged) {
      // In packaged app, try these paths in order:
      const possiblePaths = [
        path.join(process.resourcesPath, 'app.asar.unpacked/src/renderer/build/index.html'),
        path.join(process.resourcesPath, 'app.asar/src/renderer/build/index.html'),
        path.join(__dirname, 'src/renderer/build/index.html'),
        path.join(__dirname, 'build/index.html')
      ];
      
      console.log('Checking possible paths for packaged app:', possiblePaths);
      
      // Find the first path that exists
      indexPath = possiblePaths.find(p => fs.existsSync(p));
      
      if (!indexPath) {
        console.error('Could not find index.html in any of the expected locations:', possiblePaths);
        throw new Error('Could not find index.html in packaged app');
      }
    } else {
      // In non-packaged production build
      indexPath = path.join(__dirname, 'src/renderer/build/index.html');
    }

    console.log('Production environment details:', {
      __dirname,
      indexPath,
      exists: fs.existsSync(indexPath),
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath
    });

    // Log the contents of the build directory
    try {
      const buildDir = path.dirname(indexPath);
      console.log('Contents of build directory:', fs.readdirSync(buildDir));
    } catch (err) {
      console.error('Error reading build directory:', err);
    }

    console.log('Attempting to load production app from:', indexPath);
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Error loading production app:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        path: indexPath,
        exists: fs.existsSync(indexPath)
      });
      throw err;
    });

    // Add error handler for renderer process
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load app:', {
        errorCode,
        errorDescription,
        url: mainWindow.webContents.getURL()
      });
    });

    // Add console message handler
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log('Renderer console:', { level, message, line, sourceId });
    });
  }

  // Check for updates after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (!process.env.NODE_ENV === 'development') {
      autoUpdater.checkForUpdates();
    }
  });
}

// Register IPC handlers when app is ready
app.whenReady().then(() => {
  console.log('App is ready, initializing...');
  registerIpcHandlers();
  isAppReady = true;
  createWindow();
}).catch(err => {
  console.error('Error during app initialization:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Only create window if app is ready and no windows exist
  if (isAppReady && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Add a function to check if dependencies need to be updated
async function checkAndUpdateDependencies() {
  // In development, use the build directory
  const flowDepsDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked/build/flow-dependencies')
    : path.join(process.cwd(), 'build/flow-dependencies');
  
  console.log('[FLOW_DEBUG] Using flow dependencies from:', flowDepsDir);
  
  if (!fs.existsSync(flowDepsDir)) {
    throw new Error('Flow dependencies not found. Please rebuild the application.');
  }

  return flowDepsDir;
} 