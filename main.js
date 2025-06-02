const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { parse } = require('csv-parse/sync');
const { spawn } = require('child_process');
const Module = require('module');  // Add Module for proper module loading
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');

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

// Set development mode only if not packaged
if (!app.isPackaged) {
  process.env.NODE_ENV = 'development';
}

let mainWindow = null;
let currentFlowProcess = null;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'downloading', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'downloaded', info);
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
      // Create temporary directory and file
      const tempDir = path.join(app.getPath('temp'), 'aitomics-flow');
      fs.mkdirSync(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, `flow-${Date.now()}.js`);

      // Find the correct node_modules paths
      const appPath = app.getAppPath();
      console.log('[FLOW_DEBUG] App path:', appPath);
      
      const possibleNodeModulesPaths = [
        // Development paths (relative to app path)
        path.join(appPath, 'node_modules'),
        path.join(appPath, '..', 'node_modules'),
        // Production paths
        path.join(process.resourcesPath, 'app.asar', 'node_modules'),
        path.join(process.resourcesPath, 'app', 'node_modules'),
        // Fallback paths
        path.join(__dirname, 'node_modules'),
        path.join(__dirname, '..', 'node_modules')
      ];

      console.log('[FLOW_DEBUG] Checking possible node_modules paths:');
      const validPaths = possibleNodeModulesPaths.filter(p => {
        const exists = fs.existsSync(p);
        console.log(`[FLOW_DEBUG] ${p}: ${exists ? 'exists' : 'not found'}`);
        return exists;
      });

      if (validPaths.length === 0) {
        console.error('[FLOW_DEBUG] No valid node_modules paths found. Searched in:', possibleNodeModulesPaths);
        throw new Error('Could not find node_modules directory. Please ensure dependencies are installed.');
      }

      const rootNodeModules = validPaths[0];
      console.log('[FLOW_DEBUG] Using node_modules path:', rootNodeModules);

      // Get package information
      const csvParsePackagePath = path.join(rootNodeModules, 'csv-parse');
      const aitomicsPackagePath = path.join(rootNodeModules, 'aitomics');
      
      console.log('[FLOW_DEBUG] Package paths:', {
        csvParse: csvParsePackagePath,
        aitomics: aitomicsPackagePath
      });

      // Validate package paths
      if (!fs.existsSync(csvParsePackagePath)) {
        console.error('[FLOW_DEBUG] csv-parse package not found at:', csvParsePackagePath);
        throw new Error(`csv-parse package not found at: ${csvParsePackagePath}`);
      }
      if (!fs.existsSync(aitomicsPackagePath)) {
        console.error('[FLOW_DEBUG] aitomics package not found at:', aitomicsPackagePath);
        throw new Error(`aitomics package not found at: ${aitomicsPackagePath}`);
      }
      
      // Read package.json files to get versions
      const csvParsePackage = JSON.parse(fs.readFileSync(path.join(csvParsePackagePath, 'package.json'), 'utf-8'));
      const aitomicsPackage = JSON.parse(fs.readFileSync(path.join(aitomicsPackagePath, 'package.json'), 'utf-8'));

      console.log('[FLOW] Found required packages:', {
        csvParse: { path: csvParsePackagePath, version: csvParsePackage.version },
        aitomics: { path: aitomicsPackagePath, version: aitomicsPackage.version }
      });

      // Create a package.json in the temp directory to set up module resolution
      const tempPackageJson = path.join(tempDir, 'package.json');
      fs.writeFileSync(tempPackageJson, JSON.stringify({
        name: 'aitomics-flow-temp',
        version: '1.0.0',
        type: 'commonjs',
        dependencies: {
          'csv-parse': csvParsePackage.version,
          'aitomics': 'file:' + aitomicsPackagePath
        }
      }, null, 2));

      // Create node_modules in temp directory and symlink required packages
      const tempNodeModules = path.join(tempDir, 'node_modules');
      if (!fs.existsSync(tempNodeModules)) {
        fs.mkdirSync(tempNodeModules, { recursive: true });
      }

      // Create symlinks for required packages
      const packagesToLink = [
        { name: 'csv-parse', path: csvParsePackagePath },
        { name: 'aitomics', path: aitomicsPackagePath }
      ];

      for (const pkg of packagesToLink) {
        const targetPath = path.join(tempNodeModules, pkg.name);
        if (!fs.existsSync(targetPath)) {
          try {
            fs.symlinkSync(pkg.path, targetPath, 'dir');
            console.log('[FLOW] Created symlink for', pkg.name, 'at', targetPath);
          } catch (e) {
            console.error('[FLOW] Failed to create symlink for', pkg.name, ':', e);
          }
        }
      }

      // Wrap the code to handle console output and module resolution
      const wrappedCode = [
        // Set up module resolution
        "const Module = require('module');",
        "const originalResolveFilename = Module._resolveFilename;",
        "",
        // Override module resolution to include our paths
        "Module._resolveFilename = function(request, parent, isMain, options) {",
        "  try {",
        "    return originalResolveFilename(request, parent, isMain, options);",
        "  } catch (err) {",
        "    // Try to resolve in our node_modules",
        `    const additionalPaths = ${JSON.stringify(possibleNodeModulesPaths)};`,
        "    for (const nodeModulesPath of additionalPaths) {",
        "      try {",
        "        const fullPath = require.resolve(request, { paths: [nodeModulesPath] });",
        "        if (fullPath) return fullPath;",
        "      } catch (e) {",
        "        // Continue trying other paths",
        "      }",
        "    }",
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
        "  console.error(error.message);",
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
        `      fs.unlinkSync(${JSON.stringify(tempPackageJson)});`,
        "      for (const pkg of " + JSON.stringify(packagesToLink) + ") {",
        `        const targetPath = path.join(${JSON.stringify(tempNodeModules)}, pkg.name);`,
        "        fs.rmSync(targetPath, { recursive: true, force: true });",
        "      }",
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

      // Store the child process reference
      currentFlowProcess = spawn(process.execPath, [tempFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_PATH: possibleNodeModulesPaths.join(path.delimiter),
          FORCE_COLOR: '1',
          DEBUG_COLORS: '1'
        },
        shell: false,
        detached: false  // Ensure process is not detached
      });

      // Ensure all streams are properly handled
      currentFlowProcess.stdin.on('error', (err) => {
        console.error('[FLOW_DEBUG] stdin error:', err);
      });

      currentFlowProcess.stdout.on('error', (err) => {
        console.error('[FLOW_DEBUG] stdout error:', err);
      });

      currentFlowProcess.stderr.on('error', (err) => {
        console.error('[FLOW_DEBUG] stderr error:', err);
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
              sendLog(line);
            }
          }
        });

        // Handle any remaining data in buffer when process ends
        currentFlowProcess.on('close', (code) => {
          sendDebugLog(`Child process closed with code: ${code}`);
          if (buffer.trim()) {
            sendLog(buffer);
          }
          // Clean up the temporary file
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Flow execution failed with code ${code}`));
          }
        });

        // Handle process events
        currentFlowProcess.on('error', (error) => {
          sendDebugLog(`Child process error: ${error.message}`);
          reject(error);
        });

        currentFlowProcess.on('exit', (code, signal) => {
          sendDebugLog(`Child process exited: ${JSON.stringify({ code, signal })}`);
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
  const buildIconPath = path.join(__dirname, 'build/icon.icns');
  
  // Use PNG file directly for development
  const iconPath = process.env.NODE_ENV === 'development' ? 
    rendererIconPath : 
    (process.platform === 'darwin' ? buildIconPath : rendererIconPath);
  
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Platform:', process.platform);
  console.log('Selected icon path:', iconPath);
  
  // Create window with minimal configuration first
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aitomics',
    show: false, // Don't show until ready
    // Don't set icon in window creation
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'src/renderer/src/preload.js')
    }
  });

  // Set app name for macOS
  if (process.platform === 'darwin') {
    app.setName('Aitomics');
  }

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
        stats: fs.statSync(iconPath)
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
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/build/index.html'));
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
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 