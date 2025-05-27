import React from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Box, Typography } from '@mui/material';

interface DataBlockProps {
  data: {
    content: string;
    onUpdate: (content: string) => void;
  };
}

const DataBlock: React.FC<DataBlockProps> = ({ data }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 1,
        minWidth: 300,
        minHeight: 150,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Data Block
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.content || 'No data loaded'}
        </Typography>
      </Box>
      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default DataBlock; 