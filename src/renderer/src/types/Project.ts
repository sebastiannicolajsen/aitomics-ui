import { ReactNode } from 'react';
import { Edge as ReactFlowEdge } from '@reactflow/core';

export type BlockType = 'import' | 'export' | 'transform' | 'comparison';

export type ActionType = 'input' | 'output' | 'transform' | 'comparison';

export interface ActionConfig {
  type: 'text' | 'number' | 'boolean' | 'select' | 'json' | 'list' | 'markdown';
  label: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
  description?: string;
}

export interface Action {
  id: string;
  name: string;
  type: ActionType;
  icon: string;
  color: string;
  code: string;
  config: ActionConfig[];
  isBuiltIn?: boolean;
  description: string;
  wrapInAitomics?: boolean;
}

export interface Block {
  id: string;
  type: BlockType;
  name: string;
  content: string;
  position: { x: number; y: number };
  actionId?: string; // Reference to the action being used
  config?: Record<string, any>; // Configuration values for the action
  file?: string; // Name of the selected file for import nodes
  outputPath?: string; // Output folder path for export nodes
  outputFilename?: string; // Output filename for export nodes
}

export type Edge = ReactFlowEdge;

export interface Project {
  id: string;
  name: string;
  description: string;
  blocks: Block[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
} 