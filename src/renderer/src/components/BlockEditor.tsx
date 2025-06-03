import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  ReactFlowInstance,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  EdgeProps,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Typography,
  Button,
  Stack,
  Drawer,
  TextField,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Paper,
  Slider,
  CircularProgress,
  Divider,
  LinearProgress,
} from '@mui/material';
import { Project, Block, BlockType, Action, ActionConfig } from '../types/Project';
import { builtInActions } from '../actions/builtInActions';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import TransformIcon from '@mui/icons-material/Transform';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeBlock from './CodeBlock';
import TextBlock from './TextBlock';
import DataBlock from './DataBlock';
import AddIcon from '@mui/icons-material/Add';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CompareIcon from '@mui/icons-material/Compare';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ActionConfigPanel from './ActionConfigPanel';
import * as Icons from '@mui/icons-material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FlowExecutionWindow from './FlowExecutionWindow';
import CodeIcon from '@mui/icons-material/Code';
import { generateFlowCode } from '../utils/flowCodeGenerator';
import debounce from 'lodash/debounce';
import ActionSelector from './ActionSelector';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import MarkdownEditor from './MarkdownEditor';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { Node as ReactFlowNode } from 'reactflow';

interface NodeData {
  type: 'import' | 'export' | 'transform' | 'comparison';
  name?: string;
  content?: string;
  id: string;
  actionId?: string;
  config?: Record<string, any>;
  onUpdate?: (content: string) => void;
  file?: string;
  outputFilename?: string;
  outputPath?: string;
}

interface BlockEditorProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  globalActions: Action[];
  isDraggingAction?: boolean;
  draggedAction?: Action | null;
}

interface FlowWrapperProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  reactFlowInstance: React.MutableRefObject<ReactFlowInstance | null>;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  onConnect: (params: Connection) => void;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  nodeTypes: any;
  edgeTypes: any;
  onPaneClick: () => void;
}

interface CustomEdgeProps extends EdgeProps {
  onEdgesDelete: (edges: Edge[]) => void;
}

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { setEdges } = useReactFlow();

  const onEdgeClick = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      // Find the edge to delete
      setEdges((edges) => {
        const edgeToDelete = edges.find(e => e.id === id);
        if (edgeToDelete) {
          // Trigger the onEdgesDelete callback
          const event = new CustomEvent('edgesDelete', { detail: [edgeToDelete] });
          window.dispatchEvent(event);
        }
        return edges.filter((e) => e.id !== id);
      });
    },
    [id, setEdges]
  );

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          cursor: 'pointer',
          stroke: '#666666',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <g
        transform={`translate(${labelX} ${labelY})`}
        onClick={onEdgeClick}
        style={{ cursor: 'pointer' }}
      >
        <circle
          r={9}
          style={{
            fill: 'white',
            stroke: '#666666',
            strokeWidth: 1.5,
            opacity: selected ? 1 : 0.7,
            transition: 'opacity 0.2s',
          }}
        />
        {/* Trash can icon centered at (0,0) */}
        <path
          d="M-3 1.5v4M0 1.5v4M3 1.5v4M-4.5-1h9M-2-1V-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"
          stroke="#666666"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </>
  );
};

const edgeTypes = {
  custom: (props: EdgeProps) => (
    <CustomEdge
      {...props}
    />
  ),
};

const FlowWrapper: React.FC<FlowWrapperProps> = ({
  project,
  onUpdateProject,
  reactFlowInstance,
  onNodeClick,
  onNodeDragStop,
  onConnect,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onEdgesDelete,
  nodeTypes,
  edgeTypes,
  onPaneClick,
}) => {
  const { fitView } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!reactFlowWrapper.current || !isInitialized || !reactFlowInstance.current) return;

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ 
            duration: 200, 
            padding: 0.2,
            maxZoom: 1.5 
          });
        }
      }, 100);
    };

    // Create a new ResizeObserver
    resizeObserverRef.current = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to prevent multiple rapid updates
      window.requestAnimationFrame(() => {
        if (entries.length > 0) {
          handleResize();
        }
      });
    });

    // Observe the wrapper element
    resizeObserverRef.current.observe(reactFlowWrapper.current);

    // Initial fit
    handleResize();

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isInitialized, reactFlowInstance]);

  return (
    <Box 
      sx={{ 
        flexGrow: 1, 
        position: 'relative',
        '& .react-flow__viewport': {
          transition: 'transform 0.2s ease-out',
        }
      }} 
      ref={reactFlowWrapper}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        defaultEdgeOptions={{
          type: 'custom',
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        }}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          instance.fitView({ 
            duration: 0, 
            padding: 0.2,
            maxZoom: 1.5 
          });
          setIsInitialized(true);
        }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onPaneClick={onPaneClick}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </Box>
  );
};

// Add new interfaces for model selection
interface Model {
  id: string;
  object: string;
  type: string;
  publisher: string;
  arch: string;
  compatibility_type: string;
  quantization: string;
  state: string;
  max_context_length: number;
  loaded_context_length?: number;
}

