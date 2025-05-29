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
import { Box, Typography, Button, Stack, Drawer, TextField, IconButton, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
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
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
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
        setSelectedAction(null);
        
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
      setSelectedAction(action || null);
    } else {
      setSelectedAction(null);
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
      null;

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
    setIsRunDrawerOpen(false);
    setShowExecutionWindow(true);
    setGeneratedCode(code);
  }, [project, globalActions, executionMode, customCount, llmModel, llmTemperature, llmMaxTokens]);

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

  // Update the drawer content
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
              <Typography variant="h6">
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
              <TextField
                label="Description"
                defaultValue={nodeName}
                onChange={(e) => {
                  // Update local state immediately
                  setNodeName(e.target.value);
                  // Debounce the actual update
                  debouncedUpdateNodeName(e.target.value);
                }}
                fullWidth
                placeholder="Enter a description for this node..."
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    transition: 'none',
                  }
                }}
              />
              
              {selectedNode?.type === 'import' && (
                <Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<UploadIcon />}
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
                      '&:hover': {
                        borderColor: '#10a37f',
                        backgroundColor: 'rgba(16, 163, 127, 0.04)',
                      },
                    }}
                  >
                    {selectedNode.data.file ? 'Change File' : 'Select File'}
                  </Button>
                  {selectedNode.data.file && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Selected file: {selectedNode.data.file.split('/').pop() || selectedNode.data.file}
                    </Typography>
                  )}
                </Box>
              )}
              
              {selectedNode?.type === 'export' && (
                <Box>
                  <Stack spacing={2}>
                    <TextField
                      label="Output Filename"
                      defaultValue={selectedNode.data.outputFilename || ''}
                      onBlur={(e) => {
                        if (selectedNode) {
                          // Update project blocks
                          const updatedBlocks = project.blocks.map((block) =>
                            block.id === selectedNode.id
                              ? { ...block, outputFilename: e.target.value }
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
                                    outputFilename: e.target.value 
                                  } 
                                }
                              : n
                          ));

                          // Update selected node data
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              outputFilename: e.target.value
                            }
                          });
                        }
                      }}
                      fullWidth
                      placeholder="Enter output filename..."
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          transition: 'none',
                        }
                      }}
                    />
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<DownloadIcon />}
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
                        '&:hover': {
                          borderColor: '#dc3545',
                          backgroundColor: 'rgba(220, 53, 69, 0.04)',
                        },
                      }}
                    >
                      {selectedNode.data.outputPath ? 'Change Output Folder' : 'Select Output Folder'}
                    </Button>
                    {selectedNode.data.outputPath && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Output folder: {selectedNode.data.outputPath}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
              
              {selectedAction ? (
                <>
                  <Box sx={{ mb: 2 }}>
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
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
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
                      setSelectedAction(null);
                    }}
                    sx={{ mt: 2 }}
                  >
                    Remove Action
                  </Button>
                </>
              ) : (
                <FormControl fullWidth>
                  <InputLabel>Select Action</InputLabel>
                  <Select
                    value=""
                    label="Select Action"
                    onChange={(e) => {
                      const action = [...globalActions, ...builtInActions].find(a => a.id === e.target.value);
                      if (action) {
                        handleActionSelect(action);
                      }
                    }}
                  >
                    {[...globalActions, ...builtInActions]
                      .filter(action => {
                        // Map node types to action types
                        const typeMap: Record<string, string> = {
                          'import': 'input',
                          'export': 'output',
                          'transform': 'transform',
                          'comparison': 'comparison'
                        };
                        return action.type === typeMap[selectedNode?.type || ''];
                      })
                      .map(action => (
                        <MenuItem key={action.id} value={action.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  background: `linear-gradient(145deg, ${action.color}30 0%, ${action.color}20 100%)`,
                                  color: action.color,
                                }}
                              >
                                {React.createElement(Icons[action.icon.replace(/Icon$/, '') as keyof typeof Icons] || DataObjectIcon, { sx: { fontSize: 16 } })}
                              </Box>
                              <Typography>{action.name}</Typography>
                            </Box>
                            {action.isBuiltIn && (
                              <Chip
                                label="Built-in"
                                size="small"
                                sx={{
                                  backgroundColor: '#666666',
                                  color: 'white',
                                  height: 20,
                                  fontSize: '0.7rem',
                                  '& .MuiChip-label': {
                                    px: 1,
                                  },
                                }}
                              />
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveNode}
                  sx={{
                    flex: 1,
                    background: selectedNode?.type === 'import' 
                      ? 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)'
                      : selectedNode?.type === 'export'
                      ? 'linear-gradient(145deg, #dc3545 0%, #bb2d3b 100%)'
                      : selectedNode?.type === 'comparison'
                      ? 'linear-gradient(145deg, #673ab7 0%, #5e35b1 100%)'
                      : 'linear-gradient(145deg, #ffc107 0%, #e6ac00 100%)',
                    boxShadow: selectedNode?.type === 'import'
                      ? '0 4px 12px rgba(16, 163, 127, 0.2)'
                      : selectedNode?.type === 'export'
                      ? '0 4px 12px rgba(220, 53, 69, 0.2)'
                      : selectedNode?.type === 'comparison'
                      ? '0 4px 12px rgba(103, 58, 183, 0.2)'
                      : '0 4px 12px rgba(255, 193, 7, 0.2)',
                    borderRadius: 2,
                    '&:hover': {
                      background: selectedNode?.type === 'import'
                        ? 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)'
                        : selectedNode?.type === 'export'
                        ? 'linear-gradient(145deg, #bb2d3b 0%, #a52834 100%)'
                        : selectedNode?.type === 'comparison'
                        ? 'linear-gradient(145deg, #5e35b1 0%, #522d99 100%)'
                        : 'linear-gradient(145deg, #e6ac00 0%, #cc9900 100%)',
                      boxShadow: selectedNode?.type === 'import'
                        ? '0 6px 16px rgba(16, 163, 127, 0.25)'
                        : selectedNode?.type === 'export'
                        ? '0 6px 16px rgba(220, 53, 69, 0.25)'
                        : selectedNode?.type === 'comparison'
                        ? '0 6px 16px rgba(103, 58, 183, 0.25)'
                        : '0 6px 16px rgba(255, 193, 7, 0.25)',
                    },
                  }}
                >
                  Save Changes
                </Button>
                <IconButton
                  onClick={handleDeleteNode}
                  sx={{
                    color: '#dc3545',
                    background: 'linear-gradient(145deg, #f7e6e6 0%, #f0d1d1 100%)',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)',
                    border: '1px solid rgba(220, 53, 69, 0.2)',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #f0d1d1 0%, #e6b8b8 100%)',
                      boxShadow: '0 6px 16px rgba(220, 53, 69, 0.15)',
                    },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
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
              {/* Input Files Section */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#10a37f', fontWeight: 500 }}>
                  Input Files
                </Typography>
                {project.blocks
                  .filter(block => block.type === 'import' && block.file)
                  .map(block => (
                    <Box
                      key={block.id}
                      sx={{
                        p: 2,
                        mb: 1,
                        borderRadius: 1,
                        background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                        border: '1px solid rgba(16, 163, 127, 0.2)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <UploadIcon sx={{ color: '#10a37f' }} />
                        <Typography variant="body2" sx={{ color: '#10a37f' }}>
                          {block.file}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                {project.blocks.filter(block => block.type === 'import' && block.file).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No input files selected
                  </Typography>
                )}
              </Box>

              {/* Output Files Section */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#dc3545', fontWeight: 500 }}>
                  Output Files
                </Typography>
                {project.blocks
                  .filter(block => block.type === 'export' && block.outputPath)
                  .map(block => (
                    <Box
                      key={block.id}
                      sx={{
                        p: 2,
                        mb: 1,
                        borderRadius: 1,
                        background: 'linear-gradient(145deg, #f7e6e6 0%, #f0d1d1 100%)',
                        border: '1px solid rgba(220, 53, 69, 0.2)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DownloadIcon sx={{ color: '#dc3545' }} />
                        <Typography variant="body2" sx={{ color: '#dc3545' }}>
                          {block.outputFilename || 'output'} → {block.outputPath}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                {project.blocks.filter(block => block.type === 'export' && block.outputPath).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No output files configured
                  </Typography>
                )}
              </Box>

              {/* Execution Options */}
              <Box>
                <FormLabel component="legend" sx={{ mb: 2, color: 'text.primary', fontWeight: 500 }}>
                  Execution Options
                </FormLabel>
                <RadioGroup
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as 'all' | 'custom')}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label="Process all elements"
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio />}
                    label="Process specific number of elements"
                  />
                </RadioGroup>
                {executionMode === 'custom' && (
                  <TextField
                    type="number"
                    value={customCount}
                    onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1 }}
                    sx={{ mt: 2 }}
                    fullWidth
                    label="Number of elements"
                  />
                )}
              </Box>

              {/* LLM Configuration */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#673ab7', fontWeight: 500 }}>
                  LLM Configuration
                </Typography>
                <TextField
                  fullWidth
                  label="Model Name"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Enter the name of the LLM model to use"
                />
                <TextField
                  fullWidth
                  label="Temperature"
                  type="number"
                  value={llmTemperature}
                  onChange={(e) => setLlmTemperature(Math.max(0, Math.min(2, parseFloat(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 2, step: 0.1 }}
                  sx={{ mb: 2 }}
                  helperText="Controls randomness: 0 = deterministic, 2 = more creative"
                />
                <TextField
                  fullWidth
                  label="Max Tokens"
                  type="number"
                  value={llmMaxTokens}
                  onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || -1)}
                  inputProps={{ min: -1 }}
                  sx={{ mb: 2 }}
                  helperText="Maximum number of tokens to generate (-1 for unlimited)"
                />
              </Box>

              {/* Preview Code Button */}
              <Button
                variant="outlined"
                fullWidth
                startIcon={<CodeIcon />}
                onClick={handlePreviewCode}
                sx={{
                  mt: 2,
                  borderColor: '#10a37f',
                  color: '#10a37f',
                  '&:hover': {
                    borderColor: '#0d8c6d',
                    backgroundColor: 'rgba(16, 163, 127, 0.04)',
                  },
                }}
              >
                Preview Code
              </Button>

              {/* Run Button */}
              <Button
                variant="contained"
                fullWidth
                startIcon={<PlayArrowIcon />}
                onClick={handleRunFlow}
                sx={{
                  mt: 2,
                  background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                    boxShadow: '0 6px 16px rgba(16, 163, 127, 0.25)',
                  },
                }}
              >
                Run Flow
              </Button>
            </Stack>
          </Drawer>
        </>
      )}
    </Box>
  );
};

export default BlockEditor; 