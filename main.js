const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { parse } = require('csv-parse/sync');
const { spawn } = require('child_process');
const Module = require('module');  // Add Module for proper module loading

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

// Set development mode
process.env.NODE_ENV = 'development';

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
            // Create a unique key that includes both type and message
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

        // Spawn a new Node.js process to run the code
        sendDebugLog('Spawning child process');
        const child = spawn(process.execPath, [tempFile], {
          stdio: ['ignore', 'pipe', 'ignore'], // Only use stdout for all logs
          env: {
            ...process.env,
            NODE_PATH: possibleNodeModulesPaths.join(path.delimiter),
            FORCE_COLOR: '1',
            DEBUG_COLORS: '1'
          },
          shell: true
        });

        // Handle stdout from the child process
        child.stdout.on('data', (data) => {
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
        child.on('close', (code) => {
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
        child.on('error', (error) => {
          sendDebugLog(`Child process error: ${error.message}`);
          reject(error);
        });

        child.on('exit', (code, signal) => {
          sendDebugLog(`Child process exited: ${JSON.stringify({ code, signal })}`);
        });

        // Set a timeout
        setTimeout(() => {
          sendDebugLog('Flow execution timed out');
          child.kill();
          reject(new Error('Flow execution timed out after 5 minutes'));
        }, 300000); // 5 minute timeout
      });
    } catch (error) {
      throw error;
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
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, 'src/renderer/src/preload.js')
        : path.join(__dirname, 'src/renderer/build/preload.js'),
      sandbox: false
    }
  });

  // In development, load from React dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/build/index.html'));
  }
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