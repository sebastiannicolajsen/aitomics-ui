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
import { Project, Block, BlockType, Action } from '../types/Project';
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

interface NodeData {
  type: 'import' | 'export' | 'transform' | 'comparison';
  name?: string;
  content?: string;
  id: string;
  actionId?: string;
  config?: Record<string, any>;
  onUpdate?: (content: string) => void;
}

interface BlockEditorProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  globalActions: Action[];
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
            stroke: '#10a37f',
            strokeWidth: 1.5,
            opacity: selected ? 1 : 0.7,
            transition: 'opacity 0.2s',
          }}
        />
        {/* Trash can icon centered at (0,0) */}
        <path
          d="M-3 1.5v4M0 1.5v4M3 1.5v4M-4.5-1h9M-2-1V-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"
          stroke="#10a37f"
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
  const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (!isInitialized || !reactFlowInstance.current) return;

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        reactFlowInstance.current?.fitView({ 
          duration: 200, 
          padding: 0.2,
          maxZoom: 1.5 
        });
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isInitialized]);

  return (
    <Box sx={{ flexGrow: 1, position: 'relative' }} ref={reactFlowWrapper}>
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

const BlockEditor: React.FC<BlockEditorProps> = ({ project, onUpdateProject, globalActions }) => {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [nodeName, setNodeName] = useState('');
  const [nodeContent, setNodeContent] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceNode, setSourceNode] = useState<Node | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  const handleConnectionClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    setIsConnecting(true);
    setSourceNode(node);
  }, []);

  const ImportNode = useCallback(({ data }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || InputIcon : InputIcon;
    const color = action ? action.color : '#10a37f';

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
          <InputIcon sx={{ color: '#10a37f' }} />
          <Typography variant="subtitle1" sx={{ color: '#10a37f', fontWeight: 500 }}>
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
        {isConnecting && (
          <IconButton
            className="connection-icon"
            size="small"
            onClick={(e) => handleConnectionClick(e, { id: data.id, type: 'import', data } as Node)}
            sx={{
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#10a37f',
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
  }, [handleConnectionClick, isConnecting, globalActions]);

  const TransformNode = useCallback(({ data }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || TransformIcon : TransformIcon;
    const color = action ? action.color : '#ffc107';

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
            onClick={(e) => handleConnectionClick(e, { id: data.id, type: 'transform', data } as Node)}
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
  }, [handleConnectionClick, isConnecting, globalActions]);

  const ExportNode = useCallback(({ data }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || OutputIcon : OutputIcon;
    const color = action ? action.color : '#dc3545';

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
      </Box>
    );
  }, [globalActions]);

  const ComparisonNode = useCallback(({ data }: NodeProps<NodeData>) => {
    const action = globalActions.find(a => a.id === data.actionId);
    const iconName = action?.icon?.replace(/Icon$/, '');
    const IconComponent = action ? Icons[iconName as keyof typeof Icons] || CompareIcon : CompareIcon;
    const color = action ? action.color : '#673ab7';

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
            onClick={(e) => handleConnectionClick(e, { id: data.id, type: 'comparison', data } as Node)}
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
  }, [handleConnectionClick, isConnecting, globalActions]);

  const nodeTypes = useMemo(() => ({
    import: ImportNode,
    export: ExportNode,
    transform: TransformNode,
    comparison: ComparisonNode,
    code: CodeBlock,
    text: TextBlock,
    data: DataBlock,
  }), [ImportNode, ExportNode, TransformNode, ComparisonNode]);

  const initialNodes: Node[] = project.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    position: block.position,
    data: {
      name: block.name || '',
      content: block.content,
      actionId: block.actionId,
      config: block.config,
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

  // Initialize edges from project
  const initialEdges = (project.edges || []).map((edge) => ({
    ...edge,
    type: 'custom',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    style: { stroke: '#10a37f' },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
      style: { stroke: '#10a37f' },
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
          style: { stroke: '#10a37f' },
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
    
    setSelectedNode(node);
    setNodeName(node.data.name || '');
    setNodeContent(node.data.content || '');
    
    // Find the selected action if the node has an actionId
    if (node.data.actionId) {
      const action = globalActions.find(a => a.id === node.data.actionId);
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
    };

    // Create the new node immediately
    const newNode: Node = {
      id: newBlock.id,
      type: newBlock.type,
      position: newBlock.position,
      data: {
        name: newBlock.name,
        content: newBlock.content,
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

    const updatedBlocks = project.blocks.map((block) =>
      block.id === selectedNode.id
        ? { ...block, name: nodeName, content: nodeContent }
        : block
    );

    onUpdateProject({
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
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

  const handleActionSelect = (action: Action) => {
    if (!selectedNode) return;

    const updatedBlocks = project.blocks.map((block) =>
      block.id === selectedNode.id
        ? { ...block, actionId: action.id, config: {} }
        : block
    );

    onUpdateProject({
      ...project,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    });

    setSelectedAction(action);
  };

  const handleConfigChange = (config: Record<string, any>) => {
    if (!selectedNode) return;

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
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6">{project.name}</Typography>
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
          },
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
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            fullWidth
            placeholder="Enter a description for this node..."
          />
          
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
                onChange={handleConfigChange}
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
    </Box>
  );
};

export default BlockEditor; 