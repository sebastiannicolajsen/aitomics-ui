import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Stack,
  Button,
  CircularProgress,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Project, Block, Edge } from '../types/Project';
import type { ElectronAPI } from '../types/electron';

// Add type for parsed data
interface ParsedData {
  [key: string]: string | number | boolean | null;
}

// Add type for electron window
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

// Add interface for flow progress
interface FlowProgress {
  name: string;
  progress: number;
  completed: boolean;
  hasError?: boolean;  // Add error state
}

// Update ExecutionState interface
interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  itemProgress: number;
  processedFlows: number;
  totalFlows: number;
  latestComparison?: {
    nodeName: string;
    actionName: string;
    list1: string;
    list2: string;
    result: string;
  };
  flowProgress: FlowProgress[];
  logs: (string | LogData)[];
  error?: string;
}

// Update LogData interface
interface LogData {
  type: 'transform' | 'input' | 'import' | 'item_update' | 'additional_file' | 'comparison_in_log' | 'export' | 'divider' | 'stop_divider';
  nodeId?: string;
  nodeName: string;
  actionName?: string;
  input?: any;
  output?: any;
  current?: number;
  total?: number;
  filePath?: string;
  list1?: string;
  list2?: string;
  comparisonResult?: string;
  list1Size?: number;
  list2Size?: number;
  outputPath?: string;
  outputFilename?: string;
  error?: boolean;
  errorMessage?: string;
  itemIndex?: number;
}

// Update InspectionDialogProps interface
interface InspectionDialogProps {
  open: boolean;
  onClose: () => void;
  nodeName: string;
  input: any;
  output: any;
  type: 'transform' | 'input' | 'import' | 'item_update' | 'additional_file' | 'comparison_in_log';
}

interface FlowExecutionWindowProps {
  project: Project;
  onClose: () => void;
  llmConfig?: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  generatedCode?: string;
}

