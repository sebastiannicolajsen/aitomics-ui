import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  IconButton,
} from '@mui/material';
import { Action, ActionConfig } from '../types/Project';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import debounce from 'lodash/debounce';

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
  // Keep local state for immediate updates
  const [localValues, setLocalValues] = useState<Record<string, any>>(config);
  // Keep a ref of the current values to avoid stale closures
  const valuesRef = useRef(localValues);
  valuesRef.current = localValues;

  // Initialize with default values
  useEffect(() => {
    const initialValues = { ...config };
    action.config.forEach((cfg) => {
      if (cfg.defaultValue !== undefined && initialValues[cfg.label] === undefined) {
        initialValues[cfg.label] = cfg.defaultValue;
      }
    });
    setLocalValues(initialValues);
  }, [action, config]);

  // Debounce the onChange callback to reduce rapid updates
  const debouncedOnChange = useCallback(
    debounce((newValues: Record<string, any>) => {
      onChange(newValues);
    }, 500),
    [onChange]
  );

  // Handle immediate local updates
  const handleLocalChange = useCallback((label: string, value: any) => {
    const newValues = { ...valuesRef.current, [label]: value };
    setLocalValues(newValues);
  }, []);

  // Handle final updates (on blur or after debounce)
  const handleFinalChange = useCallback((label: string, value: any) => {
    const newValues = { ...valuesRef.current, [label]: value };
    setLocalValues(newValues);
    debouncedOnChange(newValues);
  }, [debouncedOnChange]);

  // Memoize the list item component to prevent unnecessary re-renders
  const ListItem = useCallback(({ item, index, onUpdate, onDelete }: { 
    item: string; 
    index: number; 
    onUpdate: (value: string) => void;
    onDelete: () => void;
  }) => (
    <Box key={index} display="flex" gap={1} sx={{ mb: 1 }}>
      <TextField
        value={item}
        onChange={(e) => onUpdate(e.target.value)}
        onBlur={(e) => handleFinalChange('list', e.target.value)}
        fullWidth
        size="small"
        sx={{ 
          '& .MuiOutlinedInput-root': {
            transition: 'none',
          }
        }}
      />
      <IconButton
        size="small"
        onClick={onDelete}
        color="error"
        sx={{ flexShrink: 0 }}
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  ), [handleFinalChange]);

  const renderConfigField = useCallback((cfg: ActionConfig) => {
    switch (cfg.type) {
      case 'text':
        return (
          <TextField
            label={cfg.label}
            value={localValues[cfg.label] || ''}
            onChange={(e) => handleLocalChange(cfg.label, e.target.value)}
            onBlur={(e) => handleFinalChange(cfg.label, e.target.value)}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                transition: 'none',
              }
            }}
          />
        );
      case 'number':
        return (
          <TextField
            label={cfg.label}
            type="number"
            value={localValues[cfg.label] || ''}
            onChange={(e) => handleLocalChange(cfg.label, Number(e.target.value))}
            onBlur={(e) => handleFinalChange(cfg.label, Number(e.target.value))}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                transition: 'none',
              }
            }}
          />
        );
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={localValues[cfg.label] || false}
                onChange={(e) => handleFinalChange(cfg.label, e.target.checked)}
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
              value={localValues[cfg.label] || ''}
              label={cfg.label}
              onChange={(e) => handleFinalChange(cfg.label, e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  transition: 'none',
                }
              }}
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
            value={typeof localValues[cfg.label] === 'object' ? JSON.stringify(localValues[cfg.label], null, 2) : localValues[cfg.label] || ''}
            onChange={(e) => handleLocalChange(cfg.label, e.target.value)}
            onBlur={(e) => {
              try {
                const jsonValue = JSON.parse(e.target.value);
                handleFinalChange(cfg.label, jsonValue);
              } catch {
                // If JSON is invalid, store as string
                handleFinalChange(cfg.label, e.target.value);
              }
            }}
            multiline
            rows={4}
            fullWidth
            required={cfg.required}
            helperText={cfg.description}
            error={localValues[cfg.label] && typeof localValues[cfg.label] === 'string'}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                transition: 'none',
              }
            }}
          />
        );
      case 'list':
        const listValue = Array.isArray(localValues[cfg.label]) ? localValues[cfg.label] : [];
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {cfg.label}
              {cfg.required && <span style={{ color: 'error.main' }}> *</span>}
            </Typography>
            <Stack spacing={1}>
              {listValue.map((item: string, index: number) => (
                <ListItem
                  key={index}
                  item={item}
                  index={index}
                  onUpdate={(value) => {
                    const newList = [...listValue];
                    newList[index] = value;
                    handleLocalChange(cfg.label, newList);
                  }}
                  onDelete={() => {
                    const newList = listValue.filter((_: string, i: number) => i !== index);
                    handleFinalChange(cfg.label, newList);
                  }}
                />
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  handleFinalChange(cfg.label, [...listValue, '']);
                }}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Item
              </Button>
            </Stack>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  }, [localValues, handleLocalChange, handleFinalChange]);

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