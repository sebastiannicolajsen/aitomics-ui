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
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
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

interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  logs: string[];
  error?: string;
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

const FlowExecutionWindow: React.FC<FlowExecutionWindowProps> = ({ project, onClose, llmConfig, generatedCode }) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    currentStep: '',
    progress: 0,
    logs: [],
  });
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const seenMessagesRef = useRef<Set<string>>(new Set());

  const [executionGraph, setExecutionGraph] = useState<{
    nodes: Map<string, Block>;
    edges: Map<string, Set<string>>;
    inputNodes: Set<string>;
    outputNodes: Set<string>;
  } | null>(null);

  // Add a ref to track if flow has been executed
  const hasExecuted = useRef(false);

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

  // Add log listener when component mounts
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

        // Ensure log is a string and not empty
        if (typeof log !== 'string' || !log.trim()) {
          return;
        }

        // Create a unique key for the message (without timestamp)
        const messageKey = log.trim();
        
        // Skip if we've seen this exact message before
        if (seenMessagesRef.current.has(messageKey)) {
          return;
        }
        
        // Add to seen messages
        seenMessagesRef.current.add(messageKey);

        // Add the log message with timestamp
        const timestamp = new Date().toLocaleTimeString();
        const logWithTimestamp = `[${timestamp}] ${log}`;
        
        setExecutionState(prev => ({
          ...prev,
          logs: [...prev.logs, logWithTimestamp],
          lastUpdate: Date.now()
        }));
      } catch (error) {
        // Silently handle errors
      }
    };

    // Set up the IPC listener
    window.electron.ipcRenderer.on('flow-log', handleLog);

    // Return cleanup function
    return () => {
      try {
        window.electron?.ipcRenderer.removeListener('flow-log', handleLog);
        // Clear seen messages when component unmounts
        seenMessagesRef.current.clear();
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

    setExecutionState(prev => ({ ...prev, status: 'running' }));

    try {
      await window.electron.ipcRenderer.invoke('execute-flow', generatedCode);
      setExecutionState(prev => ({ ...prev, status: 'completed', progress: 100 }));
    } catch (error) {
      setExecutionState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [generatedCode]);

  const handlePause = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      status: prev.status === 'running' ? 'paused' : 'running',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Execution ${prev.status === 'running' ? 'paused' : 'resumed'}`]
    }));
  }, []);

  const handleStop = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      status: 'idle',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Execution stopped`]
    }));
  }, []);

  const handleSave = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Saving intermediate results...`]
    }));
    // TODO: Implement saving intermediate results
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
      {/* Header with Progress - Fixed position */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ color: '#333333' }}>
            Flow Execution: {project.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress
              variant="determinate"
              value={executionState.progress}
              size={20}
              sx={{ color: '#10a37f' }}
            />
            <Typography variant="body2" sx={{ color: '#333333' }}>
              {executionState.progress}%
            </Typography>
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
          <Button
            variant="contained"
            startIcon={executionState.status === 'running' ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={executionState.status === 'idle' ? executeFlow : handlePause}
            disabled={executionState.status === 'completed'}
            sx={{
              bgcolor: '#10a37f',
              '&:hover': { bgcolor: '#0d8c6d' },
              '&.Mui-disabled': {
                bgcolor: 'rgba(16, 163, 127, 0.5)',
              },
              boxShadow: '0 2px 4px rgba(16, 163, 127, 0.2)',
              borderRadius: '8px',
            }}
          >
            {executionState.status === 'running' ? 'Pause' : 'Run'}
          </Button>
          <Button
            variant="contained"
            startIcon={<StopIcon />}
            onClick={handleStop}
            disabled={executionState.status === 'idle' || executionState.status === 'completed'}
            sx={{
              bgcolor: '#dc3545',
              '&:hover': { bgcolor: '#bb2d3b' },
              '&.Mui-disabled': {
                bgcolor: 'rgba(220, 53, 69, 0.5)',
              },
              boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
              borderRadius: '8px',
            }}
          >
            Stop
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={executionState.status === 'idle'}
            sx={{
              bgcolor: '#673ab7',
              '&:hover': { bgcolor: '#5e35b1' },
              '&.Mui-disabled': {
                bgcolor: 'rgba(103, 58, 183, 0.5)',
              },
              boxShadow: '0 2px 4px rgba(103, 58, 183, 0.2)',
              borderRadius: '8px',
            }}
          >
            Save Results
          </Button>
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
            {executionState.logs.map((log, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                  fontSize: '0.875rem',
                  color: log.includes('Error') ? '#dc3545' : '#333333',
                  '&:hover': {
                    bgcolor: '#f8f9fa',
                  },
                }}
              >
                {log}
              </Typography>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default FlowExecutionWindow; 