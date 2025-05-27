import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material';
import { Action, ActionConfig } from '../types/Project';

interface ActionConfigPanelProps {
  action: Action;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

const ActionConfigPanel: React.FC<ActionConfigPanelProps> = ({
  action,
  config,
  onChange,
}) => {
  const [values, setValues] = useState<Record<string, any>>(config);

  useEffect(() => {
    // Initialize with default values
    const initialValues = { ...config };
    action.config.forEach((cfg) => {
      if (cfg.defaultValue !== undefined && initialValues[cfg.label] === undefined) {
        initialValues[cfg.label] = cfg.defaultValue;
      }
    });
    setValues(initialValues);
  }, [action, config]);

  const handleChange = (label: string, value: any) => {
    // Convert label to lowercase and replace spaces with underscores
    const parsedLabel = label.toLowerCase().replace(/\s+/g, '_');
    const newValues = { ...values, [parsedLabel]: value };
    setValues(newValues);
    onChange(newValues);
  };

  const renderConfigField = (cfg: ActionConfig) => {
    // Convert label to lowercase and replace spaces with underscores
    const parsedLabel = cfg.label.toLowerCase().replace(/\s+/g, '_');
    switch (cfg.type) {
      case 'text':
        return (
          <TextField
            label={cfg.label}
            value={values[parsedLabel] || ''}
            onChange={(e) => handleChange(cfg.label, e.target.value)}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
          />
        );
      case 'number':
        return (
          <TextField
            label={cfg.label}
            type="number"
            value={values[parsedLabel] || ''}
            onChange={(e) => handleChange(cfg.label, Number(e.target.value))}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
          />
        );
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={values[parsedLabel] || false}
                onChange={(e) => handleChange(cfg.label, e.target.checked)}
              />
            }
            label={cfg.label}
          />
        );
      case 'select':
        return (
          <FormControl fullWidth required={cfg.required}>
            <InputLabel>{cfg.label}</InputLabel>
            <Select
              value={values[parsedLabel] || ''}
              label={cfg.label}
              onChange={(e) => handleChange(cfg.label, e.target.value)}
            >
              {cfg.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'json':
        return (
          <TextField
            label={cfg.label}
            value={values[parsedLabel] || ''}
            onChange={(e) => {
              try {
                const jsonValue = JSON.parse(e.target.value);
                handleChange(cfg.label, jsonValue);
              } catch {
                // If JSON is invalid, store as string
                handleChange(cfg.label, e.target.value);
              }
            }}
            multiline
            rows={4}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
            error={values[parsedLabel] && typeof values[parsedLabel] === 'string'}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {action.name} Configuration
      </Typography>
      <Stack spacing={2}>
        {action.config.map((cfg) => (
          <Box key={cfg.label}>
            {renderConfigField(cfg)}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default ActionConfigPanel; 