// Update TransformInspectionDialog to be more generic
const InspectionDialog = ({ log, onClose }: { log: LogData; onClose: () => void }) => {
  const getDialogTitle = () => {
    switch (log.type) {
      case 'import':
        return `Import: ${log.nodeName}`;
      case 'input':
        return `Input Selection: ${log.nodeName}`;
      case 'transform':
        return `Transform: ${log.nodeName}`;
      case 'comparison_in_log':
        return `Comparison: ${log.nodeName} (${log.actionName})`;
      case 'export':
        return `Export: ${log.outputFilename}`;
      default:
        return 'Data Inspection';
    }
  };

  const getDialogContent = () => {
    switch (log.type) {
      case 'import':
        return (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Input:</Typography>
              <Box sx={{ 
                bgcolor: '#f8f9fa', 
                p: 1.5, 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#495057',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(log.input, null, 2)}
                </pre>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Output:</Typography>
              <Box sx={{ 
                bgcolor: '#f8f9fa', 
                p: 1.5, 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#495057',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(log.output, null, 2)}
                </pre>
              </Box>
            </Box>
          </Box>
        );
      case 'input':
        return (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Selection Process:</Typography>
              <Box sx={{ 
                bgcolor: '#f8f9fa', 
                p: 1.5, 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#495057',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(log.output, null, 2)}
                </pre>
              </Box>
            </Box>
          </Box>
        );
      case 'transform':
        return (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Input:</Typography>
              <Box sx={{ 
                bgcolor: '#f8f9fa', 
                p: 1.5, 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#495057',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(log.input, null, 2)}
                </pre>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Output:</Typography>
              <Box sx={{ 
                bgcolor: '#f8f9fa', 
                p: 1.5, 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#495057',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(log.output, null, 2)}
                </pre>
              </Box>
            </Box>
          </Box>
        );
      case 'comparison_in_log':
        return (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Comparison Details:</Typography>
            <Box sx={{ 
              mb: 2,
              bgcolor: '#f8f9fa',
              p: 1.5,
              borderRadius: '6px',
              border: '1px solid #e9ecef'
            }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>Node:</strong> {log.nodeName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>Action:</strong> {log.actionName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>List 1:</strong> {log.list1} ({log.list1Size} items)
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>List 2:</strong> {log.list2} ({log.list2Size} items)
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Result:</Typography>
            <Box sx={{ 
              bgcolor: '#f8f9fa', 
              p: 1.5, 
              borderRadius: '6px',
              border: '1px solid #e9ecef'
            }}>
              <pre style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: '#495057',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              }}>
                {JSON.stringify(log.comparisonResult, null, 2)}
              </pre>
            </Box>
          </>
        );
      case 'export':
        return (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Export Details:</Typography>
            <Box sx={{ 
              mb: 2,
              bgcolor: '#f8f9fa',
              p: 1.5,
              borderRadius: '6px',
              border: '1px solid #e9ecef'
            }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>Node:</strong> {log.nodeName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>Action:</strong> {log.actionName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>File:</strong> {log.outputFilename}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                <strong style={{ color: '#666666' }}>Location:</strong> {log.outputPath}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                if (log.outputPath && log.outputFilename) {
                  window.electron?.ipcRenderer.invoke('open-file-location', log.outputPath);
                }
              }}
              sx={{
                textTransform: 'none',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                borderColor: '#e0e0e0',
                color: '#333333',
                '&:hover': {
                  borderColor: '#10a37f',
                  color: '#10a37f',
                },
              }}
            >
              Open File Location
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={true}
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
          {getDialogTitle()}
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
        {getDialogContent()}
      </DialogContent>
    </Dialog>
  );
};

// Update SegmentedProgressBar component to use darker gray for completed states
const SegmentedProgressBar: React.FC<{ flows: FlowProgress[] }> = ({ flows }) => {
  if (flows.length === 0) {
    return (
      <Box sx={{ width: '100%', position: 'relative' }}>
        <Box
          sx={{
            height: '8px',
            bgcolor: '#f0f0f0',
            borderRadius: '4px',
          }}
        />
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block',
            textAlign: 'center',
            color: '#666666',
            mt: 0.5
          }}
        >
          Loading flows...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {/* Background track */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          bgcolor: '#f0f0f0',
          borderRadius: '4px',
        }}
      />
      
      {/* Progress segments */}
      <Box sx={{ 
        position: 'relative', 
        display: 'flex', 
        height: '8px',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        {flows.map((flow, index) => (
          <React.Fragment key={flow.name}>
            {/* Progress segment */}
            <Box
              sx={{
                flex: 1,
                position: 'relative',
                height: '100%',
                bgcolor: flow.hasError ? '#dc3545' : flow.completed ? '#1a1a1a' : '#e0e0e0',
                transition: 'background-color 0.3s ease',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: flow.hasError ? 'none' : flow.completed ? 'none' : 
                    `linear-gradient(90deg, ${flow.hasError ? '#dc3545' : '#333333'} ${flow.progress}%, transparent ${flow.progress}%)`,
                  transition: 'background 0.3s ease',
                }
              }}
            />
            {/* Divider (except after last segment) */}
            {index < flows.length - 1 && (
              <Box
                sx={{
                  width: '2px',
                  height: '100%',
                  bgcolor: '#ffffff',
                  zIndex: 1,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* Flow labels - Updated to use darker gray for completed states */}
      <Box sx={{ 
        display: 'flex', 
        mt: 0.5,
        px: 0.5,
        position: 'relative',
        height: '20px'  // Fixed height for labels
      }}>
        {flows.map((flow, index) => {
          // Calculate the position and width for each label
          const segmentWidth = 100 / flows.length;
          const leftPosition = (index * segmentWidth);
          
          // Determine if this flow has an error
          const hasError = flow.hasError;
          
          return (
            <Tooltip 
              key={flow.name} 
              title={`${flow.name}: ${flow.progress}%${hasError ? ' (error)' : flow.completed ? ' (completed)' : ''}`}
              placement="top"
            >
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  left: `${leftPosition}%`,
                  width: `${segmentWidth}%`,
                  color: hasError ? '#dc3545' : flow.completed ? '#1a1a1a' : '#333333',
                  fontWeight: hasError || flow.completed ? 500 : 400,
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  transition: 'color 0.3s ease',
                  px: 0.5,
                  pl: 1,  // Add left padding to align with segment start
                  // Add error styling
                  ...(hasError && {
                    color: '#dc3545',
                    fontWeight: 500,
                    '&::before': {
                      content: '"⚠️ "',
                      marginRight: '2px'
                    }
                  })
                }}
              >
                {flow.name}
              </Typography>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

// Add helper function at the top of the file, after imports
const formatElapsedTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (hours > 0) {
    return `${hours}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
  }
  return `${pad(minutes)}:${pad(seconds % 60)}`;
};

// Update ErrorDialog component to handle structured error data
const ErrorDialog = ({ error, onClose }: { error: { description: string; details: any }; onClose: () => void }) => {
  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '30vh',
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
        alignItems: 'center',
        bgcolor: '#fff5f5'
      }}>
        <Typography variant="h6" sx={{ 
          fontFamily: 'monospace',
          fontSize: '1.1rem',
          color: '#dc3545'
        }}>
          Error Details
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: '#666666',
            '&:hover': {
              color: '#dc3545',
              bgcolor: 'rgba(220, 53, 69, 0.1)',
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
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Description:</Typography>
          <Box sx={{ 
            bgcolor: '#fff5f5', 
            p: 1.5, 
            borderRadius: '6px',
            border: '1px solid #fad7d7'
          }}>
            <Typography sx={{ 
              color: '#dc3545',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}>
              {error.description}
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#666666' }}>Details:</Typography>
          <Box sx={{ 
            bgcolor: '#f8f9fa', 
            p: 1.5, 
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <pre style={{ 
              margin: 0, 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: '#495057',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            }}>
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// Add after the ExecutionState interface
interface DividerState {
  index: number;
  isCollapsed: boolean;
  nodeName: string;  // Add nodeName to uniquely identify dividers
}

// Add after the DividerState interface
interface DividerRef {
  index: number;
  element: HTMLDivElement;
}

const FlowExecutionWindow: React.FC<FlowExecutionWindowProps> = ({ project, onClose, llmConfig, generatedCode }) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    currentStep: '',
    progress: 0,
    itemProgress: 0,
    processedFlows: 0,
    totalFlows: 0,
    flowProgress: [],
    logs: [],
  });
  const [showDebugLogs, setShowDebugLogs] = useState(false);  // Changed to false by default
  const consoleRef = useRef<HTMLDivElement>(null);
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const processedImportsRef = useRef<Set<string>>(new Set());
  const completedImportsRef = useRef<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [executionGraph, setExecutionGraph] = useState<{
    nodes: Map<string, Block>;
    edges: Map<string, Set<string>>;
    inputNodes: Set<string>;
    outputNodes: Set<string>;
  } | null>(null);

  // Add a ref to track if flow has been executed
  const hasExecuted = useRef(false);

  // Add inside FlowExecutionWindow component, after other state declarations
  const [dividerStates, setDividerStates] = useState<DividerState[]>([]);
  const dividerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Add state for current divider
  const [currentDividerIndex, setCurrentDividerIndex] = useState<number | null>(null);

  // Load divider states from localStorage on mount
  useEffect(() => {
    const savedStates = localStorage.getItem(`dividerStates-${project.id}`);
    if (savedStates) {
      try {
        const parsedStates = JSON.parse(savedStates) as DividerState[];
        // Ensure all states are collapsed by default
        const collapsedStates = parsedStates.map(state => ({
          ...state,
          isCollapsed: true
        }));
        setDividerStates(collapsedStates);
      } catch (e) {
        console.error('Failed to parse saved divider states:', e);
        // Initialize with empty array if parsing fails
        setDividerStates([]);
      }
    } else {
      // Initialize with empty array if no saved states
      setDividerStates([]);
    }
  }, [project.id]);

  // Effect to manage divider states
  useEffect(() => {
    // Find all divider indices, excluding stop dividers
    const dividerIndices = executionState.logs
      .map((log, index) => typeof log === 'object' && log.type === 'divider' ? index : -1)
      .filter(index => index !== -1);

    // Update divider states
    setDividerStates((prevStates: DividerState[]) => {
      // Force all existing states to be collapsed
      const existingStates = prevStates
        .filter(state => dividerIndices.includes(state.index))
        .map(state => ({
          ...state,
          nodeName: (executionState.logs[state.index] as LogData).nodeName,
          isCollapsed: true  // Force collapse all existing states
        }));

      // Add new states for new dividers, all collapsed
      const newStates: DividerState[] = dividerIndices
        .filter(index => !existingStates.some(state => state.index === index))
        .map((index) => ({
          index,
          nodeName: (executionState.logs[index] as LogData).nodeName,
          isCollapsed: true  // Force all new states to be collapsed
        }));

      // Combine states, ensuring everything is collapsed
      return [...existingStates, ...newStates].map(state => ({
        ...state,
        isCollapsed: true  // One final check to ensure everything is collapsed
      }));
    });
  }, [executionState.logs]);

  // Save divider states to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`dividerStates-${project.id}`, JSON.stringify(dividerStates));
  }, [dividerStates, project.id]);

  // Update current divider index when new logs arrive
  useEffect(() => {
    const dividerIndices = executionState.logs
      .map((log, i) => typeof log === 'object' && log.type === 'divider' ? i : -1)
      .filter(i => i !== -1);

    if (dividerIndices.length > 0) {
      setCurrentDividerIndex(dividerIndices[dividerIndices.length - 1]);
    }
  }, [executionState.logs]);

  // Reset counters when component mounts or project changes
  useEffect(() => {
    processedImportsRef.current.clear();
    completedImportsRef.current.clear();
    setExecutionState(prev => ({
      ...prev,
      processedFlows: 0,
      totalFlows: 0
    }));
  }, [project]);

  // Build execution graph when component mounts
  useEffect(() => {
    const nodes = new Map<string, Block>();
    const edges = new Map<string, Set<string>>();
    const inputNodes = new Set<string>();
    const outputNodes = new Set<string>();

    // Add all nodes to the map
    project.blocks.forEach(block => {
      nodes.set(block.id, block);
      edges.set(block.id, new Set());
      
      if (block.type === 'import') {
        inputNodes.add(block.id);
      } else if (block.type === 'export') {
        outputNodes.add(block.id);
      }
    });

    // Add edges
    project.edges.forEach(edge => {
      const sourceEdges = edges.get(edge.source);
      if (sourceEdges) {
        sourceEdges.add(edge.target);
      }
    });

    setExecutionGraph({ nodes, edges, inputNodes, outputNodes });
  }, [project]);

  // Execute flow only when both executionGraph and generatedCode are available, and hasn't been executed yet
  useEffect(() => {
    console.log('[FLOW_DEBUG] Checking execution conditions:', {
      hasExecutionGraph: !!executionGraph,
      hasGeneratedCode: !!generatedCode,
      hasExecuted: hasExecuted.current
    });

    if (executionGraph && generatedCode && !hasExecuted.current) {
      console.log('[FLOW_DEBUG] Starting flow execution...');
      hasExecuted.current = true;
      executeFlow();
    }
  }, [executionGraph, generatedCode]);

  // Add a ref to track our listener
  const logListenerRef = useRef<((log: string) => void) | null>(null);

  // Update the log listener to handle errors in flow progress
  useEffect(() => {
    if (!window.electron) return;

    // Create a single handler function
    const handleLog = (log: string) => {
      try {
        // Filter out debug logs unless enabled
        if (log.includes('[FLOW_DEBUG]') && !showDebugLogs) {
          return;
        }

        // Handle termination error log
        if (log.includes('[FLOW_ERROR] Terminated by user')) {
          setExecutionState(prev => ({
            ...prev,
            status: 'idle',
            currentStep: 'Flow execution terminated',
            logs: [...prev.logs, log]
          }));
          return;
        }

        // Handle FLOW_UI_LOG messages
        if (log.includes('[FLOW_UI_LOG]')) {
          try {
            const logData = JSON.parse(log.replace('[FLOW_UI_LOG]', '').trim()) as LogData;
            
            // Handle divider logs
            if (logData.type === 'divider' || logData.type === 'stop_divider') {
              // Create a unique key for the divider using nodeName and itemIndex
              const dividerKey = `divider:${logData.nodeName}:${logData.itemIndex ?? 'flow_start'}`;
              
              // Only add the divider if we haven't seen this key before
              if (!seenMessagesRef.current.has(dividerKey)) {
                seenMessagesRef.current.add(dividerKey);
                setExecutionState(prev => ({
                  ...prev,
                  logs: [...prev.logs, logData]
                }));
              }
              return;
            }

            // Handle errors in flow progress
            if (logData.error || logData.errorMessage) {
              // When we get an error, mark the entire import node as having an error
              setExecutionState(prev => {
                const flowProgress = [...prev.flowProgress];
                // Find the import node that this error belongs to
                const importNodeIndex = flowProgress.findIndex(f => {
                  // For import nodes, match directly
                  if (f.name === logData.nodeName) return true;
                  // For transform nodes, find their parent import node
                  const isTransform = logData.type === 'transform';
                  if (isTransform) {
                    // Store the error node ID outside the function to avoid undefined issues
                    const errorNodeId = logData.nodeId;
                    
                    // Find the import node that this transform belongs to
                    const importNode = project.blocks.find(b => 
                      b.type === 'import' && 
                      project.edges.some(e => {
                        // Check if there's a path from import to this transform
                        const visited = new Set<string>();
                        function hasPathToTransform(currentId: string): boolean {
                          if (visited.has(currentId)) return false;
                          visited.add(currentId);
                          if (currentId === errorNodeId) return true;
                          const edges = project.edges.filter(e => e.source === currentId);
                          return edges.some(e => hasPathToTransform(e.target));
                        }
                        return e.source === b.id && hasPathToTransform(e.target);
                      })
                    );
                    return importNode && f.name === importNode.name;
                  }
                  return false;
                });

                if (importNodeIndex !== -1) {
                  // Mark the entire import node as having an error and completed
                  flowProgress[importNodeIndex] = {
                    ...flowProgress[importNodeIndex],
                    hasError: true,
                    completed: true,  // Mark as completed since it errored
                    progress: 100  // Set progress to 100 to ensure it's fully red
                  };
                }
                return {
                  ...prev,
                  flowProgress,
                  // Also update the overall execution state if we have an error
                  status: 'error',
                  error: logData.errorMessage || 'An error occurred during flow execution'
                };
              });
            }

            // Handle item_update logs to update flow progress
            if (logData.type === 'item_update') {
              const progress = Math.round((logData.current! / logData.total!) * 100);
              setExecutionState(prev => {
                const flowProgress = [...prev.flowProgress];
                const flowIndex = flowProgress.findIndex(f => f.name === logData.nodeName);
                
                if (flowIndex !== -1) {
                  // Only update progress if we don't already have an error
                  if (!flowProgress[flowIndex].hasError) {
                    flowProgress[flowIndex] = {
                      ...flowProgress[flowIndex],
                      progress: progress,
                      completed: progress === 100
                    };
                  }
                }

                return {
                  ...prev,
                  itemProgress: progress,
                  currentStep: logData.nodeName,
                  flowProgress
                };
              });
              return;
            }

            // Handle comparison_in_log
            if (logData.type === 'comparison_in_log') {
              setExecutionState(prev => ({
                ...prev,
                logs: [...prev.logs, logData],
                latestComparison: {
                  nodeName: logData.nodeName,
                  actionName: logData.actionName || '',
                  list1: logData.list1 || '',
                  list2: logData.list2 || '',
                  result: logData.comparisonResult || ''
                }
              }));
              return;
            }

            // Handle additional_file logs to track total flows
            if (logData.type === 'additional_file') {
              const importName = logData.nodeName;
              if (!processedImportsRef.current.has(importName)) {
                processedImportsRef.current.add(importName);
                setExecutionState(prev => {
                  const newTotal = processedImportsRef.current.size;
                  console.log('[DEBUG] Adding new import to total:', importName, 'New total:', newTotal);
                  
                  // Initialize or update flow progress segments
                  const flowProgress = [...prev.flowProgress];
                  if (!flowProgress.some(f => f.name === importName)) {
                    flowProgress.push({
                      name: importName,
                      progress: 0,
                      completed: false
                    });
                  }

                  return {
                    ...prev,
                    totalFlows: newTotal,
                    currentStep: importName,
                    flowProgress
                  };
                });
              }
              return;
            }

            // Handle export logs
            if (logData.type === 'export') {
              setExecutionState(prev => ({
                ...prev,
                logs: [...prev.logs, logData]
              }));
              return;
            }

            // Handle other UI logs (transform, input, import)
            if (logData.type === 'transform' || logData.type === 'input' || logData.type === 'import') {
              // Create a unique key for the log data to prevent duplicates
              const logKey = `${logData.type}:${logData.nodeName}:${JSON.stringify(logData.input)}:${JSON.stringify(logData.output)}`;
              
              if (!seenMessagesRef.current.has(logKey)) {
                seenMessagesRef.current.add(logKey);
                
                // For import logs, mark the import as completed
                if (logData.type === 'import') {
                  const importName = logData.nodeName;
                  if (!completedImportsRef.current.has(importName)) {
                    completedImportsRef.current.add(importName);
                    setExecutionState(prev => {
                      const newProcessed = completedImportsRef.current.size;
                      console.log('[DEBUG] Adding new completed import:', importName, 'New processed:', newProcessed, 'Total:', processedImportsRef.current.size);
                      return {
                        ...prev,
                        logs: [...prev.logs, logData],
                        processedFlows: newProcessed
                      };
                    });
                  } else {
                    setExecutionState(prev => ({
                      ...prev,
                      logs: [...prev.logs, logData]
                    }));
                  }
                } else {
                  // For other logs, just add them without updating the counter
                  setExecutionState(prev => ({
                    ...prev,
                    logs: [...prev.logs, logData]
                  }));
                }
              }
              return;
            }

            // Handle regular logs
            if (typeof log !== 'string' || !log.trim()) {
              return;
            }

            // Handle FLOW_ERROR logs specifically
            if (log.includes('[FLOW_ERROR]')) {
              const errorMatch = log.match(/\[FLOW_ERROR\](.*?)(\{[\s\S]*\})$/);
              if (errorMatch) {
                const [, description, jsonStr] = errorMatch;
                try {
                  const details = JSON.parse(jsonStr);
                  // Try to find the node name from various possible locations in the error details
                  let nodeName: string | undefined;
                  let nodeId: string | undefined;
                  
                  // Check different possible locations for the node identifier
                  if (details.nodeId) {
                    nodeId = details.nodeId;
                    const node = project.blocks.find(b => b.id === nodeId);
                    nodeName = node?.name || node?.id;
                  } else if (details.nodeName) {
                    nodeName = details.nodeName;
                  } else if (details.name) {
                    nodeName = details.name;
                  } else if (details.block) {
                    nodeName = details.block.name || details.block.id;
                    nodeId = details.block.id;
                  } else if (details.node) {
                    nodeName = details.node.name || details.node.id;
                    nodeId = details.node.id;
                  }

                  // If we found a node name or ID, update the flow progress
                  if (nodeName || nodeId) {
                    setExecutionState(prev => {
                      const flowProgress = [...prev.flowProgress];
                      // Find the import node that this error belongs to
                      const importNodeIndex = flowProgress.findIndex(f => {
                        // For import nodes, match directly
                        if (f.name === nodeName) return true;
                        
                        // For transform nodes, find their parent import node
                        const errorNode = project.blocks.find(b => 
                          (nodeName && (b.name === nodeName || b.id === nodeName)) || 
                          (nodeId && b.id === nodeId)
                        );
                        
                        if (errorNode && errorNode.type === 'transform') {
                          // Store the error node ID outside the function to avoid undefined issues
                          const errorNodeId = errorNode.id;
                          
                          // Find the import node that this transform belongs to
                          const importNode = project.blocks.find(b => 
                            b.type === 'import' && 
                            project.edges.some(e => {
                              // Check if there's a path from import to this transform
                              const visited = new Set<string>();
                              function hasPathToTransform(currentId: string): boolean {
                                if (visited.has(currentId)) return false;
                                visited.add(currentId);
                                if (currentId === errorNodeId) return true;
                                const edges = project.edges.filter(e => e.source === currentId);
                                return edges.some(e => hasPathToTransform(e.target));
                              }
                              return e.source === b.id && hasPathToTransform(e.target);
                            })
                          );
                          return importNode && f.name === importNode.name;
                        }
                        return false;
                      });

                      if (importNodeIndex !== -1) {
                        // Mark the entire import node as having an error and completed
                        flowProgress[importNodeIndex] = {
                          ...flowProgress[importNodeIndex],
                          hasError: true,
                          completed: true,  // Mark as completed since it errored
                          progress: 100  // Set progress to 100 to ensure it's fully red
                        };
                      }

                      return {
                        ...prev,
                        flowProgress,
                        status: 'error',
                        error: description.trim(),
                        logs: [...prev.logs, log]
                      };
                    });
                  }
                } catch (e) {
                  // If JSON parsing fails, try to extract node name from the description
                  const nodeMatch = description.match(/node:?\s*([^,}]+)/i);
                  if (nodeMatch) {
                    const nodeName = nodeMatch[1].trim();
                    setExecutionState(prev => {
                      const flowProgress = [...prev.flowProgress];
                      const flowIndex = flowProgress.findIndex(f => f.name === nodeName);
                      if (flowIndex !== -1) {
                        flowProgress[flowIndex] = {
                          ...flowProgress[flowIndex],
                          hasError: true,
                          completed: true,
                          progress: 100
                        };
                      }
                      return {
                        ...prev,
                        flowProgress,
                        status: 'error',
                        error: description.trim(),
                        logs: [...prev.logs, log]
                      };
                    });
                  }
                }
              }
              return; // Skip further processing for error logs
            }

            // Check for duplicates using the original message
            const originalMessage = log.trim();
            if (seenMessagesRef.current.has(originalMessage)) {
              return;
            }
            seenMessagesRef.current.add(originalMessage);

            // Clean up [FLOW] logs by removing the tag and timestamp
            let cleanLog = originalMessage;
            if (cleanLog.startsWith('[FLOW]')) {
              // Remove the [FLOW] tag
              cleanLog = cleanLog.replace('[FLOW]', '').trim();
              // Remove the timestamp at the end if it exists (format: (HH:MM:SS.mmm))
              cleanLog = cleanLog.replace(/\s*\(\d{2}:\d{2}:\d{2}\.\d{3}\)$/, '');
            }
            
            setExecutionState(prev => ({
              ...prev,
              logs: [...prev.logs, cleanLog],
              lastUpdate: Date.now()
            }));
          } catch (error) {
            // Silently handle errors
          }
        }

        // Handle regular logs
        if (typeof log !== 'string' || !log.trim()) {
          return;
        }

        // Check for duplicates using the original message
        const originalMessage = log.trim();
        if (seenMessagesRef.current.has(originalMessage)) {
          return;
        }
        seenMessagesRef.current.add(originalMessage);

        // Clean up [FLOW] logs by removing the tag and timestamp
        let cleanLog = originalMessage;
        if (cleanLog.startsWith('[FLOW]')) {
          // Remove the [FLOW] tag
          cleanLog = cleanLog.replace('[FLOW]', '').trim();
          // Remove the timestamp at the end if it exists (format: (HH:MM:SS.mmm))
          cleanLog = cleanLog.replace(/\s*\(\d{2}:\d{2}:\d{2}\.\d{3}\)$/, '');
        }
        
        setExecutionState(prev => ({
          ...prev,
          logs: [...prev.logs, cleanLog],
          lastUpdate: Date.now()
        }));
      } catch (error) {
        // Silently handle errors
      }
    };

    // Store the handler in our ref
    logListenerRef.current = handleLog;

    // Remove our previous listener if it exists
    if (logListenerRef.current) {
      window.electron.ipcRenderer.removeListener('flow-log', logListenerRef.current);
      console.log('[FLOW_DEBUG] Removed previous flow-log listener');
    }

    // Add our new listener
    window.electron.ipcRenderer.on('flow-log', handleLog);
    console.log('[FLOW_DEBUG] Added new flow-log listener');

    // Cleanup function to remove the listener and clear refs
    return () => {
      if (window.electron && logListenerRef.current) {
        window.electron.ipcRenderer.removeListener('flow-log', logListenerRef.current);
        logListenerRef.current = null;
        seenMessagesRef.current.clear();
        processedImportsRef.current.clear();
        completedImportsRef.current.clear();
        console.log('[FLOW_DEBUG] Cleaned up flow-log listener and refs');
      }
    };
  }, []); // Empty dependency array to ensure this only runs once

  // Add auto-scroll effect
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [executionState.logs]);

  // Add elapsed time effect
  useEffect(() => {
    if (executionState.status === 'running') {
      if (!startTimeRef.current) {
        // Start timer only if we don't have a start time
        startTimeRef.current = Date.now();
      }
      
      // Always update the timer while running
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Date.now() - startTimeRef.current);
        }
      }, 1000);
    } else if (executionState.status === 'completed' || executionState.status === 'error') {
      // Stop the timer but keep the final time
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Calculate final time if we have a start time
      if (startTimeRef.current) {
        setElapsedTime(Date.now() - startTimeRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [executionState.status]);

  // Reset elapsed time only when starting a completely new flow
  useEffect(() => {
    if (executionState.status === 'idle') {
      startTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [executionState.status]);

  // Remove the intersection observer effect since we don't want auto-collapse
  useEffect(() => {
    // Create intersection observer just for tracking visibility
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // We don't auto-collapse anymore, just track visibility
        entries.forEach(entry => {
          const index = Number(entry.target.getAttribute('data-divider-index'));
          if (!isNaN(index)) {
            // Just update visibility state if needed, but don't collapse
            setDividerStates(prevStates => {
              const state = prevStates.find(s => s.index === index);
              if (state) {
                // Keep the current collapsed state
                return prevStates;
              }
              return prevStates;
            });
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '-10% 0px'
      }
    );

    // Observe all current divider elements
    dividerRefs.current.forEach((element, index) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Modify toggle function to only toggle the clicked divider
  const toggleDivider = (index: number) => {
    setDividerStates(prevStates => {
      const newStates = prevStates.map(state => {
        if (state.index === index) {
          // Only toggle the clicked divider
          return { ...state, isCollapsed: !state.isCollapsed };
        }
        return state;
      });
      return newStates;
    });
  };

  const parseInputFile = async (filePath: string): Promise<ParsedData[]> => {
    try {
      const electron = (window as any).electron as ElectronAPI | undefined;
      if (!electron) {
        throw new Error('Electron API not available');
      }

      // Use window.electron.ipcRenderer to communicate with main process
      const content = await electron.ipcRenderer.invoke('read-file', filePath);
      const fileType = filePath.split('.').pop()?.toLowerCase();

      if (fileType === 'json') {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : [data];
      } else if (fileType === 'csv') {
        // Parse CSV content manually since we can't use csv-parse in renderer
        const lines = content.split('\n');
        const headers = lines[0].split(',').map((h: string) => h.trim());
        return lines.slice(1)
          .filter((line: string) => line.trim())
          .map((line: string) => {
            const values = line.split(',').map((v: string) => v.trim());
            const row: ParsedData = {};
            headers.forEach((header: string, index: number) => {
              const value = values[index];
              // Try to parse numbers and booleans
              if (value === 'true') row[header] = true;
              else if (value === 'false') row[header] = false;
              else if (!isNaN(Number(value))) row[header] = Number(value);
              else row[header] = value;
            });
            return row;
          });
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse input file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const executeFlow = useCallback(async () => {
    console.log('[FLOW_DEBUG] executeFlow called');
    if (!generatedCode || !window.electron) {
      console.error('[FLOW_DEBUG] Missing requirements:', {
        hasGeneratedCode: !!generatedCode,
        hasElectron: !!window.electron
      });
      return;
    }

    console.log('[FLOW_DEBUG] Setting execution state to running');
    setExecutionState(prev => ({ 
      ...prev, 
      status: 'running',
      currentStep: 'Starting flow execution...'
    }));

    try {
      console.log('[FLOW_DEBUG] Invoking execute-flow IPC handler');
      await window.electron.ipcRenderer.invoke('execute-flow', generatedCode);
      console.log('[FLOW_DEBUG] Flow execution completed successfully');
      setExecutionState(prev => ({ 
        ...prev, 
        status: 'completed', 
        progress: 100,
        currentStep: 'Flow execution completed'
      }));
    } catch (error) {
      console.error('[FLOW_DEBUG] Flow execution failed:', error);
      setExecutionState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        currentStep: 'Flow execution failed'
      }));
    }
  }, [generatedCode]);

  const handlePause = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      status: prev.status === 'running' ? 'paused' : 'running',
      currentStep: prev.status === 'running' ? 'Flow execution paused' : 'Resuming flow execution',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Execution ${prev.status === 'running' ? 'paused' : 'resumed'}`]
    }));
  }, []);

  const handleStop = useCallback(async () => {
    try {
      // Update UI state immediately to show we're stopping
      setExecutionState(prev => ({
        ...prev,
        status: 'idle',
        currentStep: 'Terminating flow execution...',
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Terminating flow execution...`]
      }));

      // Send message to main process to terminate the child process
      await window.electron?.ipcRenderer.invoke('terminate-flow');

      // Update UI state after successful termination
      setExecutionState(prev => ({
        ...prev,
        status: 'idle',
        currentStep: 'Flow execution terminated',
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Flow execution terminated`]
      }));

      // Reset execution state
      hasExecuted.current = false;
    } catch (error) {
      console.error('Failed to terminate flow:', error);
      setExecutionState(prev => ({
        ...prev,
        status: 'error',
        currentStep: 'Failed to terminate flow',
        error: error instanceof Error ? error.message : String(error),
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Failed to terminate flow: ${error instanceof Error ? error.message : String(error)}`]
      }));
    }
  }, []);

  const handleSave = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Saving intermediate results...`]
    }));
    // TODO: Implement saving intermediate results
  }, []);

  const [inspectionDialog, setInspectionDialog] = useState<LogData | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ description: string; details: any } | null>(null);

  // Add back the helper functions
  const registerDividerRef = (index: number, element: HTMLDivElement | null) => {
    if (element) {
      dividerRefs.current.set(index, element);
      observerRef.current?.observe(element);
    } else {
      dividerRefs.current.delete(index);
    }
  };

  const getFirstLineAfterDivider = (dividerIndex: number): string | null => {
    const nextLog = executionState.logs[dividerIndex + 1];
    if (!nextLog) return null;
    
    if (typeof nextLog === 'string') {
      return nextLog;
    } else if (nextLog.type === 'transform' || nextLog.type === 'input' || nextLog.type === 'import' || 
               nextLog.type === 'comparison_in_log' || nextLog.type === 'export') {
      // For structured logs, return a preview string
      switch (nextLog.type) {
        case 'import':
          return `Import: ${nextLog.nodeName}`;
        case 'input':
          return `Input Selection: ${nextLog.nodeName}`;
        case 'transform':
          return `Transform: ${nextLog.nodeName}`;
        case 'comparison_in_log':
          return `Comparison: ${nextLog.nodeName} (${nextLog.actionName})`;
        case 'export':
          return `Export: ${nextLog.outputFilename}`;
        default:
          return null;
      }
    }
    return null;
  };

  const getNextDividerIndex = (currentIndex: number): number => {
    const nextDivider = executionState.logs
      .slice(currentIndex + 1)
      .findIndex(log => typeof log === 'object' && log.type === 'divider');
    return nextDivider === -1 ? executionState.logs.length : currentIndex + 1 + nextDivider;
  };

  const getElementsBetweenDividers = (dividerIndex: number): number => {
    const nextDividerIndex = getNextDividerIndex(dividerIndex);
    return executionState.logs
      .slice(dividerIndex + 1, nextDividerIndex)
      .filter(log => typeof log === 'string' || 
        (typeof log === 'object' && 
         (log.type === 'transform' || log.type === 'input' || log.type === 'import' || 
          log.type === 'comparison_in_log' || log.type === 'export')))
      .length;
  };

  const isInsideDivider = (logIndex: number): boolean => {
    const lastDividerIndex = executionState.logs
      .slice(0, logIndex)
      .map((log, i) => typeof log === 'object' && log.type === 'divider' ? i : -1)
      .filter(i => i !== -1)
      .pop();

    if (lastDividerIndex === undefined) return false;

    // If this is the only element after the divider, don't indent
    if (getElementsBetweenDividers(lastDividerIndex) <= 1) {
      return false;
    }

    const dividerState = dividerStates.find(state => state.index === lastDividerIndex);
    return !dividerState?.isCollapsed;
  };

  // Modify the shouldShowLog function to not automatically keep current divider expanded
  const shouldShowLog = (index: number) => {
    // First check if there's a stop divider before this log
    const hasStopDividerBefore = executionState.logs
      .slice(0, index)
      .some(log => typeof log === 'object' && log.type === 'stop_divider');

    // If there's a stop divider before this log, always show it
    if (hasStopDividerBefore) {
      return true;
    }

    // Otherwise, use the normal divider visibility logic
    const lastDividerIndex = executionState.logs
      .slice(0, index)
      .map((log, i) => typeof log === 'object' && log.type === 'divider' ? i : -1)
      .filter(i => i !== -1)
      .pop();

    if (lastDividerIndex === undefined) return true;

    // If this is the only element after the divider, always show it
    if (getElementsBetweenDividers(lastDividerIndex) <= 1) {
      return true;
    }

    const dividerState = dividerStates.find(state => state.index === lastDividerIndex);
    // Show logs if the divider is expanded
    return !dividerState?.isCollapsed;
  };

  // Add this helper function after the other helper functions
  const hasErrorsBetweenDividers = (dividerIndex: number): boolean => {
    const nextDividerIndex = getNextDividerIndex(dividerIndex);
    return executionState.logs
      .slice(dividerIndex + 1, nextDividerIndex)
      .some(log => {
        if (typeof log === 'string') {
          return log.includes('[FLOW_ERROR]');
        }
        if (typeof log === 'object') {
          // Check if this is a flow progress update with an error
          const flowProgress = executionState.flowProgress.find(f => f.name === log.nodeName);
          return flowProgress?.hasError || false;
        }
        return false;
      });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
      {/* Header with Progress - Fixed position */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        bgcolor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#333333' }}>
              {project.name}
            </Typography>
            {elapsedTime > 0 && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#666666',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  bgcolor: '#f8f9fa',
                  px: 1,
                  py: 0.25,
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0'
                }}
              >
                {formatElapsedTime(elapsedTime)}
              </Typography>
            )}
          </Box>
          <Typography variant="subtitle2" sx={{ color: '#666666' }}>
            {executionState.currentStep || 'No flow running'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            {/* Segmented Progress Bar */}
            <SegmentedProgressBar flows={executionState.flowProgress} />
            
            {/* Latest Comparison */}
            {executionState.latestComparison && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                px: 1,
                py: 0.5,
                bgcolor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}>
                <CompareArrowsIcon sx={{ fontSize: '1rem', color: '#666666' }} />
                <Typography variant="body2" sx={{ color: '#666666' }}>
                  {executionState.latestComparison.nodeName}
                  {executionState.latestComparison.actionName && 
                    ` (${executionState.latestComparison.actionName})`}:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#333333', fontWeight: 500 }}>
                    {executionState.latestComparison.list1}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666666' }}>/</Typography>
                  <Typography variant="body2" sx={{ color: '#333333', fontWeight: 500 }}>
                    {executionState.latestComparison.list2}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ 
                  color: executionState.latestComparison.result === 'match' ? '#10a37f' : '#673ab7',
                  fontWeight: 700,
                  ml: 0.5
                }}>
                  ({executionState.latestComparison.result})
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={showDebugLogs ? "Hide Debug Logs" : "Show Debug Logs"}>
            <IconButton
              onClick={() => setShowDebugLogs(!showDebugLogs)}
              sx={{
                color: showDebugLogs ? '#10a37f' : '#666666',
                '&:hover': {
                  color: showDebugLogs ? '#0d8c6d' : '#333333',
                }
              }}
            >
              <BugReportIcon />
            </IconButton>
          </Tooltip>
          {executionState.status === 'running' && (
            <Tooltip title="Stop Flow Execution">
              <span>
                <Button
                  variant="contained"
                  startIcon={<StopIcon />}
                  onClick={handleStop}
                  sx={{
                    bgcolor: '#dc3545',
                    '&:hover': { 
                      bgcolor: '#bb2d3b',
                      boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                    },
                    boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                    px: 2
                  }}
                >
                  Stop Flow
                </Button>
              </span>
            </Tooltip>
          )}
          <IconButton onClick={onClose} sx={{ color: '#666666' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Console Window */}
      <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: '#f5f5f5', p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            bgcolor: '#ffffff',
            color: '#333333',
            fontFamily: 'monospace',
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Console Header - Simplified */}
          <Box sx={{ 
            p: 1, 
            borderBottom: '1px solid #e0e0e0',
            bgcolor: '#f8f9fa',
          }}>
            <Typography variant="caption" sx={{ color: '#666666' }}>
              Flow Execution Console
            </Typography>
          </Box>
          
          {/* Console Content - Scrollable */}
          <Box 
            ref={consoleRef}
            sx={{ 
              p: 2,
              flex: 1,
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f5f5f5',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#e0e0e0',
                borderRadius: '4px',
                '&:hover': {
                  background: '#d0d0d0',
                },
              },
            }}
          >
            {executionState.logs.map((log, index) => {
              // Skip item_update logs in the console display
              if (typeof log === 'object' && log.type === 'item_update') {
                return null;
              }
              
              // Handle divider logs
              if (typeof log === 'object' && (log.type === 'divider' || log.type === 'stop_divider')) {
                const dividerLog = log as LogData;
                // Skip stop dividers entirely - don't render anything for them
                if (dividerLog.type === 'stop_divider') {
                  return null;
                }
                // Skip divider if it only has one element after it
                if (getElementsBetweenDividers(index) <= 1) {
                  return null;
                }

                const dividerState = dividerStates.find(state => state.index === index);
                const isCollapsed = dividerState?.isCollapsed ?? true;
                const isLastDivider = index === executionState.logs
                  .map((l, i) => typeof l === 'object' && l.type === 'divider' ? i : -1)
                  .filter(i => i !== -1)
                  .pop();
                
                const firstLine = getFirstLineAfterDivider(index);

                return (
                  <Box
                    key={`divider-${index}`}
                    ref={(el: HTMLDivElement | null) => registerDividerRef(index, el)}
                    data-divider-index={index}
                    sx={{
                      my: 1.5,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      borderBottom: '1px solid #e0e0e0',
                      bgcolor: 'transparent',
                      '&:hover': {
                        bgcolor: '#f8f9fa',
                      },
                    }}
                    onClick={() => !isLastDivider && toggleDivider(index)}
                  >
                    {!isLastDivider && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDivider(index);
                        }}
                        sx={{
                          p: 0.5,
                          color: hasErrorsBetweenDividers(index) ? '#dc3545' : '#666666',
                          '&:hover': {
                            color: '#333333',
                            bgcolor: 'transparent',
                          },
                        }}
                      >
                        {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </IconButton>
                    )}
                    <Box
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        opacity: firstLine ? (isCollapsed ? 0.7 : 1) : 0.7,
                      }}
                    >
                      {firstLine ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: hasErrorsBetweenDividers(index) ? '#dc3545' : (isCollapsed ? '#666666' : '#333333'),
                            fontWeight: 400,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            py: 0.5,
                          }}
                        >
                          {firstLine}
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            flex: 1,
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                );
              }

              // Skip rendering if the log should be hidden
              if (!shouldShowLog(index)) return null;

              // Add border only to the last log in an expanded block
              const isLastLogInBlock = () => {
                // If there's a stop divider before this log, don't show any borders
                const hasStopDividerBefore = executionState.logs
                  .slice(0, index)
                  .some(log => typeof log === 'object' && log.type === 'stop_divider');
                
                if (hasStopDividerBefore) {
                  return false;
                }

                const nextDividerIndex = getNextDividerIndex(index);
                // Find the last visible log before the next divider
                const lastVisibleLogIndex = executionState.logs
                  .slice(index + 1, nextDividerIndex)
                  .map((log, i) => {
                    const currentIndex = index + 1 + i;
                    const lastDividerBeforeLog = executionState.logs
                      .slice(0, currentIndex)
                      .map((l, j) => typeof l === 'object' && l.type === 'divider' ? j : -1)
                      .filter(j => j !== -1)
                      .pop();
                    
                    if (lastDividerBeforeLog === undefined) return currentIndex;
                    
                    const dividerState = dividerStates.find(state => state.index === lastDividerBeforeLog);
                    const isOnlyElement = getElementsBetweenDividers(lastDividerBeforeLog) <= 1;
                    
                    return (!dividerState?.isCollapsed || isOnlyElement) ? currentIndex : -1;
                  })
                  .filter(i => i !== -1)
                  .pop() ?? index;

                return index === lastVisibleLogIndex;
              };

              const showBottomBorder = isLastLogInBlock() && executionState.logs
                .slice(0, index)
                .map((log, i) => typeof log === 'object' && log.type === 'divider' ? i : -1)
                .filter(i => i !== -1)
                .some(i => {
                  const dividerState = dividerStates.find(state => state.index === i);
                  return !dividerState?.isCollapsed;
                });

              // Wrap the log in a Box with bottom border if needed
              const LogWrapper = ({ children }: { children: React.ReactNode }) => {
                // Check if there's a stop divider before this log
                const hasStopDividerBefore = executionState.logs
                  .slice(0, index)
                  .some(log => typeof log === 'object' && log.type === 'stop_divider');

                // Don't show any borders or indentation if there's a stop divider before this log
                if (hasStopDividerBefore) {
                  return (
                    <Box>
                      {children}
                    </Box>
                  );
                }

                // Otherwise, show border based on the original logic
                return showBottomBorder ? (
                  <Box sx={{ 
                    borderBottom: '1px solid #e0e0e0', 
                    pb: 1.5,
                    pl: isInsideDivider(index) ? 6 : 0
                  }}>
                    {children}
                  </Box>
                ) : (
                  <Box sx={{ pl: isInsideDivider(index) ? 6 : 0 }}>
                    {children}
                  </Box>
                );
              };

              if (typeof log === 'string') {
                const isError = log.includes('[FLOW_ERROR]');
                if (isError) {
                  // Parse the error message and JSON object
                  const errorMatch = log.match(/\[FLOW_ERROR\](.*?)(\{[\s\S]*\})$/);
                  if (errorMatch) {
                    const [, description, jsonStr] = errorMatch;
                    try {
                      const details = JSON.parse(jsonStr);
                      // Remove colon from description if it exists
                      const cleanDescription = description.trim().replace(/:$/, '');
                      return (
                        <LogWrapper>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              mb: 0.5,
                              '&:hover': {
                                bgcolor: '#f8f9fa',
                              },
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                lineHeight: 1.5,
                                fontSize: '0.875rem',
                                color: '#dc3545',
                                flex: 1
                              }}
                            >
                              {cleanDescription}
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => setErrorDialog({ description: cleanDescription, details })}
                              sx={{
                                textTransform: 'none',
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                borderColor: '#dc3545',
                                color: '#dc3545',
                                minWidth: 'auto',
                                px: 1,
                                py: 0.25,
                                '&:hover': {
                                  borderColor: '#bb2d3b',
                                  color: '#bb2d3b',
                                  bgcolor: 'rgba(220, 53, 69, 0.05)',
                                },
                              }}
                            >
                              View Details
                            </Button>
                          </Box>
                        </LogWrapper>
                      );
                    } catch (e) {
                      // If JSON parsing fails, display as regular error
                      return (
                        <LogWrapper>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              lineHeight: 1.5,
                              fontSize: '0.875rem',
                              color: '#dc3545',
                              '&:hover': {
                                bgcolor: '#f8f9fa',
                              },
                            }}
                          >
                            {log.replace('[FLOW_ERROR]', '').trim().replace(/:$/, '')}
                          </Typography>
                        </LogWrapper>
                      );
                    }
                  }
                }
                
                // Regular log message
                return (
                  <LogWrapper>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                        fontSize: '0.875rem',
                        color: '#333333',
                        '&:hover': {
                          bgcolor: '#f8f9fa',
                        },
                      }}
                    >
                      {log}
                    </Typography>
                  </LogWrapper>
                );
              } else if (log.type === 'transform' || log.type === 'input' || log.type === 'import' || log.type === 'comparison_in_log' || log.type === 'export') {
                // Skip if this is a comparison_in_log or export and we've already shown one for this node
                if (log.type === 'comparison_in_log' || log.type === 'export') {
                  const previousLogs = executionState.logs.slice(0, index);
                  const hasPreviousLog = previousLogs.some(
                    prevLog => typeof prevLog === 'object' && 
                    prevLog.type === log.type && 
                    prevLog.nodeId === log.nodeId
                  );
                  if (hasPreviousLog) {
                    return null;
                  }
                }

                const getButtonLabel = () => {
                  switch (log.type) {
                    case 'import':
                      return 'View import data';
                    case 'input':
                      return 'Selection process';
                    case 'transform':
                      return 'Inspect data';
                    case 'comparison_in_log':
                      return `View comparison details (${log.list1Size}/${log.list2Size} items)`;
                    case 'export':
                      return `View export details (${log.outputFilename})`;
                    default:
                      return 'View data';
                  }
                };

                return (
                  <LogWrapper>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        my: 0.5,
                        '&:hover': {
                          bgcolor: '#f8f9fa',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: '#666666',
                          visibility: isInsideDivider(index) ? 'hidden' : 'visible'  // Hide the arrow if indented
                        }}
                      >
                        ↳
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setInspectionDialog(log as LogData)}
                        sx={{
                          textTransform: 'none',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          borderColor: '#e0e0e0',
                          color: '#333333',
                          '&:hover': {
                            borderColor: '#10a37f',
                            color: '#10a37f',
                          },
                        }}
                      >
                        {getButtonLabel()}
                      </Button>
                    </Box>
                  </LogWrapper>
                );
              }
              return null;
            })}

            {/* Spinner at the end when flow is running */}
            {executionState.status === 'running' && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 2,
                  pl: isInsideDivider(executionState.logs.length) ? 6 : 0,
                  opacity: 0.7,
                }}
              >
                <CircularProgress
                  size={16}
                  thickness={4}
                  sx={{
                    color: '#10a37f',
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#666666',
                  }}
                >
                  Processing...
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Inspection Dialog */}
      {inspectionDialog && (
        <InspectionDialog
          log={inspectionDialog}
          onClose={() => setInspectionDialog(null)}
        />
      )}

      {/* Error Dialog */}
      {errorDialog && (
        <ErrorDialog
          error={errorDialog}
          onClose={() => setErrorDialog(null)}
        />
      )}
    </Box>
  );
};

export default FlowExecutionWindow; 