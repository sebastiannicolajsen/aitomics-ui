import React from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, TextField } from '@mui/material';

interface TextBlockProps {
  data: {
    content: string;
    onUpdate: (content: string) => void;
  };
}

const TextBlock: React.FC<TextBlockProps> = ({ data }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 1,
        minWidth: 300,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <TextField
        fullWidth
        multiline
        rows={4}
        value={data.content}
        onChange={(e) => data.onUpdate(e.target.value)}
        variant="outlined"
        placeholder="Enter text..."
      />
      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default TextBlock; 