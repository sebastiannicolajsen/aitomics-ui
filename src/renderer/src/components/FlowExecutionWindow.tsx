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
  type: 'transform' | 'input' | 'import' | 'item_update' | 'additional_file' | 'comparison_in_log' | 'export';
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
  outputPath?: string;  // Add for export type
  outputFilename?: string;  // Add for export type
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

// Update SegmentedProgressBar component to show errors
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
                bgcolor: flow.hasError ? '#dc3545' : flow.completed ? '#10a37f' : '#e0e0e0',
                transition: 'background-color 0.3s ease',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: flow.hasError ? 'none' : flow.completed ? 'none' : 
                    `linear-gradient(90deg, ${flow.hasError ? '#dc3545' : '#10a37f'} ${flow.progress}%, transparent ${flow.progress}%)`,
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

      {/* Flow labels */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        mt: 0.5,
        px: 0.5
      }}>
        {flows.map((flow) => (
          <Tooltip 
            key={flow.name} 
            title={`${flow.name}: ${flow.progress}%${flow.hasError ? ' (error)' : flow.completed ? ' (completed)' : ''}`}
            placement="top"
          >
            <Typography
              variant="caption"
              sx={{
                color: flow.hasError ? '#dc3545' : flow.completed ? '#10a37f' : '#666666',
                fontWeight: flow.hasError || flow.completed ? 500 : 400,
                fontSize: '0.75rem',
                maxWidth: `${100 / flows.length}%`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                transition: 'color 0.3s ease',
                px: 0.5
              }}
            >
              {flow.name}
            </Typography>
          </Tooltip>
        ))}
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
  const [showDebugLogs, setShowDebugLogs] = useState(false);
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
    if (executionGraph && generatedCode && !hasExecuted.current) {
      hasExecuted.current = true;
      executeFlow();
    }
  }, [executionGraph, generatedCode]);

  // Update the log listener to handle errors in flow progress
  useEffect(() => {
    if (!window.electron?.ipcRenderer) {
      return;
    }

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

        // Handle UI logs
        if (log.includes('[FLOW_UI_LOG]')) {
          try {
            const logData = JSON.parse(log.replace('[FLOW_UI_LOG]', '').trim()) as LogData;
            
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

            // Handle item_update logs to update flow progress
            if (logData.type === 'item_update') {
              const progress = Math.round((logData.current! / logData.total!) * 100);
              setExecutionState(prev => {
                const flowProgress = [...prev.flowProgress];
                const flowIndex = flowProgress.findIndex(f => f.name === logData.nodeName);
                
                if (flowIndex !== -1) {
                  // Update existing flow progress
                  flowProgress[flowIndex] = {
                    ...flowProgress[flowIndex],
                    progress: progress,
                    completed: progress === 100
                  };
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

            // Handle errors in flow progress
            if (log.includes('[FLOW_ERROR]')) {
              const errorMatch = log.match(/\[FLOW_ERROR\](.*?)(\{[\s\S]*\})$/);
              if (errorMatch) {
                const [, description, jsonStr] = errorMatch;
                try {
                  const details = JSON.parse(jsonStr);
                  // Try to find the node name from various possible locations in the error details
                  let nodeName: string | undefined;
                  
                  // Check different possible locations for the node identifier
                  if (details.nodeId) {
                    nodeName = details.nodeId;
                  } else if (details.nodeName) {
                    nodeName = details.nodeName;
                  } else if (details.name) {
                    nodeName = details.name;
                  } else if (details.block) {
                    nodeName = details.block.name || details.block.id;
                  } else if (details.node) {
                    nodeName = details.node.name || details.node.id;
                  }

                  // If we found a node name, update the flow progress
                  if (nodeName) {
                    setExecutionState(prev => {
                      const flowProgress = [...prev.flowProgress];
                      const flowIndex = flowProgress.findIndex(f => f.name === nodeName);
                      if (flowIndex !== -1) {
                        flowProgress[flowIndex] = {
                          ...flowProgress[flowIndex],
                          hasError: true,
                          completed: true  // Mark as completed since it errored
                        };
                      }
                      return {
                        ...prev,
                        flowProgress
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
                          completed: true  // Mark as completed since it errored
                        };
                      }
                      return {
                        ...prev,
                        flowProgress
                      };
                    });
                  }
                }
              }
            }
          } catch (e) {
            // If parsing fails, treat as regular log
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

    window.electron.ipcRenderer.on('flow-log', handleLog);

    return () => {
      try {
        window.electron?.ipcRenderer.removeListener('flow-log', handleLog);
        seenMessagesRef.current.clear();
        processedImportsRef.current.clear();
        completedImportsRef.current.clear();
      } catch (error) {
        // Silently handle cleanup errors
      }
    };
  }, [showDebugLogs]);

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
    if (!generatedCode || !window.electron) return;

    setExecutionState(prev => ({ 
      ...prev, 
      status: 'running',
      currentStep: 'Starting flow execution...'
    }));

    try {
      await window.electron.ipcRenderer.invoke('execute-flow', generatedCode);
      setExecutionState(prev => ({ 
        ...prev, 
        status: 'completed', 
        progress: 100,
        currentStep: 'Flow execution completed'
      }));
    } catch (error) {
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
      // Send message to main process to terminate the child process
      await window.electron?.ipcRenderer.invoke('terminate-flow');
    } catch (error) {
      console.error('Failed to terminate flow:', error);
      setExecutionState(prev => ({
        ...prev,
        status: 'error',
        currentStep: 'Failed to terminate flow',
        error: error instanceof Error ? error.message : String(error)
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
                  color: executionState.latestComparison.result === 'match' ? '#10a37f' : '#dc3545',
                  fontWeight: 500,
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
            <Button
              variant="contained"
              startIcon={<StopIcon />}
              onClick={handleStop}
              sx={{
                bgcolor: '#dc3545',
                '&:hover': { bgcolor: '#bb2d3b' },
                boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
                borderRadius: '8px',
              }}
            >
              Stop
            </Button>
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
                        <Box
                          key={index}
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
                      );
                    } catch (e) {
                      // If JSON parsing fails, display as regular error
                      return (
                        <Typography
                          key={index}
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
                      );
                    }
                  }
                }
                
                // Regular log message
                return (
                  <Typography
                    key={index}
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
                  <Box
                    key={index}
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
                );
              }
              return null;
            })}
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