interface ModelSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  models: Model[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

// Add ModelSelectionDialog component
const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  open,
  onClose,
  models,
  selectedModel,
  onSelectModel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '50vh',
          maxHeight: '80vh',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #e0e0e0',
        pb: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6" sx={{ 
          fontFamily: 'monospace',
          fontSize: '1.1rem',
          color: '#333333'
        }}>
          Select Model
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: '#666666',
            '&:hover': {
              color: '#10a37f',
              bgcolor: 'rgba(16, 163, 127, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ 
        p: 3,
        '&.MuiDialogContent-root': {
          pt: 2
        }
      }}>
        <List sx={{ width: '100%' }}>
          {models.map((model) => (
            <ListItem
              key={model.id}
              button
              selected={model.id === selectedModel}
              onClick={() => {
                onSelectModel(model.id);
                onClose();
              }}
              sx={{
                mb: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: model.id === selectedModel ? '#673ab7' : 'divider',
                bgcolor: model.id === selectedModel ? 'rgba(103, 58, 183, 0.08)' : 'background.paper',
                '&:hover': {
                  bgcolor: model.id === selectedModel ? 'rgba(103, 58, 183, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {model.id}
                  </Typography>
                }
                secondary={
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={model.type}
                      sx={{
                        bgcolor: model.type === 'llm' ? '#10a37f20' : '#673ab720',
                        color: model.type === 'llm' ? '#10a37f' : '#673ab7',
                      }}
                    />
                    <Chip
                      size="small"
                      label={model.state}
                      sx={{
                        bgcolor: model.state === 'loaded' ? '#10a37f20' : '#ffc10720',
                        color: model.state === 'loaded' ? '#10a37f' : '#ffc107',
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {model.publisher} • {model.quantization}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

// Add ProjectEditDialog component
interface ProjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onSave: (project: Project) => void;
}

// Add this helper function at the top of the file, after the imports and before any component definitions
const applyMarkdownStyles = (text: string) => {
  // Split the text into lines to handle headers
  const lines = text.split('\n');
  const styledLines = lines.map(line => {
    // Handle headers - style both the # symbols and the text
    if (line.startsWith('# ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1.4em;"># ${line.slice(2)}</span>`;
    }
    if (line.startsWith('## ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1.3em;">## ${line.slice(3)}</span>`;
    }
    if (line.startsWith('### ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1.2em;">### ${line.slice(4)}</span>`;
    }
    if (line.startsWith('#### ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1.1em;">#### ${line.slice(5)}</span>`;
    }
    if (line.startsWith('##### ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1em;">##### ${line.slice(6)}</span>`;
    }
    if (line.startsWith('###### ')) {
      return `<span style="color: #673ab7; font-weight: bold; font-size: 1em;">###### ${line.slice(7)}</span>`;
    }

    // Handle inline styles - style both the syntax and the text
    let styledLine = line;
    
    // Handle bold (**text**)
    styledLine = styledLine.replace(/\*\*(.*?)\*\*/g, '<span style="color: #673ab7; font-weight: bold;">**$1**</span>');
    
    // Handle italic (*text*)
    styledLine = styledLine.replace(/\*(.*?)\*/g, '<span style="font-style: italic;">*$1*</span>');
    
    // Handle code (`text`)
    styledLine = styledLine.replace(/`(.*?)`/g, '<span style="background-color: rgba(0, 0, 0, 0.04); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em;">`$1`</span>');

    return styledLine;
  });

  return styledLines.join('\n');
};

const ProjectEditDialog: React.FC<ProjectEditDialogProps> = ({
  open,
  onClose,
  project,
  onSave,
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCursorPosition = useRef<number>(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUpdatingRef = useRef<boolean>(false);

  // Initialize history when dialog opens
  useEffect(() => {
    if (open) {
      setDescription(project.description || '');
      historyRef.current = [project.description || ''];
      historyIndexRef.current = 0;
      // Set initial content without triggering cursor reset
      if (editorRef.current) {
        isUpdatingRef.current = true;
        editorRef.current.innerHTML = applyMarkdownStyles(project.description || '');
        isUpdatingRef.current = false;
      }
    }
  }, [open, project.description]);

  const addToHistory = (newValue: string) => {
    // Remove any future history if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    
    // Don't add to history if it's the same as the last value
    if (historyRef.current[historyRef.current.length - 1] === newValue) {
      return;
    }
    
    historyRef.current.push(newValue);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const canUndo = () => historyIndexRef.current > 0;
  const canRedo = () => historyIndexRef.current < historyRef.current.length - 1;

  const handleUndo = () => {
    if (canUndo()) {
      historyIndexRef.current--;
      const newValue = historyRef.current[historyIndexRef.current];
      setDescription(newValue);
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMarkdownStyles(newValue);
      }
    }
  };

  const handleRedo = () => {
    if (canRedo()) {
      historyIndexRef.current++;
      const newValue = historyRef.current[historyIndexRef.current];
      setDescription(newValue);
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMarkdownStyles(newValue);
      }
    }
  };

  const saveCursorPosition = () => {
    if (isUpdatingRef.current) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editorRef.current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        lastCursorPosition.current = preCaretRange.toString().length;
      }
    }
  };

  const restoreCursorPosition = () => {
    if (isUpdatingRef.current) return;
    
    const selection = window.getSelection();
    if (selection && editorRef.current) {
      const range = document.createRange();
      let charCount = 0;
      let found = false;

      const traverseNodes = (node: globalThis.Node) => {
        if (found) return;
        
        if (node.nodeType === globalThis.Node.TEXT_NODE) {
          const nodeText = node.textContent || '';
          const nextCount = charCount + nodeText.length;
          
          if (nextCount >= lastCursorPosition.current) {
            const offset = lastCursorPosition.current - charCount;
            range.setStart(node, Math.min(offset, nodeText.length));
            range.setEnd(node, Math.min(offset, nodeText.length));
            found = true;
          }
          charCount = nextCount;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverseNodes(node.childNodes[i]);
          }
        }
      };

      traverseNodes(editorRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const updateContent = (text: string) => {
    if (isUpdatingRef.current) return;
    
    setDescription(text);
    addToHistory(text);
    
    if (editorRef.current) {
      isUpdatingRef.current = true;
      const currentSelection = window.getSelection();
      const currentRange = currentSelection?.getRangeAt(0);
      
      editorRef.current.innerHTML = applyMarkdownStyles(text);
      
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        if (currentRange && editorRef.current?.contains(currentRange.commonAncestorContainer)) {
          // If the cursor was in the editor, restore its position
          restoreCursorPosition();
        }
        isUpdatingRef.current = false;
      });
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    saveCursorPosition();
    const text = e.currentTarget.textContent || '';
    updateContent(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle undo/redo
    if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    // Handle redo with cmd/ctrl + y
    if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode('  ');
        range.deleteContents();
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection.removeAllRanges();
        selection.addRange(range);
        saveCursorPosition();
      }
    }

    // Handle enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      saveCursorPosition();
    }
  };

  const handleSave = () => {
    onSave({
      ...project,
      name,
      description,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #e0e0e0',
        pb: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ 
            fontFamily: 'monospace',
            fontSize: '1.1rem',
            color: '#333333'
          }}>
            Edit Project
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Undo (⌘Z)">
              <IconButton
                onClick={handleUndo}
                disabled={!canUndo()}
                size="small"
                sx={{
                  color: canUndo() ? '#666666' : '#cccccc',
                  '&:hover': {
                    color: canUndo() ? '#10a37f' : undefined,
                    bgcolor: canUndo() ? 'rgba(16, 163, 127, 0.1)' : undefined,
                  },
                }}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo (⌘⇧Z)">
              <IconButton
                onClick={handleRedo}
                disabled={!canRedo()}
                size="small"
                sx={{
                  color: canRedo() ? '#666666' : '#cccccc',
                  '&:hover': {
                    color: canRedo() ? '#10a37f' : undefined,
                    bgcolor: canRedo() ? 'rgba(16, 163, 127, 0.1)' : undefined,
                  },
                }}
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: '#666666',
            '&:hover': {
              color: '#10a37f',
              bgcolor: 'rgba(16, 163, 127, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Project Name
            </Typography>
            <TextField
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter project name"
              sx={{
                '& .MuiOutlinedInput-root': {
                  background: 'white',
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.2)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#666666',
                  },
                },
              }}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Description
            </Typography>
            <Box sx={{ 
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 1,
              overflow: 'hidden',
              '&:hover': {
                borderColor: 'rgba(0, 0, 0, 0.2)',
              },
              '&:focus-within': {
                borderColor: '#666666',
              },
              height: '300px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <Box sx={{ 
                flex: 1,
                position: 'relative',
                '& .markdown-editor': {
                  width: '100%',
                  height: '100%',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  padding: '16px',
                  outline: 'none',
                  border: 'none',
                  resize: 'none',
                  backgroundColor: 'transparent',
                  color: '#24292e',
                  tabSize: 2,
                  '&::placeholder': {
                    color: '#999'
                  }
                }
              }}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="markdown-editor"
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{ __html: applyMarkdownStyles(description) }}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        px: 3,
        py: 2,
      }}>
        <Button 
          onClick={onClose}
          sx={{
            color: '#666666',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name}
          sx={{
            background: 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            color: '#666666',
            '&:hover': {
              background: 'linear-gradient(145deg, #f0f0f1 0%, #e8e8e9 100%)',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
            },
            '&.Mui-disabled': {
              background: 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
              color: 'rgba(102, 102, 102, 0.5)',
            },
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const BlockEditor: React.FC<BlockEditorProps> = ({ 
  project, 
  onUpdateProject, 
  globalActions,
  isDraggingAction: externalIsDraggingAction,
  draggedAction: externalDraggedAction,
}) => {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [nodeName, setNodeName] = useState('');
  const [nodeContent, setNodeContent] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceNode, setSourceNode] = useState<Node | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | undefined>(undefined);
  const [isDraggingAction, setIsDraggingAction] = useState(false);
  const [draggedAction, setDraggedAction] = useState<Action | null>(null);
  const [isRunDrawerOpen, setIsRunDrawerOpen] = useState(false);
  const [executionMode, setExecutionMode] = useState<'all' | 'custom'>('all');
  const [customCount, setCustomCount] = useState<number>(1);
  const [showExecutionWindow, setShowExecutionWindow] = useState(false);
  const [llmModel, setLlmModel] = useState('llama-3.2-3b-instruct');
  const [llmTemperature, setLlmTemperature] = useState(0.7);
  const [llmMaxTokens, setLlmMaxTokens] = useState(-1);
  const [generatedCode, setGeneratedCode] = useState('');

  // Add new state variables for model selection
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isLmStudioRunning, setIsLmStudioRunning] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Use external drag state if provided
  const effectiveIsDraggingAction = externalIsDraggingAction ?? isDraggingAction;
  const effectiveDraggedAction = externalDraggedAction ?? draggedAction;

  // Initialize nodes and edges
  const initialNodes: Node[] = project.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    position: block.position,
    data: {
      name: block.name || '',
      content: block.content,
      actionId: block.actionId,
      config: block.config,
      file: block.file,
      outputPath: block.outputPath,
      outputFilename: block.outputFilename,
      onUpdate: (content: string) => {
        const updatedBlocks = project.blocks.map((b) =>
          b.id === block.id ? { ...b, content } : b
        );
        onUpdateProject({
          ...project,
          blocks: updatedBlocks,
          updatedAt: new Date().toISOString(),
        });
      },
    },
  }));

  const initialEdges = (project.edges || []).map((edge) => ({
    ...edge,
    type: 'custom',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    style: { stroke: '#666666' },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Add a ref for the drawer
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleConfigChange = useCallback((config: Record<string, any>) => {
    if (!selectedNode) return;

    console.log('Updating config:', {
      nodeId: selectedNode.id,
      nodeType: selectedNode.type,
      config
    });

    // Update the selected node's data
    setSelectedNode({
      ...selectedNode,
      data: {
        ...selectedNode.data,
        config
      }
    });

    const updatedBlocks = project.blocks.map((block) =>
      block.id === selectedNode.id
        ? { ...block, config }
        : block
    );

    onUpdateProject({
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });

    // Update the nodes state to reflect the change
    setNodes(nodes => nodes.map(n => 
      n.id === selectedNode.id 
        ? { ...n, data: { ...n.data, config } }
        : n
    ));
  }, [selectedNode, project, onUpdateProject, setNodes]);

  const handleActionSelect = useCallback((action: Action) => {
    if (!selectedNode) return;

    console.log('Action selected:', {
      nodeType: selectedNode.type,
      actionType: action.type,
      nodeId: selectedNode.id,
      actionId: action.id,
      nodeData: selectedNode.data
    });

    // Map node types to action types
    const typeMap: Record<string, string> = {
      'import': 'input',
      'export': 'output',
      'transform': 'transform',
      'comparison': 'comparison'
    };

    const nodeType = selectedNode.type as keyof typeof typeMap;
    const isCompatible = action.type === typeMap[nodeType];

    if (!isCompatible) {
      console.log('Incompatible action type:', {
        nodeType: selectedNode.type,
        actionType: action.type,
        expectedActionType: typeMap[nodeType]
      });
      return;
    }

    // Update project blocks
    const updatedBlocks = project.blocks.map((block) =>
      block.id === selectedNode.id
        ? { 
            ...block, 
            actionId: action.id, 
            config: action.config.reduce((acc: Record<string, any>, cfg: ActionConfig) => {
              // Handle different config types appropriately
              let defaultValue: any;
              if (cfg.defaultValue === undefined) {
                switch (cfg.type) {
                  case 'text':
                    defaultValue = '';
                    break;
                  case 'markdown':
                    defaultValue = '';
                    break;
                  case 'number':
                    defaultValue = 0;
                    break;
                  case 'boolean':
                    defaultValue = false;
                    break;
                  case 'select':
                    defaultValue = cfg.options?.[0] || '';
                    break;
                  case 'json':
                    defaultValue = {};
                    break;
                  case 'list':
                    defaultValue = [];
                    break;
                  default:
                    defaultValue = null;
                }
              } else {
                defaultValue = cfg.defaultValue;
              }
              return {
                ...acc,
                [cfg.label]: defaultValue
              };
            }, {}),
            name: block.name || '',
            content: block.content || ''
          }
        : block
    );

    console.log('Updating blocks with action:', updatedBlocks);

    // Update project state
    onUpdateProject({
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });

    // Update nodes state to reflect the change
    setNodes(nodes => nodes.map(n => 
      n.id === selectedNode.id 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              actionId: action.id,
              config: action.config.reduce((acc: Record<string, any>, cfg: ActionConfig) => {
                // Handle different config types appropriately
                let defaultValue: any;
                if (cfg.defaultValue === undefined) {
                  switch (cfg.type) {
                    case 'text':
                      defaultValue = '';
                      break;
                    case 'markdown':
                      defaultValue = '';
                      break;
                    case 'number':
                      defaultValue = 0;
                      break;
                    case 'boolean':
                      defaultValue = false;
                      break;
                    case 'select':
                      defaultValue = cfg.options?.[0] || '';
                      break;
                    case 'json':
                      defaultValue = {};
                      break;
                    case 'list':
                      defaultValue = [];
                      break;
                    default:
                      defaultValue = null;
                  }
                } else {
                  defaultValue = cfg.defaultValue;
                }
                return {
                  ...acc,
                  [cfg.label]: defaultValue
                };
              }, {})
            } 
          }
        : n
    ));

    // Update selected action
    setSelectedAction(action);
  }, [selectedNode, project, onUpdateProject, setNodes]);

  const handleNodeDrop = useCallback((event: React.DragEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      const actionData = event.dataTransfer.getData('application/json');
      if (!actionData) {
        console.log('No action data found in drop event');
        return;
      }

      const action = JSON.parse(actionData) as Action;
      console.log('Parsed action data:', action);
      
      const nodeData = node.data as NodeData;
      console.log('Target node data:', {
        nodeId: node.id,
        nodeType: node.type,
        nodeData: {
          ...nodeData,
          id: node.id
        },
        actionId: nodeData.actionId
      });
      
      // Map node types to action types
      const typeMap: Record<string, string> = {
        'import': 'input',
        'export': 'output',
        'transform': 'transform',
        'comparison': 'comparison'
      };

      const nodeType = node.type as keyof typeof typeMap;
      const isCompatible = action.type === typeMap[nodeType];
      console.log('Compatibility check:', { 
        nodeType: node.type,
        actionType: action.type,
        expectedActionType: typeMap[nodeType],
        isCompatible, 
        hasAction: !!nodeData.actionId 
      });

      if (isCompatible && !nodeData.actionId) {
        // Reset the drawer state first
        setIsDrawerOpen(false);
        setSelectedNode(null);
        setSelectedAction(undefined);
        
        // Set the selected node first
        setSelectedNode(node);
        // Then call handleActionSelect with the action
        handleActionSelect(action);
        // Open the drawer
        setIsDrawerOpen(true);
        // Reset drag state
        setIsDraggingAction(false);
        setDraggedAction(null);
      } else {
        console.log('Drop rejected:', { 
          nodeType: node.type,
          actionType: action.type,
          expectedActionType: typeMap[nodeType],
          isCompatible, 
          hasAction: !!nodeData.actionId 
        });
      }
    } catch (error) {
      console.error('Error handling node drop:', error);
    }
  }, [handleActionSelect]);

  const handleNodeDragOver = useCallback((e: React.DragEvent, isCompatible: boolean, hasAction: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag over:', { isCompatible, hasAction });
    if (isCompatible && !hasAction) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  }, []);

  const handleConnectionClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    setIsConnecting(true);
    setSourceNode(node);
  }, []);

  const handleActionDragStart = useCallback((event: React.DragEvent, action: Action) => {
    console.log('Drag start with action:', action);
    event.stopPropagation();
    setIsDraggingAction(true);
    setDraggedAction(action);
    
    // Set the data in the drag event
    const actionData = JSON.stringify(action);
    event.dataTransfer.setData('application/json', actionData);
    event.dataTransfer.effectAllowed = 'copy';
    
    // Get the color based on action type
    const typeColors: Record<string, string> = {
      'transform': '#ffc107',
      'input': '#10a37f',
      'output': '#dc3545',
      'comparison': '#673ab7'
    };
    const color = typeColors[action.type] || '#666666';
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.style.width = '240px';
    dragImage.style.height = '48px';
    dragImage.style.background = `linear-gradient(145deg, ${color}15 0%, ${color}05 100%)`;
    dragImage.style.border = `1px solid ${color}30`;
    dragImage.style.borderRadius = '12px';
    dragImage.style.display = 'flex';
    dragImage.style.alignItems = 'center';
    dragImage.style.padding = '0 16px';
    dragImage.style.gap = '12px';
    dragImage.style.color = color;
    dragImage.style.fontWeight = '500';
    dragImage.style.fontSize = '14px';
    dragImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    dragImage.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    
    // Add the icon
    const iconElement = document.createElement('div');
    iconElement.style.display = 'flex';
    iconElement.style.alignItems = 'center';
    iconElement.style.justifyContent = 'center';
    iconElement.style.width = '32px';
    iconElement.style.height = '32px';
    iconElement.style.borderRadius = '50%';
    iconElement.style.background = `linear-gradient(145deg, ${color}30 0%, ${color}20 100%)`;
    
    // Create SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.style.fill = color;
    
    // Add path based on action type
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    switch (action.type) {
      case 'input':
        path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
        break;
      case 'output':
        path.setAttribute('d', 'M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z');
        break;
      case 'transform':
        path.setAttribute('d', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z');
        break;
      case 'comparison':
        path.setAttribute('d', 'M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z');
        break;
      default:
        path.setAttribute('d', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z');
    }
    svg.appendChild(path);
    iconElement.appendChild(svg);
    
    // Add the name
    const nameElement = document.createElement('div');
    nameElement.textContent = action.name;
    nameElement.style.flex = '1';
    nameElement.style.whiteSpace = 'nowrap';
    nameElement.style.overflow = 'hidden';
    nameElement.style.textOverflow = 'ellipsis';
    
    // Add the type badge
    const typeElement = document.createElement('div');
    typeElement.style.fontSize = '12px';
    typeElement.style.padding = '4px 12px';
    typeElement.style.borderRadius = '16px';
    typeElement.style.background = `${color}20`;
    typeElement.style.textTransform = 'capitalize';
    typeElement.style.fontWeight = '600';
    typeElement.style.letterSpacing = '0.5px';
    typeElement.textContent = action.type;
    
    dragImage.appendChild(iconElement);
    dragImage.appendChild(nameElement);
    dragImage.appendChild(typeElement);
    
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 120, 24);
    
    // Remove the element after drag starts
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, []);

  const handleActionDragEnd = useCallback(() => {
    setIsDraggingAction(false);
    setDraggedAction(null);
  }, []);

  const ImportNode = useCallback(({ data, id }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || InputIcon : InputIcon;
    const color = '#10a37f';  // Keep import nodes green

    const isCompatible = effectiveDraggedAction?.type === 'input';
    const hasAction = !!data.actionId;
    const isGrayedOut = effectiveIsDraggingAction && (!isCompatible || hasAction);
    const showPulse = effectiveIsDraggingAction && isCompatible && !hasAction;

    return (
      <Box
        sx={{
          background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
          border: '1px solid rgba(16, 163, 127, 0.2)',
          borderRadius: 2,
          padding: 2,
          minWidth: 200,
          boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
          position: 'relative',
          opacity: isGrayedOut ? 0.5 : 1,
          transition: 'all 0.2s ease',
          '&::after': showPulse ? {
            content: '""',
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 4,
            border: `2px solid ${color}`,
            animation: 'pulse 1.5s infinite',
          } : {},
          '@keyframes pulse': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '50%': {
              transform: 'scale(1.05)',
              opacity: 0.5,
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
        }}
        onDragOver={(e) => handleNodeDragOver(e, isCompatible, hasAction)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Drop event on ImportNode:', { 
            nodeId: id,
            data, 
            draggedAction: effectiveDraggedAction,
            eventData: e.dataTransfer.getData('application/json')
          });
          handleNodeDrop(e, { 
            id,
            type: 'import', 
            position: { x: 0, y: 0 }, // This will be ignored
            data: {
              ...data,
              id
            }
          } as Node);
        }}
      >
        <Handle type="target" position={Position.Left} style={{ display: 'none' }} />
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <InputIcon sx={{ color: color }} />
          <Typography variant="subtitle1" sx={{ color: color, fontWeight: 500 }}>
            {data.name || 'Import'}
          </Typography>
          {action && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${color}30 0%, ${color}20 100%)`,
                color: color,
              }}
            >
              <IconComponent sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Stack>
        {data.file && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 1, 
              fontSize: '0.75rem',
              color: color,
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <UploadIcon sx={{ fontSize: '0.875rem' }} />
            {data.file.split('/').pop() || data.file}
          </Typography>
        )}
        {isConnecting && (
          <IconButton
            className="connection-icon"
            size="small"
            onClick={(e) => handleConnectionClick(e, { 
              id,
              type: 'import', 
              position: { x: 0, y: 0 }, // This will be ignored
              data: {
                ...data,
                id
              }
            } as Node)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: color,
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                background: '#f0f0f0',
              },
            }}
          >
            <AddCircleOutlineIcon />
          </IconButton>
        )}
      </Box>
    );
  }, [handleConnectionClick, isConnecting, globalActions, effectiveIsDraggingAction, effectiveDraggedAction, handleNodeDragOver, handleNodeDrop]);

  const TransformNode = useCallback(({ data, id }: NodeProps<NodeData>) => {
    const action = [...globalActions, ...builtInActions].find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || TransformIcon : TransformIcon;
    const color = action ? action.color : '#ffc107';

    const isCompatible = effectiveDraggedAction?.type === 'transform';
    const hasAction = !!data.actionId;
    const isGrayedOut = effectiveIsDraggingAction && (!isCompatible || hasAction);
    const showPulse = effectiveIsDraggingAction && isCompatible && !hasAction;

    console.log('TransformNode render:', {
      nodeId: id,
      actionId: data.actionId,
      action: action?.name,
      hasAction
    });

    return (
      <Box
        sx={{
          background: 'linear-gradient(145deg, #fff8e6 0%, #fff0cc 100%)',
          border: '1px solid rgba(255, 193, 7, 0.2)',
          borderRadius: 2,
          padding: 2,
          minWidth: 200,
          boxShadow: '0 4px 12px rgba(255, 193, 7, 0.1)',
          position: 'relative',
          opacity: isGrayedOut ? 0.5 : 1,
          transition: 'all 0.2s ease',
          '&::after': showPulse ? {
            content: '""',
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 4,
            border: `2px solid ${color}`,
            animation: 'pulse 1.5s infinite',
          } : {},
          '@keyframes pulse': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '50%': {
              transform: 'scale(1.05)',
              opacity: 0.5,
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
        }}
        onDragOver={(e) => handleNodeDragOver(e, isCompatible, hasAction)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Drop event on TransformNode:', { 
            nodeId: id,
            data, 
            draggedAction: effectiveDraggedAction,
            eventData: e.dataTransfer.getData('application/json')
          });
          handleNodeDrop(e, { 
            id,
            type: 'transform', 
            position: { x: 0, y: 0 }, // This will be ignored
            data: {
              ...data,
              id
            }
          } as Node);
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <TransformIcon sx={{ color: '#ffc107' }} />
          <Typography variant="subtitle1" sx={{ color: '#ffc107', fontWeight: 500 }}>
            {data.name || 'Transform'}
          </Typography>
          {action && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${color}30 0%, ${color}20 100%)`,
                color: color,
              }}
            >
              <IconComponent sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Stack>
        {isConnecting && (
          <IconButton
            className="connection-icon"
            size="small"
            onClick={(e) => handleConnectionClick(e, { 
              id,
              type: 'transform', 
              position: { x: 0, y: 0 }, // This will be ignored
              data: {
                ...data,
                id
              }
            } as Node)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#ffc107',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                background: '#f0f0f0',
              },
            }}
          >
            <AddCircleOutlineIcon />
          </IconButton>
        )}
      </Box>
    );
  }, [handleConnectionClick, isConnecting, globalActions, effectiveIsDraggingAction, effectiveDraggedAction, handleNodeDragOver, handleNodeDrop]);

  const ExportNode = useCallback(({ data, id }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || OutputIcon : OutputIcon;
    const color = action ? action.color : '#dc3545';

    const isCompatible = effectiveDraggedAction?.type === 'output';
    const hasAction = !!data.actionId;
    const isGrayedOut = effectiveIsDraggingAction && (!isCompatible || hasAction);
    const showPulse = effectiveIsDraggingAction && isCompatible && !hasAction;

    return (
      <Box
        sx={{
          background: 'linear-gradient(145deg, #f7e6e6 0%, #f0d1d1 100%)',
          border: '1px solid rgba(220, 53, 69, 0.2)',
          borderRadius: 2,
          padding: 2,
          minWidth: 200,
          boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)',
          position: 'relative',
          opacity: isGrayedOut ? 0.5 : 1,
          transition: 'all 0.2s ease',
          '&::after': showPulse ? {
            content: '""',
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 4,
            border: `2px solid ${color}`,
            animation: 'pulse 1.5s infinite',
          } : {},
          '@keyframes pulse': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '50%': {
              transform: 'scale(1.05)',
              opacity: 0.5,
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
        }}
        onDragOver={(e) => handleNodeDragOver(e, isCompatible, hasAction)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Drop event on ExportNode:', { 
            nodeId: id,
            data, 
            draggedAction: effectiveDraggedAction,
            eventData: e.dataTransfer.getData('application/json')
          });
          handleNodeDrop(e, { 
            id,
            type: 'export', 
            position: { x: 0, y: 0 }, // This will be ignored
            data: {
              ...data,
              id
            }
          } as Node);
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Handle type="source" position={Position.Right} style={{ display: 'none' }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <OutputIcon sx={{ color: '#dc3545' }} />
          <Typography variant="subtitle1" sx={{ color: '#dc3545', fontWeight: 500 }}>
            {data.name || 'Export'}
          </Typography>
          {action && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${color}30 0%, ${color}20 100%)`,
                color: color,
              }}
            >
              <IconComponent sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Stack>
        {data.outputPath && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 1, 
              fontSize: '0.75rem',
              color: color,
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <DownloadIcon sx={{ fontSize: '0.875rem' }} />
            {data.outputFilename || 'output'} → {data.outputPath}
          </Typography>
        )}
        {isConnecting && (
          <IconButton
            className="connection-icon"
            size="small"
            onClick={(e) => handleConnectionClick(e, { 
              id,
              type: 'export', 
              position: { x: 0, y: 0 }, // This will be ignored
              data: {
                ...data,
                id
              }
            } as Node)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#dc3545',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                background: '#f0f0f0',
              },
            }}
          >
            <AddCircleOutlineIcon />
          </IconButton>
        )}
      </Box>
    );
  }, [globalActions, effectiveIsDraggingAction, effectiveDraggedAction, handleNodeDragOver, handleNodeDrop]);

  const ComparisonNode = useCallback(({ data, id }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || CompareIcon : CompareIcon;
    const color = action ? action.color : '#673ab7';

    const isCompatible = effectiveDraggedAction?.type === 'comparison';
    const hasAction = !!data.actionId;
    const isGrayedOut = effectiveIsDraggingAction && (!isCompatible || hasAction);
    const showPulse = effectiveIsDraggingAction && isCompatible && !hasAction;

    return (
      <Box
        sx={{
          background: 'linear-gradient(145deg, #e6e6f7 0%, #d1d1f0 100%)',
          border: '1px solid rgba(103, 58, 183, 0.2)',
          borderRadius: 2,
          padding: 2,
          minWidth: 200,
          boxShadow: '0 4px 12px rgba(103, 58, 183, 0.1)',
          position: 'relative',
          opacity: isGrayedOut ? 0.5 : 1,
          transition: 'all 0.2s ease',
          '&::after': showPulse ? {
            content: '""',
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 4,
            border: `2px solid ${color}`,
            animation: 'pulse 1.5s infinite',
          } : {},
          '@keyframes pulse': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '50%': {
              transform: 'scale(1.05)',
              opacity: 0.5,
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
        }}
        onDragOver={(e) => handleNodeDragOver(e, isCompatible, hasAction)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Drop event on ComparisonNode:', { 
            nodeId: id,
            data, 
            draggedAction: effectiveDraggedAction,
            eventData: e.dataTransfer.getData('application/json')
          });
          handleNodeDrop(e, { 
            id,
            type: 'comparison', 
            position: { x: 0, y: 0 }, // This will be ignored
            data: {
              ...data,
              id
            }
          } as Node);
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}`,
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <CompareIcon sx={{ color: '#673ab7' }} />
          <Typography variant="subtitle1" sx={{ color: '#673ab7', fontWeight: 500 }}>
            {data.name || 'Comparison'}
          </Typography>
          {action && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${color}30 0%, ${color}20 100%)`,
                color: color,
              }}
            >
              <IconComponent sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Stack>
        {isConnecting && (
          <IconButton
            className="connection-icon"
            size="small"
            onClick={(e) => handleConnectionClick(e, { 
              id,
              type: 'comparison', 
              position: { x: 0, y: 0 }, // This will be ignored
              data: {
                ...data,
                id
              }
            } as Node)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#673ab7',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                background: '#f0f0f0',
              },
            }}
          >
            <AddCircleOutlineIcon />
          </IconButton>
        )}
      </Box>
    );
  }, [handleConnectionClick, isConnecting, globalActions, effectiveIsDraggingAction, effectiveDraggedAction, handleNodeDragOver, handleNodeDrop]);

  const nodeTypes = useMemo(() => ({
    import: ImportNode,
    export: ExportNode,
    transform: TransformNode,
    comparison: ComparisonNode,
    code: CodeBlock,
    text: TextBlock,
    data: DataBlock,
  }), [ImportNode, ExportNode, TransformNode, ComparisonNode]);

  // Keep nodes in sync with project.blocks
  useEffect(() => {
    const updatedNodes: Node[] = project.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      position: block.position,
      data: {
        name: block.name || '',
        content: block.content,
        actionId: block.actionId,
        config: block.config,
        file: block.file,
        outputPath: block.outputPath,
        outputFilename: block.outputFilename,
        onUpdate: (content: string) => {
          const updatedBlocks = project.blocks.map((b) =>
            b.id === block.id ? { ...b, content } : b
          );
          onUpdateProject({
            ...project,
            blocks: updatedBlocks,
            updatedAt: new Date().toISOString(),
          });
        },
      },
    }));
    setNodes(updatedNodes);
  }, [project.blocks]);

  // Keep edges in sync with project.edges
  useEffect(() => {
    const updatedEdges = (project.edges || []).map((edge) => ({
      ...edge,
      type: 'custom',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: { stroke: '#666666' },
    }));
    setEdges(updatedEdges);
  }, [project.edges]);

  // Add edge deletion handler
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      console.log('Deleting edges:', edgesToDelete); // Debug log
      
      // Update the edges state
      setEdges((eds) => eds.filter((edge) => !edgesToDelete.some((e) => e.id === edge.id)));
      
      // Update the project state
      const updatedEdges = (project.edges || []).filter(
        (edge) => !edgesToDelete.some((e) => e.id === edge.id)
      );
      
      const updatedProject = {
        ...project,
        edges: updatedEdges,
        updatedAt: new Date().toISOString(),
      };
      
      console.log('Updated project:', updatedProject); // Debug log
      
      // Save to electron store
      onUpdateProject(updatedProject);
    },
    [project, onUpdateProject, setEdges]
  );

  // Add a useEffect to handle edge deletion from the CustomEdge component
  useEffect(() => {
    const handleEdgeDelete = (event: CustomEvent) => {
      console.log('Edge delete event:', event.detail); // Debug log
      onEdgesDelete(event.detail);
    };

    window.addEventListener('edgesDelete', handleEdgeDelete as EventListener);
    return () => {
      window.removeEventListener('edgesDelete', handleEdgeDelete as EventListener);
    };
  }, [onEdgesDelete]);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode || !params.source || !params.target) return;

      // Only allow connections from right to left
      const sourcePosition = sourceNode.position.x;
      const targetPosition = targetNode.position.x;
      if (sourcePosition >= targetPosition) return;

      // Enforce proper node type connections
      const isValidConnection = 
        (sourceNode.type === 'import' && (targetNode.type === 'transform' || targetNode.type === 'comparison')) ||
        (sourceNode.type === 'transform' && (targetNode.type === 'transform' || targetNode.type === 'export' || targetNode.type === 'comparison')) ||
        (sourceNode.type === 'comparison' && targetNode.type === 'export');

      if (isValidConnection) {
        const newEdge = {
          id: crypto.randomUUID(),
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
          type: 'custom',
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: { stroke: '#666666' },
        };

        setEdges((eds) => addEdge(newEdge, eds));
        
        // Save edge to project
        const updatedProject = {
          ...project,
          edges: [...(project.edges || []), newEdge],
          updatedAt: new Date().toISOString(),
        };
        onUpdateProject(updatedProject);
      }
    },
    [nodes, setEdges, project, onUpdateProject]
  );

  const onNodeDragStop = useCallback(
    (event: any, node: Node) => {
      const updatedBlocks = project.blocks.map((block) =>
        block.id === node.id
          ? { ...block, position: node.position }
          : block
      );
      onUpdateProject({
        ...project,
        blocks: updatedBlocks,
        updatedAt: new Date().toISOString(),
      });
    },
    [project, onUpdateProject]
  );

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't open editor if clicking on a handle or connection icon
    if ((event.target as HTMLElement).closest('.react-flow__handle') || 
        (event.target as HTMLElement).closest('.connection-icon')) {
      return;
    }
    
    console.log('Node clicked:', {
      nodeId: node.id,
      nodeType: node.type,
      nodeData: node.data,
      actionId: node.data.actionId
    });
    
    setSelectedNode(node);
    setNodeName(node.data.name || '');
    setNodeContent(node.data.content || '');
    
    // Find the selected action if the node has an actionId
    if (node.data.actionId) {
      const action = [...globalActions, ...builtInActions].find(a => a.id === node.data.actionId);
      console.log('Found action for node:', {
        nodeId: node.id,
        actionId: node.data.actionId,
        action: action?.name,
        isBuiltIn: action?.isBuiltIn
      });
      setSelectedAction(action || undefined);
    } else {
      setSelectedAction(undefined);
    }
    
    setIsDrawerOpen(true);
  }, [globalActions]);

  const onAddBlock = (type: BlockType) => {
    if (!reactFlowInstance.current) return;

    const { x, y, zoom } = reactFlowInstance.current.getViewport();
    
    // Calculate the center of the visible area
    const centerX = (window.innerWidth / (2 * zoom)) - (x / zoom);
    const centerY = (window.innerHeight / (2 * zoom)) - (y / zoom);

    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      name: '',
      content: '',
      position: { x: centerX, y: centerY },
      file: undefined,
    };

    // Create the new node immediately
    const newNode: Node = {
      id: newBlock.id,
      type: newBlock.type,
      position: newBlock.position,
      data: {
        name: newBlock.name,
        content: newBlock.content,
        file: newBlock.file,
        onUpdate: (content: string) => {
          const updatedBlocks = project.blocks.map((b) =>
            b.id === newBlock.id ? { ...b, content } : b
          );
          onUpdateProject({
            ...project,
            blocks: updatedBlocks,
            updatedAt: new Date().toISOString(),
          });
        },
      },
    };

    // Update both the project and nodes state
    const updatedProject = {
      ...project,
      blocks: [...project.blocks, newBlock],
      updatedAt: new Date().toISOString(),
    };
    onUpdateProject(updatedProject);
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSaveNode = () => {
    if (!selectedNode) return;

    console.log('Saving node - Current state:', {
      selectedNode,
      nodeType: selectedNode.type,
      nodeName,
      nodeContent,
      selectedAction,
      currentConfig: selectedNode.data.config
    });

    // First, ensure we have the latest action from globalActions
    const currentAction = selectedAction ? 
      [...globalActions, ...builtInActions].find(a => a.id === selectedAction.id) : 
      undefined;

    console.log('Current action from store:', currentAction);

    const updatedBlocks = project.blocks.map((block) => {
      if (block.id === selectedNode.id) {
        console.log('Updating block:', {
          blockId: block.id,
          oldActionId: block.actionId,
          newActionId: currentAction?.id,
          actionType: currentAction?.type,
          isBuiltIn: currentAction?.isBuiltIn
        });
        return { 
          ...block, 
          name: nodeName, 
          content: nodeContent,
          actionId: currentAction?.id,
          config: currentAction ? (selectedNode.data.config || {}) : undefined,
          file: selectedNode.data.file
        };
      }
      return block;
    });

    console.log('Saving node - Updated blocks:', updatedBlocks.map(b => ({
      id: b.id,
      type: b.type,
      actionId: b.actionId,
      name: b.name
    })));

    const updatedProject = {
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };

    console.log('Saving node - Final project update:', updatedProject);

    // Update the project
    onUpdateProject(updatedProject);

    // Update the nodes state to reflect the changes
    setNodes(nodes => {
      const updatedNodes = nodes.map(n => {
        if (n.id === selectedNode.id) {
          console.log('Updating node:', {
            nodeId: n.id,
            oldActionId: n.data.actionId,
            newActionId: currentAction?.id,
            actionType: currentAction?.type,
            isBuiltIn: currentAction?.isBuiltIn
          });
          return { 
            ...n, 
            data: { 
              ...n.data, 
              name: nodeName,
              content: nodeContent,
              actionId: currentAction?.id,
              config: currentAction ? (selectedNode.data.config || {}) : undefined,
              file: selectedNode.data.file
            } 
          };
        }
        return n;
      });
      console.log('Updated nodes:', updatedNodes.map(n => ({
        id: n.id,
        type: n.type,
        actionId: n.data.actionId,
        name: n.data.name
      })));
      return updatedNodes;
    });

    setIsDrawerOpen(false);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;

    const updatedBlocks = project.blocks.filter(block => block.id !== selectedNode.id);
    onUpdateProject({
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });

    setIsDrawerOpen(false);
  };

  // Add a click handler to cancel connection mode
  const handleBackgroundClick = useCallback(() => {
    setIsConnecting(false);
    setSourceNode(null);
  }, []);

  const handlePreviewCode = useCallback(() => {
    const code = generateFlowCode(
      project, 
      globalActions, 
      executionMode === 'custom' ? customCount : undefined,
      {
        model: llmModel,
        temperature: llmTemperature,
        maxTokens: llmMaxTokens
      }
    );
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-flow.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [project, globalActions, executionMode, customCount, llmModel, llmTemperature, llmMaxTokens]);

  const handleRunFlow = useCallback(() => {
    console.log('[FLOW_DEBUG] Starting flow execution...');
    console.log('[FLOW_DEBUG] LM Studio status:', { isRunning: isLmStudioRunning });
    
    if (!isLmStudioRunning) {
      console.error('[FLOW_DEBUG] LM Studio is not running');
      window.alert('LM Studio is not running. Please start LM Studio and try again.');
      return;
    }

    console.log('[FLOW_DEBUG] Generating flow code...');
    const code = generateFlowCode(
      project, 
      globalActions, 
      executionMode === 'custom' ? customCount : undefined,
      {
        model: llmModel,
        temperature: llmTemperature,
        maxTokens: llmMaxTokens
      }
    );
    console.log('[FLOW_DEBUG] Flow code generated, length:', code.length);
    
    setIsRunDrawerOpen(false);
    setShowExecutionWindow(true);
    setGeneratedCode(code);
    console.log('[FLOW_DEBUG] Flow execution window opened');
  }, [project, globalActions, executionMode, customCount, llmModel, llmTemperature, llmMaxTokens, isLmStudioRunning]);

  // Add debounced update functions
  const debouncedUpdateNodeName = useCallback(
    debounce((value: string) => {
      if (!selectedNode) return;
      setNodeName(value);
      // Update nodes state
      setNodes(nodes => nodes.map(n => 
        n.id === selectedNode.id 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                name: value
              } 
            }
          : n
      ));
    }, 500),
    [selectedNode, setNodes]
  );

  const debouncedUpdateNodeContent = useCallback(
    debounce((value: string) => {
      if (!selectedNode) return;
      setNodeContent(value);
      // Update nodes state
      setNodes(nodes => nodes.map(n => 
        n.id === selectedNode.id 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                content: value
              } 
            }
          : n
      ));
    }, 500),
    [selectedNode, setNodes]
  );

  const debouncedUpdateOutputFilename = useCallback(
    debounce((value: string) => {
      if (!selectedNode) return;
      // Update project blocks
      const updatedBlocks = project.blocks.map((block) =>
        block.id === selectedNode.id
          ? { ...block, outputFilename: value }
          : block
      );
      
      // Update project state
      onUpdateProject({
        ...project,
        blocks: updatedBlocks,
        updatedAt: new Date().toISOString(),
      });

      // Update nodes state
      setNodes(nodes => nodes.map(n => 
        n.id === selectedNode.id 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                outputFilename: value 
              } 
            }
          : n
      ));

      // Update selected node data
      setSelectedNode({
        ...selectedNode,
        data: {
          ...selectedNode.data,
          outputFilename: value
        }
      });
    }, 500),
    [selectedNode, project, onUpdateProject, setNodes]
  );

  // Add function to fetch models
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      if (!window.electron) {
        throw new Error('Electron is not available');
      }
      
      const response = await window.electron.ipcRenderer.invoke('fetch-lm-studio-models');
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch models');
      }
      
      setAvailableModels(response.data || []);
      setIsLmStudioRunning(true);
    } catch (error) {
      console.error('Error fetching models:', error);
      setAvailableModels([]);
      setIsLmStudioRunning(false);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Fetch models when Run drawer opens
  useEffect(() => {
    if (isRunDrawerOpen) {
      fetchModels();
    }
  }, [isRunDrawerOpen, fetchModels]);

  // Add state for project edit dialog
  const [isProjectEditDialogOpen, setIsProjectEditDialogOpen] = useState(false);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showExecutionWindow ? (
        <FlowExecutionWindow
          project={project}
          onClose={() => setShowExecutionWindow(false)}
          llmConfig={{
            model: llmModel,
            temperature: llmTemperature,
            maxTokens: llmMaxTokens
          }}
          generatedCode={generatedCode}
        />
      ) : (
        <>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{project.name}</Typography>
              <IconButton
                onClick={() => setIsProjectEditDialogOpen(true)}
                size="small"
                sx={{
                  color: '#666666',
                  background: 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e8e8e8 0%, #dcdcdc 100%)',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => setIsRunDrawerOpen(true)}
                size="small"
                sx={{
                  color: '#666666',
                  background: 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e8e8e8 0%, #dcdcdc 100%)',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Box>
            <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadIcon />}
                onClick={() => onAddBlock('import')}
                sx={{
                  color: '#10a37f',
                  borderColor: '#10a37f',
                  background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                  borderRadius: 12,
                  border: '1px solid rgba(16, 163, 127, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #d1f0e6 0%, #b8e9db 100%)',
                    borderColor: '#0d8c6d',
                    boxShadow: '0 6px 16px rgba(16, 163, 127, 0.15)',
                  },
                }}
              >
                Add Import
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TransformIcon />}
                onClick={() => onAddBlock('transform')}
                sx={{
                  color: '#997404',
                  borderColor: '#ffc107',
                  background: 'linear-gradient(145deg, #f7f6e6 0%, #f0e9d1 100%)',
                  boxShadow: '0 4px 12px rgba(255, 193, 7, 0.1)',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 193, 7, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #f0e9d1 0%, #e6dbb8 100%)',
                    borderColor: '#e6ac00',
                    boxShadow: '0 6px 16px rgba(255, 193, 7, 0.15)',
                  },
                }}
              >
                Add Transform
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CompareIcon />}
                onClick={() => onAddBlock('comparison')}
                sx={{
                  color: '#673ab7',
                  borderColor: '#673ab7',
                  background: 'linear-gradient(145deg, #e6e6f7 0%, #d1d1f0 100%)',
                  boxShadow: '0 4px 12px rgba(103, 58, 183, 0.1)',
                  borderRadius: 12,
                  border: '1px solid rgba(103, 58, 183, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #d1d1f0 0%, #b8b8e9 100%)',
                    borderColor: '#5e35b1',
                    boxShadow: '0 6px 16px rgba(103, 58, 183, 0.15)',
                  },
                }}
              >
                Add Comparison
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => onAddBlock('export')}
                sx={{
                  color: '#842029',
                  borderColor: '#dc3545',
                  background: 'linear-gradient(145deg, #f7e6e6 0%, #f0d1d1 100%)',
                  boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)',
                  borderRadius: 12,
                  border: '1px solid rgba(220, 53, 69, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #f0d1d1 0%, #e6b8b8 100%)',
                    borderColor: '#bb2d3b',
                    boxShadow: '0 6px 16px rgba(220, 53, 69, 0.15)',
                  },
                }}
              >
                Add Export
              </Button>
            </Stack>
          </Box>

          <ProjectEditDialog
            open={isProjectEditDialogOpen}
            onClose={() => setIsProjectEditDialogOpen(false)}
            project={project}
            onSave={(updatedProject) => {
              onUpdateProject(updatedProject);
              setIsProjectEditDialogOpen(false);
            }}
          />

          <ReactFlowProvider>
            <FlowWrapper
              project={project}
              onUpdateProject={onUpdateProject}
              reactFlowInstance={reactFlowInstance}
              onNodeClick={handleNodeClick}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgesDelete={onEdgesDelete}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onPaneClick={handleBackgroundClick}
            />
          </ReactFlowProvider>

          <Drawer
            anchor="right"
            open={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            PaperProps={{
              sx: {
                width: 400,
                p: 3,
                transition: 'transform 0.2s ease-out',
              },
              ref: drawerRef,
            }}
            SlideProps={{
              timeout: 200,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ 
                color: selectedNode?.type === 'import' 
                  ? '#10a37f' 
                  : selectedNode?.type === 'export' 
                  ? '#dc3545' 
                  : selectedNode?.type === 'comparison' 
                  ? '#673ab7' 
                  : '#ffc107',
                fontWeight: 500 
              }}>
                Edit {selectedNode?.type ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : ''}
              </Typography>
              <IconButton 
                onClick={() => setIsDrawerOpen(false)}
                sx={{
                  color: '#666',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Description
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    borderColor: selectedNode?.type === 'import' 
                      ? 'rgba(16, 163, 127, 0.2)'
                      : selectedNode?.type === 'export' 
                      ? 'rgba(220, 53, 69, 0.2)'
                      : selectedNode?.type === 'comparison' 
                      ? 'rgba(103, 58, 183, 0.2)'
                      : 'rgba(255, 193, 7, 0.2)',
                    '&:hover': {
                      borderColor: selectedNode?.type === 'import' 
                        ? 'rgba(16, 163, 127, 0.4)'
                        : selectedNode?.type === 'export' 
                        ? 'rgba(220, 53, 69, 0.4)'
                        : selectedNode?.type === 'comparison' 
                        ? 'rgba(103, 58, 183, 0.4)'
                        : 'rgba(255, 193, 7, 0.4)',
                    },
                  }}
                >
                  <TextField
                    defaultValue={nodeName}
                    onChange={(e) => {
                      setNodeName(e.target.value);
                      debouncedUpdateNodeName(e.target.value);
                    }}
                    fullWidth
                    size="small"
                    placeholder="Enter a description for this node..."
                    InputProps={{
                      startAdornment: (
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mr: 1,
                            background: selectedNode?.type === 'import' 
                              ? 'linear-gradient(145deg, #10a37f20 0%, #10a37f10 100%)'
                              : selectedNode?.type === 'export' 
                              ? 'linear-gradient(145deg, #dc354520 0%, #dc354510 100%)'
                              : selectedNode?.type === 'comparison' 
                                ? 'linear-gradient(145deg, #673ab720 0%, #673ab710 100%)'
                                : selectedNode?.type === 'transform'
                                  ? 'linear-gradient(145deg, #ffc10720 0%, #ffc10710 100%)'
                                  : 'linear-gradient(145deg, #66666620 0%, #66666610 100%)',
                            color: selectedNode?.type === 'import' 
                              ? '#10a37f'
                              : selectedNode?.type === 'export' 
                              ? '#dc3545'
                              : selectedNode?.type === 'comparison' 
                              ? '#673ab7'
                              : '#ffc107',
                          }}
                        >
                          <DataObjectIcon sx={{ fontSize: '1rem' }} />
                        </Box>
                      ),
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            border: 'none',
                          },
                          '&:hover fieldset': {
                            border: 'none',
                          },
                          '&.Mui-focused fieldset': {
                            border: 'none',
                          },
                        },
                      },
                    }}
                  />
                </Paper>
              </Box>
              
              {selectedNode?.type === 'import' && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Input File
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: '#10a37f10',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10a37f',
                          }}
                        >
                          <UploadIcon sx={{ fontSize: '1rem' }} />
                        </Box>
                      }
                      onClick={async () => {
                        if (selectedNode && window.electron) {
                          const result = await window.electron.ipcRenderer.invoke('show-open-dialog', {
                            properties: ['openFile']
                          });
                          
                          if (!result.canceled && result.filePaths.length > 0) {
                            const filePath = result.filePaths[0];
                            
                            // Update project blocks
                            const updatedBlocks = project.blocks.map((block) =>
                              block.id === selectedNode.id
                                ? { ...block, file: filePath }
                                : block
                            );
                            
                            // Update project state
                            onUpdateProject({
                              ...project,
                              blocks: updatedBlocks,
                              updatedAt: new Date().toISOString(),
                            });

                            // Update nodes state
                            setNodes(nodes => nodes.map(n => 
                              n.id === selectedNode.id 
                                ? { 
                                    ...n, 
                                    data: { 
                                      ...n.data, 
                                      file: filePath 
                                    } 
                                  }
                                : n
                            ));

                            // Update selected node data
                            setSelectedNode({
                              ...selectedNode,
                              data: {
                                ...selectedNode.data,
                                file: filePath
                              }
                            });
                          }
                        }
                      }}
                      sx={{
                        borderColor: 'rgba(16, 163, 127, 0.2)',
                        color: '#10a37f',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#10a37f',
                          backgroundColor: 'rgba(16, 163, 127, 0.04)',
                        },
                      }}
                    >
                      {selectedNode.data.file ? 'Change File' : 'Select File'}
                    </Button>
                    {selectedNode.data.file && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          mt: 1,
                          color: '#10a37f',
                          wordBreak: 'break-all',
                          whiteSpace: 'normal',
                          pl: 4
                        }}
                      >
                        {selectedNode.data.file.split('/').pop() || selectedNode.data.file}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              )}
              
              {selectedNode?.type === 'export' && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Output Configuration
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack spacing={1.5}>
                      <TextField
                        defaultValue={selectedNode.data.outputFilename || ''}
                        onBlur={(e) => {
                          if (selectedNode) {
                            debouncedUpdateOutputFilename(e.target.value);
                          }
                        }}
                        fullWidth
                        size="small"
                        placeholder="Enter output filename..."
                        InputProps={{
                          startAdornment: (
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: '#dc354510',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#dc3545',
                                mr: 1,
                              }}
                            >
                              <CodeIcon sx={{ fontSize: '1rem' }} />
                            </Box>
                          ),
                          sx: {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'transparent',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'transparent',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#dc3545',
                            },
                          },
                        }}
                      />
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: '#dc354510',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#dc3545',
                            }}
                          >
                            <DownloadIcon sx={{ fontSize: '1rem' }} />
                          </Box>
                        }
                        onClick={async () => {
                          if (selectedNode && window.electron) {
                            const result = await window.electron.ipcRenderer.invoke('show-open-dialog', {
                              properties: ['openDirectory']
                            });
                            
                            if (!result.canceled && result.filePaths.length > 0) {
                              const path = result.filePaths[0];
                              
                              // Update project blocks
                              const updatedBlocks = project.blocks.map((block) =>
                                block.id === selectedNode.id
                                  ? { ...block, outputPath: path }
                                  : block
                              );
                              
                              // Update project state
                              onUpdateProject({
                                ...project,
                                blocks: updatedBlocks,
                                updatedAt: new Date().toISOString(),
                              });

                              // Update nodes state
                              setNodes(nodes => nodes.map(n => 
                                n.id === selectedNode.id 
                                  ? { 
                                      ...n, 
                                      data: { 
                                        ...n.data, 
                                        outputPath: path 
                                      } 
                                    }
                                  : n
                              ));

                              // Update selected node data
                              setSelectedNode({
                                ...selectedNode,
                                data: {
                                  ...selectedNode.data,
                                  outputPath: path
                                }
                              });
                            }
                          }
                        }}
                        sx={{
                          borderColor: 'rgba(220, 53, 69, 0.2)',
                          color: '#dc3545',
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          '&:hover': {
                            borderColor: '#dc3545',
                            backgroundColor: 'rgba(220, 53, 69, 0.04)',
                          },
                        }}
                      >
                        {selectedNode.data.outputPath ? 'Change Output Folder' : 'Select Output Folder'}
                      </Button>
                      {selectedNode.data.outputPath && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#dc3545',
                            wordBreak: 'break-all',
                            whiteSpace: 'normal',
                            pl: 4
                          }}
                        >
                          {selectedNode.data.outputPath}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              )}
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Action Configuration
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <ActionSelector
                    value={selectedAction}
                    onChange={(action) => {
                      if (action) {
                        handleActionSelect(action);
                      } else {
                        if (!selectedNode) return;
                        const updatedBlocks = project.blocks.map((block) =>
                          block.id === selectedNode.id
                            ? { ...block, actionId: undefined, config: undefined }
                            : block
                        );
                        onUpdateProject({
                          ...project,
                          blocks: updatedBlocks,
                          updatedAt: new Date().toISOString(),
                        });
                        setSelectedAction(undefined);
                      }
                    }}
                    availableActions={[...globalActions, ...builtInActions]}
                    nodeType={selectedNode?.type as 'import' | 'export' | 'transform' | 'comparison'}
                  />
                  {selectedAction && (
                    <>
                      <Box sx={{ mt: 2, mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {selectedAction.description}
                        </Typography>
                      </Box>
                      <ActionConfigPanel
                        action={selectedAction}
                        config={selectedNode?.data.config || {}}
                        onChange={(config) => {
                          handleConfigChange(config);
                        }}
                      />
                    </>
                  )}
                </Paper>
              </Box>

              <Box sx={{ 
                display: 'flex', 
                gap: 1.5,
                mx: 2, // Add margin on both sides
                justifyContent: 'center' // Center the buttons
              }}>
                <Button
                  variant="contained"
                  onClick={handleSaveNode}
                  startIcon={
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <CheckIcon sx={{ fontSize: '1rem' }} />
                    </Box>
                  }
                  sx={{
                    background: 'linear-gradient(145deg, #666666 0%, #4d4d4d 100%)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    textTransform: 'none',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #4d4d4d 0%, #333333 100%)',
                      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)',
                    },
                  }}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleDeleteNode}
                  startIcon={
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: '#dc354510',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc3545',
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: '1rem' }} />
                    </Box>
                  }
                  sx={{
                    borderColor: 'rgba(220, 53, 69, 0.2)',
                    color: '#dc3545',
                    textTransform: 'none',
                    background: 'linear-gradient(145deg, #fff 0%, #f8f8f8 100%)',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)',
                    '&:hover': {
                      borderColor: '#dc3545',
                      background: 'linear-gradient(145deg, #f8f8f8 0%, #f0f0f0 100%)',
                      boxShadow: '0 6px 16px rgba(220, 53, 69, 0.15)',
                    },
                  }}
                >
                  Delete
                </Button>
              </Box>

      

            </Stack>
          </Drawer>
          <Drawer
            anchor="right"
            open={isRunDrawerOpen}
            onClose={() => setIsRunDrawerOpen(false)}
            PaperProps={{
              sx: {
                width: 400,
                p: 3,
                transition: 'transform 0.2s ease-out',
              },
            }}
            SlideProps={{
              timeout: 200,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Run Flow</Typography>
              <IconButton 
                onClick={() => setIsRunDrawerOpen(false)}
                sx={{
                  color: '#666',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Stack spacing={3}>
              {/* Execution Options */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#673ab7', fontWeight: 500 }}>
                  Execution Options
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack spacing={2}>
                    <FormControl component="fieldset">
                      <RadioGroup
                        value={executionMode}
                        onChange={(e) => setExecutionMode(e.target.value as 'all' | 'custom')}
                      >
                        <FormControlLabel
                          value="all"
                          control={
                            <Radio 
                              sx={{
                                color: '#673ab7',
                                '&.Mui-checked': {
                                  color: '#673ab7',
                                },
                              }}
                            />
                          }
                          label={
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: 1,
                              color: executionMode === 'all' ? '#673ab7' : 'text.primary'
                            }}>
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  backgroundColor: executionMode === 'all' ? '#673ab710' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: executionMode === 'all' ? '#673ab7' : 'text.secondary',
                                }}
                              >
                                <DataObjectIcon sx={{ fontSize: '1rem' }} />
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: executionMode === 'all' ? 500 : 400 }}>
                                Process all elements
                              </Typography>
                            </Box>
                          }
                          sx={{
                            m: 0,
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: executionMode === 'all' ? '#673ab708' : 'transparent',
                            border: '1px solid',
                            borderColor: executionMode === 'all' ? '#673ab730' : 'transparent',
                            '&:hover': {
                              bgcolor: executionMode === 'all' ? '#673ab710' : 'rgba(0, 0, 0, 0.04)',
                            },
                          }}
                        />
                        <FormControlLabel
                          value="custom"
                          control={
                            <Radio 
                              sx={{
                                color: '#673ab7',
                                '&.Mui-checked': {
                                  color: '#673ab7',
                                },
                              }}
                            />
                          }
                          label={
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: 1,
                              color: executionMode === 'custom' ? '#673ab7' : 'text.primary'
                            }}>
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  backgroundColor: executionMode === 'custom' ? '#673ab710' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: executionMode === 'custom' ? '#673ab7' : 'text.secondary',
                                }}
                              >
                                <CodeIcon sx={{ fontSize: '1rem' }} />
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: executionMode === 'custom' ? 500 : 400 }}>
                                Process specific number of elements
                              </Typography>
                            </Box>
                          }
                          sx={{
                            m: 0,
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: executionMode === 'custom' ? '#673ab708' : 'transparent',
                            border: '1px solid',
                            borderColor: executionMode === 'custom' ? '#673ab730' : 'transparent',
                            '&:hover': {
                              bgcolor: executionMode === 'custom' ? '#673ab710' : 'rgba(0, 0, 0, 0.04)',
                            },
                          }}
                        />
                      </RadioGroup>
                    </FormControl>

                    {executionMode === 'custom' && (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          borderColor: '#673ab730',
                        }}
                      >
                        <TextField
                          type="number"
                          value={customCount}
                          onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
                          inputProps={{ min: 1 }}
                          fullWidth
                          size="small"
                          placeholder="Enter number of elements"
                          InputProps={{
                            startAdornment: (
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  backgroundColor: '#673ab710',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#673ab7',
                                  mr: 1,
                                }}
                              >
                                <CodeIcon sx={{ fontSize: '1rem' }} />
                              </Box>
                            ),
                            sx: {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'transparent',
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'transparent',
                              },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#673ab7',
                              },
                            },
                          }}
                        />
                      </Paper>
                    )}
                  </Stack>
                </Paper>
              </Box>

              {/* LLM Configuration */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#673ab7', fontWeight: 500 }}>
                  LLM Configuration
                </Typography>
                <Paper
                  variant="outlined"
                  onClick={() => setIsModelDialogOpen(true)}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: isLmStudioRunning ? 'divider' : '#dc3545',
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: '#673ab7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <SmartToyIcon sx={{ fontSize: '1rem' }} />
                    </Box>
                    <Typography variant="body2" color={isLmStudioRunning ? 'text.primary' : 'error'} sx={{ flex: 1 }}>
                      {isLoadingModels ? 'Loading models...' : 
                       !isLmStudioRunning ? 'LM Studio is not running' :
                       availableModels.find(m => m.id === llmModel)?.id || 'Select a model'}
                    </Typography>
                    {isLmStudioRunning && (
                      <Chip
                        size="small"
                        label={availableModels.find(m => m.id === llmModel)?.state || 'unknown'}
                        sx={{
                          bgcolor: availableModels.find(m => m.id === llmModel)?.state === 'loaded' ? '#10a37f20' : '#ffc10720',
                          color: availableModels.find(m => m.id === llmModel)?.state === 'loaded' ? '#10a37f' : '#ffc107',
                        }}
                      />
                    )}
                  </Stack>
                </Paper>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Temperature
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <TextField
                      type="number"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                      fullWidth
                      size="small"
                      placeholder="0.0 - 1.0"
                      inputProps={{ 
                        min: 0,
                        max: 1,
                        step: 0.1
                      }}
                      InputProps={{
                        sx: {
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#673ab7',
                          },
                        },
                      }}
                    />
                  </Paper>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Max Tokens
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <TextField
                      type="number"
                      value={llmMaxTokens}
                      onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || -1)}
                      fullWidth
                      size="small"
                      placeholder="Unlimited (-1)"
                      InputProps={{
                        sx: {
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#673ab7',
                          },
                        },
                      }}
                    />
                  </Paper>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Input/Output Files
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack spacing={1}>
                      {project.blocks
                        .filter(block => block.type === 'import' || block.type === 'export')
                        .map((block) => (
                          <Box
                            key={block.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: 'background.paper',
                              border: '1px solid',
                              borderColor: 'divider',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: 'rgba(0, 0, 0, 0.02)',
                                borderColor: block.type === 'import' ? '#10a37f30' : '#673ab730',
                              },
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  backgroundColor: block.type === 'import' ? '#10a37f10' : '#673ab710',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: block.type === 'import' ? '#10a37f' : '#673ab7',
                                }}
                              >
                                {block.type === 'import' ? <InputIcon sx={{ fontSize: '1rem' }} /> : <OutputIcon sx={{ fontSize: '1rem' }} />}
                              </Box>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  flex: 1,
                                  wordBreak: 'break-all',
                                  whiteSpace: 'normal',
                                  color: 'text.primary',
                                  fontSize: '0.875rem',
                                }}
                              >
                                {block.type === 'import' ? block.file : `${block.outputPath}/${block.outputFilename}`}
                              </Typography>
                            </Stack>
                          </Box>
                        ))}
                    </Stack>
                  </Paper>
                </Box>
              </Box>

              {/* Model Selection Dialog */}
              <ModelSelectionDialog
                open={isModelDialogOpen}
                onClose={() => setIsModelDialogOpen(false)}
                models={availableModels}
                selectedModel={llmModel}
                onSelectModel={setLlmModel}
              />

              {/* Preview Code Button */}
              <Button
                variant="outlined"
                fullWidth
                startIcon={
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: '#10a37f10',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10a37f',
                    }}
                  >
                    <CodeIcon sx={{ fontSize: '1rem' }} />
                  </Box>
                }
                onClick={handlePreviewCode}
                sx={{
                  mt: 2,
                  borderColor: 'rgba(16, 163, 127, 0.2)',
                  color: '#10a37f',
                  textTransform: 'none',
                  background: 'linear-gradient(145deg, #fff 0%, #f8f8f8 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.1)',
                  '&:hover': {
                    borderColor: '#10a37f',
                    background: 'linear-gradient(145deg, #f8f8f8 0%, #f0f0f0 100%)',
                    boxShadow: '0 6px 16px rgba(16, 163, 127, 0.15)',
                  },
                }}
              >
                Preview Code
              </Button>

              {/* Run Button */}
              <Tooltip 
                title={!isLmStudioRunning ? "LM Studio is not running or developer mode is not enabled. Please start LM Studio and enable developer mode (Developer tab > Run) to run the flow." : ""}
                placement="top"
              >
                <span>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                        }}
                      >
                        <PlayArrowIcon sx={{ fontSize: '1rem' }} />
                      </Box>
                    }
                    onClick={handleRunFlow}
                    disabled={!isLmStudioRunning}
                    sx={{
                      mt: 2,
                      textTransform: 'none',
                      ...(isLmStudioRunning ? {
                        background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
                        boxShadow: '0 4px 12px rgba(16, 163, 127, 0.2)',
                        '&:hover': {
                          background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                          boxShadow: '0 6px 16px rgba(16, 163, 127, 0.25)',
                        },
                      } : {
                        background: 'linear-gradient(145deg, #e0e0e0 0%, #d0d0d0 100%)',
                        boxShadow: 'none',
                      }),
                      '&.Mui-disabled': {
                        background: 'linear-gradient(145deg, #e0e0e0 0%, #d0d0d0 100%)',
                        color: 'rgba(0, 0, 0, 0.38)',
                      },
                    }}
                  >
                    Run Flow
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Drawer>
        </>
      )}
    </Box>
  );
};

export default BlockEditor; 