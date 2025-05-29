import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Paper,
  ListItemButton,
  Grid,
  Tabs,
  Tab,
  InputAdornment,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  OutlinedInput,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Project, Action, ActionType } from '../types/Project';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import TransformIcon from '@mui/icons-material/Transform';
import CompareIcon from '@mui/icons-material/Compare';
import * as Icons from '@mui/icons-material';
import { builtInActions } from '../actions/builtInActions';

interface ProjectListProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProject: (project: Project) => void;
  onEditAction: (action: Action) => void;
  selectedAction: Action | null;
  globalActions: Action[];
  setGlobalActions: React.Dispatch<React.SetStateAction<Action[]>>;
  onActionDragStart?: (event: React.DragEvent, action: Action) => void;
  onActionDragEnd?: () => void;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
  MenuListProps: {
    sx: {
      '& .Mui-selected': {
        backgroundColor: 'transparent !important',
        '&:hover': {
          backgroundColor: 'inherit',
        },
      },
    },
  },
};

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onUpdateProject,
  onEditAction,
  selectedAction,
  globalActions,
  setGlobalActions,
  onActionDragStart,
  onActionDragEnd,
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExportProjectsDialogOpen, setIsExportProjectsDialogOpen] = useState(false);
  const [isExportActionsDialogOpen, setIsExportActionsDialogOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ActionType[]>([]);

  // Get unique actions from all projects and built-in actions
  const uniqueActions = React.useMemo(() => {
    // Only include built-in actions that haven't been deleted
    const nonDeletedBuiltIns = builtInActions.filter(builtIn => 
      !globalActions.some(global => global.id === builtIn.id)
    );
    return [...nonDeletedBuiltIns, ...globalActions];
  }, [globalActions]);

  // Export selected projects
  const handleExportProjects = () => {
    if (window.electron) {
      const data = {
        projects: projects.filter(p => selectedProjects.includes(p.id))
      };
      window.electron.ipcRenderer.invoke('export-data', data);
    } else {
      // fallback: download in browser
      const data = {
        projects: projects.filter(p => selectedProjects.includes(p.id))
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aitomics-projects.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    setIsExportProjectsDialogOpen(false);
  };

  // Export selected actions
  const handleExportActions = () => {
    if (window.electron) {
      const data = {
        actions: globalActions.filter(action => 
          !action.isBuiltIn && selectedActions.includes(action.id)
        )
      };
      window.electron.ipcRenderer.invoke('export-data', data);
    } else {
      // fallback: download in browser
      const data = {
        actions: globalActions.filter(action => 
          !action.isBuiltIn && selectedActions.includes(action.id)
        )
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aitomics-actions.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    setIsExportActionsDialogOpen(false);
  };

  // Handle project selection change
  const handleProjectSelectionChange = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  // Handle action selection change
  const handleActionSelectionChange = (actionId: string) => {
    setSelectedActions(prev => {
      if (prev.includes(actionId)) {
        return prev.filter(id => id !== actionId);
      } else {
        return [...prev, actionId];
      }
    });
  };

  // Select all projects
  const handleSelectAllProjects = () => {
    setSelectedProjects(projects.map(p => p.id));
  };

  // Deselect all projects
  const handleDeselectAllProjects = () => {
    setSelectedProjects([]);
  };

  // Select all non-built-in actions
  const handleSelectAllActions = () => {
    setSelectedActions(globalActions.filter(a => !a.isBuiltIn).map(a => a.id));
  };

  // Deselect all actions
  const handleDeselectAllActions = () => {
    setSelectedActions([]);
  };

  // Import projects or actions
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (window.electron) {
        if (imported.projects) {
          const updatedProjects = await window.electron.ipcRenderer.invoke('import-projects', imported.projects);
          // Get the latest projects from the store
          const latestProjects = await window.electron.ipcRenderer.invoke('get-projects');
          // Update all projects in parent component
          latestProjects.forEach((project: Project) => {
            onUpdateProject(project);
          });
        }
        if (imported.actions) {
          const updatedActions = await window.electron.ipcRenderer.invoke('import-actions', imported.actions);
          // Update actions in parent component
          setGlobalActions(updatedActions);
        }
      } else {
        // fallback: just alert
        alert(`Imported data: ` + JSON.stringify(imported, null, 2));
      }
    } catch (err) {
      alert('Invalid import file');
    }
  };

  // Filter actions based on search and filters
  const filteredActions = React.useMemo(() => {
    return uniqueActions.filter(action => {
      const matchesSearch = action.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(action.type);
      return matchesSearch && matchesType;
    });
  }, [uniqueActions, searchQuery, selectedTypes]);

  // Debug log to check filtering
  React.useEffect(() => {
    console.log('Selected types:', selectedTypes);
    console.log('Filtered actions:', filteredActions.map(a => ({ name: a.name, type: a.type })));
  }, [selectedTypes, filteredActions]);

  const handleTypeChange = (event: any) => {
    const {
      target: { value },
    } = event;
    setSelectedTypes(
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  const getTypeIcon = (type: ActionType) => {
    switch (type) {
      case 'input':
        return <InputIcon sx={{ fontSize: '1.2rem' }} />;
      case 'output':
        return <OutputIcon sx={{ fontSize: '1.2rem' }} />;
      case 'transform':
        return <TransformIcon sx={{ fontSize: '1.2rem' }} />;
      case 'comparison':
        return <CompareIcon sx={{ fontSize: '1.2rem' }} />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: ActionType) => {
    switch (type) {
      case 'input':
        return '#10a37f';
      case 'output':
        return '#dc3545';
      case 'transform':
        return '#ffc107';
      case 'comparison':
        return '#673ab7';
      default:
        return '#6e6e80';
    }
  };

  const handleCreateProject = () => {
    onCreateProject(newProjectName, newProjectDescription);
    setIsCreateDialogOpen(false);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const handleDeleteProject = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onDeleteProject(projectId);
  };

  const handleDragStart = (event: React.DragEvent, action: Action) => {
    if (onActionDragStart) {
      onActionDragStart(event, action);
    }
  };

  const handleDragEnd = () => {
    if (onActionDragEnd) {
      onActionDragEnd();
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      {/* Left sidebar with projects/actions list */}
      <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {activeTab === 0 ? 'Projects' : 'Actions'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={() => {
                if (activeTab === 0) {
                  setIsCreateDialogOpen(true);
                } else {
                  const newAction: Action = {
                    id: '',
                    name: 'New Action',
                    type: 'input' as ActionType,
                    icon: 'CodeIcon',
                    color: '#10a37f',
                    code: `function process(input: Input, config: Config): any {\n  return input;\n}`,
                    config: [],
                    isBuiltIn: false,
                    description: '',
                    wrapInAitomics: true,
                  };
                  onEditAction(newAction);
                }
              }}
              sx={{
                background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(16, 163, 127, 0.2)',
                color: '#10a37f',
                '&:hover': {
                  background: 'linear-gradient(145deg, #d1f0e6 0%, #b8e9db 100%)',
                  boxShadow: '0 6px 16px rgba(16, 163, 127, 0.15)',
                },
              }}
            >
              <AddIcon />
            </IconButton>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              id={`import-${activeTab === 0 ? 'projects' : 'actions'}`}
              onChange={handleImport}
            />
            <label htmlFor={`import-${activeTab === 0 ? 'projects' : 'actions'}`}>
              <IconButton
                component="span"
                sx={{
                  background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                  borderRadius: 12,
                  border: '1px solid rgba(16, 163, 127, 0.2)',
                  color: '#10a37f',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #d1f0e6 0%, #b8e9db 100%)',
                    boxShadow: '0 6px 16px rgba(16, 163, 127, 0.15)',
                  },
                }}
              >
                <FileUploadIcon />
              </IconButton>
            </label>
            <IconButton
              onClick={() => {
                if (activeTab === 0) {
                  setIsExportProjectsDialogOpen(true);
                } else {
                  setIsExportActionsDialogOpen(true);
                }
              }}
              sx={{
                background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(16, 163, 127, 0.2)',
                color: '#10a37f',
                '&:hover': {
                  background: 'linear-gradient(145deg, #d1f0e6 0%, #b8e9db 100%)',
                  boxShadow: '0 6px 16px rgba(16, 163, 127, 0.15)',
                },
              }}
            >
              <FileDownloadIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
              },
            }}
          >
            <Tab label="Projects" />
            <Tab label="Actions" />
          </Tabs>
        </Box>

        {activeTab === 1 && (
          <Box sx={{ mb: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: '0.875rem' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  height: 40,
                  background: 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                  borderRadius: 1,
                  transition: 'all 0.2s ease-in-out',
                  '& input': {
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    '&::placeholder': {
                      color: 'text.secondary',
                      opacity: 0.7,
                    },
                  },
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease-in-out',
                  },
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                    '& fieldset': {
                      borderColor: 'rgba(16, 163, 127, 0.3)',
                    },
                  },
                  '&.Mui-focused': {
                    background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.15)',
                    '& fieldset': {
                      borderColor: '#10a37f',
                      borderWidth: '1px',
                    },
                  },
                },
              }}
            />
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <Select
                multiple
                displayEmpty
                value={selectedTypes}
                onChange={handleTypeChange}
                input={<OutlinedInput />}
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return <em style={{ color: 'text.secondary', opacity: 0.7, fontSize: '0.75rem' }}>Filter by type</em>;
                  }
                  return (
                    <Typography sx={{ 
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {selected.length === 1 
                        ? selected[0] 
                        : `${selected.length} types selected`}
                    </Typography>
                  );
                }}
                MenuProps={MenuProps}
                sx={{
                  height: 40,
                  background: 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                  borderRadius: 1,
                  transition: 'all 0.2s ease-in-out',
                  '& .MuiSelect-select': {
                    py: 1,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease-in-out',
                  },
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(16, 163, 127, 0.3)',
                    },
                  },
                  '&.Mui-focused': {
                    background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.15)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#10a37f',
                      borderWidth: '1px',
                    },
                  },
                }}
              >
                {(['input', 'output', 'transform', 'comparison'] as ActionType[]).map((type) => (
                  <MenuItem 
                    key={type} 
                    value={type}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        background: `linear-gradient(145deg, ${getTypeColor(type)}10 0%, ${getTypeColor(type)}05 100%)`,
                      },
                      '&.Mui-selected': {
                        background: `linear-gradient(145deg, ${getTypeColor(type)}20 0%, ${getTypeColor(type)}15 100%)`,
                        '&:hover': {
                          background: `linear-gradient(145deg, ${getTypeColor(type)}30 0%, ${getTypeColor(type)}25 100%)`,
                        },
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getTypeIcon(type)}
                      <Typography sx={{ fontSize: '0.875rem' }}>{type}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Grid container spacing={1} sx={{ width: '100%', m: 0 }}>
            {activeTab === 0 ? (
              projects.map((project) => (
                <Grid item key={project.id} sx={{ width: '100%', p: 0 }}>
                  <Paper
                    onClick={() => onSelectProject(project)}
                    sx={{
                      p: 1,
                      height: 60,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      background: selectedProject?.id === project.id
                        ? 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)'
                        : 'white',
                      border: selectedProject?.id === project.id
                        ? '1px solid #10a37f'
                        : '1px solid rgba(0,0,0,0.1)',
                      '&:hover': {
                        background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                        boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                      },
                      mb: 0.5,
                      borderRadius: 1,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.description}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, e);
                      }}
                      sx={{
                        color: '#dc3545',
                        flexShrink: 0,
                        padding: 0.5,
                        '&:hover': {
                          backgroundColor: 'rgba(220, 53, 69, 0.08)',
                        },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Paper>
                </Grid>
              ))
            ) : (
              filteredActions.map((action) => {
                const iconName = action.icon?.replace(/Icon$/, '');
                const IconComponent = Icons[iconName as keyof typeof Icons];
                return (
                  <Grid item key={action.id} sx={{ width: '100%', p: 0 }}>
                    <Paper
                      draggable
                      onDragStart={(e) => handleDragStart(e, action)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onEditAction(action)}
                      sx={{
                        p: 1,
                        height: 60,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        cursor: 'grab',
                        position: 'relative',
                        background: selectedAction?.id === action.id
                          ? `linear-gradient(145deg, ${action.isBuiltIn ? '#66666630' : action.color}30 0%, ${action.isBuiltIn ? '#66666620' : action.color}20 100%)`
                          : `linear-gradient(145deg, ${action.isBuiltIn ? '#66666620' : action.color}20 0%, ${action.isBuiltIn ? '#66666610' : action.color}10 100%)`,
                        color: action.isBuiltIn ? '#666666' : action.color,
                        border: selectedAction?.id === action.id
                          ? `2px solid ${action.isBuiltIn ? '#666666' : action.color}`
                          : `1px solid ${action.isBuiltIn ? '#66666640' : action.color}40`,
                        '&:hover': {
                          background: `linear-gradient(145deg, ${action.isBuiltIn ? '#66666630' : action.color}30 0%, ${action.isBuiltIn ? '#66666620' : action.color}20 100%)`,
                          boxShadow: `0 4px 12px ${action.isBuiltIn ? '#66666620' : action.color}20`,
                        },
                        '&:active': {
                          cursor: 'grabbing',
                        },
                        mb: 0.5,
                        borderRadius: 1,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                        {IconComponent && (
                          <IconComponent sx={{ fontSize: '1.2rem' }} />
                        )}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {action.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip
                              icon={getTypeIcon(action.type) || undefined}
                              label={action.type}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                backgroundColor: getTypeColor(action.type),
                                color: 'white',
                                '& .MuiChip-label': {
                                  px: 1,
                                },
                                '& .MuiChip-icon': {
                                  color: 'white',
                                  fontSize: '0.8rem',
                                  marginLeft: '4px',
                                },
                              }}
                            />
                            {action.isBuiltIn && (
                              <Chip
                                label="Built-in"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  backgroundColor: '#666666',
                                  color: 'white',
                                  '& .MuiChip-label': {
                                    px: 1,
                                  },
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })
            )}
          </Grid>
        </Box>
      </Box>

      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsCreateDialogOpen(false)}
            sx={{
              color: '#6e6e80',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            disabled={!newProjectName}
            sx={{
              background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
              boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
              '&:hover': {
                background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)',
              },
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Projects Dialog */}
      <Dialog 
        open={isExportProjectsDialogOpen} 
        onClose={() => setIsExportProjectsDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 500,
          },
        }}
      >
        <DialogTitle>Export Projects</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Select Projects to Export</Typography>
              <Box>
                <Button size="small" onClick={handleSelectAllProjects}>Select All</Button>
                <Button size="small" onClick={handleDeselectAllProjects}>Deselect All</Button>
              </Box>
            </Box>
            <List sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
              {projects.map((project) => (
                <ListItem key={project.id} disablePadding>
                  <ListItemButton
                    dense
                    onClick={() => handleProjectSelectionChange(project.id)}
                  >
                    <Checkbox
                      edge="start"
                      checked={selectedProjects.includes(project.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                    <ListItemText 
                      primary={project.name}
                      secondary={project.description}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsExportProjectsDialogOpen(false)}
            sx={{
              color: '#6e6e80',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExportProjects}
            variant="contained"
            disabled={selectedProjects.length === 0}
            sx={{
              background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
              boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
              '&:hover': {
                background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)',
              },
            }}
          >
            Export Projects
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Actions Dialog */}
      <Dialog 
        open={isExportActionsDialogOpen} 
        onClose={() => setIsExportActionsDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 500,
          },
        }}
      >
        <DialogTitle>Export Actions</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Select Actions to Export</Typography>
              <Box>
                <Button size="small" onClick={handleSelectAllActions}>Select All</Button>
                <Button size="small" onClick={handleDeselectAllActions}>Deselect All</Button>
              </Box>
            </Box>
            <List sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
              {globalActions
                .filter(action => !action.isBuiltIn)
                .map((action) => (
                  <ListItem key={action.id} disablePadding>
                    <ListItemButton
                      dense
                      onClick={() => handleActionSelectionChange(action.id)}
                    >
                      <Checkbox
                        edge="start"
                        checked={selectedActions.includes(action.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText 
                        primary={action.name}
                        secondary={action.type}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsExportActionsDialogOpen(false)}
            sx={{
              color: '#6e6e80',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExportActions}
            variant="contained"
            disabled={selectedActions.length === 0}
            sx={{
              background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
              boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
              '&:hover': {
                background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)',
              },
            }}
          >
            Export Actions
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectList; 