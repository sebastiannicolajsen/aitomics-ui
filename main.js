const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src/renderer/src/preload.js')
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

app.whenReady().then(createWindow);

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

// IPC handlers for project management
ipcMain.handle('get-projects', () => {
  return store.get('projects') || [];
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