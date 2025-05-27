import React from 'react';
import { Box, TextField } from '@mui/material';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  return (
    <Box display="flex" alignItems="center" gap={2}>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '50px',
          height: '50px',
          padding: 0,
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      />
      <TextField
        value={color}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        sx={{ width: '120px' }}
      />
    </Box>
  );
};

export default ColorPicker; 