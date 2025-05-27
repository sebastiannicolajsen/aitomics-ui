import React from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Box } from '@mui/material';
import Editor from '@monaco-editor/react';

interface CodeBlockProps {
  data: {
    content: string;
    onUpdate: (content: string) => void;
  };
}

const CodeBlock: React.FC<CodeBlockProps> = ({ data }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 1,
        minWidth: 300,
        minHeight: 200,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Box sx={{ height: 200 }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          value={data.content}
          onChange={(value) => data.onUpdate(value || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
          }}
        />
      </Box>
      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default CodeBlock; 