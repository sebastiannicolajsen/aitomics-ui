import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { Project } from './types/Project';
import { ElectronAPI } from './types/electron';
import ProjectList from './components/ProjectList';
import BlockEditor from './components/BlockEditor';
import { builtInActions } from './actions/builtInActions';
import ActionEditor from './components/ActionEditor';
import { Action } from './types/Project';
import VersionInfo from './components/VersionInfo';

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

const openAITheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f7f7f8', // main background
      paper: '#fff',      // cards/sidebar
    },
    primary: {
      main: '#10a37f',
    },
    secondary: {
      main: '#6e6e80',
    },
    text: {
      primary: '#222327',
      secondary: '#6e6e80',
    },
    divider: '#e3e3e7',
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    fontSize: 16,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '4px 0',
        },
      },
    },
  },
});

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isActionEditorOpen, setIsActionEditorOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [globalActions, setGlobalActions] = useState<Action[]>([]);
  const [isDraggingAction, setIsDraggingAction] = useState(false);
  const [draggedAction, setDraggedAction] = useState<Action | null>(null);

  useEffect(() => {
    // Check if we're running in Electron
    if (window.electron) {
      // Load projects from electron store
      window.electron.ipcRenderer.invoke('get-projects').then((loadedProjects: Project[]) => {
        setProjects(loadedProjects);
      });

      // Load global actions
      window.electron.ipcRenderer.invoke('get-actions').then((loadedActions: Action[]) => {
        setGlobalActions(loadedActions);
      });
    } else {
      // Development mode - use mock data
      console.log('Running in development mode - using mock data');
      setProjects([
        {
          id: '1',
          name: 'Sample Project',
          description: 'This is a sample project for development',
          blocks: [],
          edges: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      setGlobalActions([]);
    }
  }, []);

  const handleCreateProject = async (name: string, description: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      blocks: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (window.electron) {
      const savedProject = await window.electron.ipcRenderer.invoke('save-project', newProject);
      setProjects([...projects, savedProject]);
      setSelectedProject(savedProject);
    } else {
      // Development mode - just update state
      setProjects([...projects, newProject]);
      setSelectedProject(newProject);
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    if (window.electron) {
      const savedProject = await window.electron.ipcRenderer.invoke('update-project', updatedProject);
      setProjects(prev =>
        prev.map(p => p.id === savedProject.id ? savedProject : p)
      );
      setSelectedProject(savedProject);
    } else {
      setProjects(prev =>
        prev.map(p => p.id === updatedProject.id ? updatedProject : p)
      );
      setSelectedProject(updatedProject);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      if (window.electron) {
        await window.electron.ipcRenderer.invoke('delete-project', projectId);
        setProjects(projects.filter(p => p.id !== projectId));
        if (selectedProject?.id === projectId) {
          setSelectedProject(null);
        }
      } else {
        // Development mode - just update state
        setProjects(projects.filter(p => p.id !== projectId));
        if (selectedProject?.id === projectId) {
          setSelectedProject(null);
        }
      }
    }
  };

  const handleEditAction = async (action: Action) => {
    setSelectedAction(action);
    setIsActionEditorOpen(true);
  };

  const handleActionSave = async (action: Action) => {
    try {
      let actionToSave = action;
      // If saving a built-in action, create a duplicate
      if (action.isBuiltIn) {
        actionToSave = {
          ...action,
          id: crypto.randomUUID(),
          name: `Copy of ${action.name}`,
          isBuiltIn: false,
        };
      }
      // Save the action globally
      if (window.electron) {
        const savedAction = await window.electron.ipcRenderer.invoke('save-action', actionToSave);
        setGlobalActions(prev => {
          const index = prev.findIndex(a => a.id === savedAction.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = savedAction;
            return updated;
          }
          return [...prev, savedAction];
        });
      } else {
        setGlobalActions(prev => {
          const index = prev.findIndex(a => a.id === actionToSave.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = actionToSave;
            return updated;
          }
          return [...prev, actionToSave];
        });
      }
      setIsActionEditorOpen(false);
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to save action:', error);
    }
  };

  const handleActionDelete = async (actionId: string) => {
    try {
      console.log('Starting action deletion in renderer:', actionId);
      
      // Delete from global store
      if (window.electron) {
        console.log('Current global actions:', globalActions.map(a => ({ id: a.id, name: a.name })));
        const success = await window.electron.ipcRenderer.invoke('delete-action', actionId);
        console.log('Delete action result:', success);
        
        if (!success) {
          console.error('Action deletion failed');
          window.alert('Failed to delete action. Please try again.');
          return;
        }
      }
      
      // Update local state
      setGlobalActions(prev => {
        const updated = prev.filter(a => a.id !== actionId);
        console.log('Updated global actions:', updated.map(a => ({ id: a.id, name: a.name })));
        return updated;
      });
      
      console.log('Action deletion completed successfully');
      // Close the editor
      setIsActionEditorOpen(false);
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to delete action:', error);
      window.alert('Failed to delete action. Please try again.');
    }
  };

  const handleActionDragStart = (event: React.DragEvent, action: Action) => {
    console.log('Drag start with action:', action);
    event.stopPropagation();
    setIsDraggingAction(true);
    setDraggedAction(action);
    
    // Set the data in the drag event
    const actionData = JSON.stringify(action);
    console.log('Setting drag data:', actionData);
    event.dataTransfer.setData('application/json', actionData);
    event.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.style.width = '100px';
    dragImage.style.height = '100px';
    dragImage.style.background = action.color;
    dragImage.style.borderRadius = '8px';
    dragImage.style.display = 'flex';
    dragImage.style.alignItems = 'center';
    dragImage.style.justifyContent = 'center';
    dragImage.style.color = 'white';
    dragImage.style.fontWeight = 'bold';
    dragImage.textContent = action.name;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 50, 50);
    
    // Remove the element after drag starts
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleActionDragEnd = () => {
    setIsDraggingAction(false);
    setDraggedAction(null);
  };

  return (
    <ThemeProvider theme={openAITheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', background: openAITheme.palette.background.default, overflow: 'hidden' }}>
        <Box sx={{ 
          width: 320, 
          borderRight: 0, 
          bgcolor: openAITheme.palette.background.paper, 
          boxShadow: 3,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            flex: 1, 
            minHeight: 0,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <ProjectList
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={(project) => {
                setIsActionEditorOpen(false);
                setSelectedAction(null);
                setSelectedProject(project);
              }}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProject={handleUpdateProject}
              onEditAction={handleEditAction}
              selectedAction={selectedAction}
              globalActions={globalActions}
              setGlobalActions={setGlobalActions}
              onActionDragStart={handleActionDragStart}
              onActionDragEnd={handleActionDragEnd}
            />
          </Box>
          <Box sx={{ 
            p: 2,
            borderTop: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            bgcolor: openAITheme.palette.background.paper
          }}>
            <VersionInfo />
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, p: 3, bgcolor: openAITheme.palette.background.default }}>
          {isActionEditorOpen && selectedAction ? (
            <ActionEditor
              action={selectedAction}
              onSave={handleActionSave}
              onClose={() => {
                setIsActionEditorOpen(false);
                setSelectedAction(null);
              }}
              onDelete={handleActionDelete}
            />
          ) : selectedProject ? (
            <BlockEditor
              project={selectedProject}
              onUpdateProject={handleUpdateProject}
              globalActions={globalActions}
              isDraggingAction={isDraggingAction}
              draggedAction={draggedAction}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', color: openAITheme.palette.text.secondary }}>
              Select or create a project to begin
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
