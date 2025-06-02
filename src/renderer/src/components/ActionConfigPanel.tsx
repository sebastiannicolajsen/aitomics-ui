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
  Divider,
  Paper,
} from '@mui/material';
import { Action, ActionConfig } from '../types/Project';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import debounce from 'lodash/debounce';
import MarkdownEditor from './MarkdownEditor';

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
            borderRadius: 1,
            transition: 'none',
            '&:hover': {
              '& > fieldset': {
                borderColor: 'rgba(0, 0, 0, 0.23)',
              },
            },
          },
        }}
      />
      <IconButton
        size="small"
        onClick={onDelete}
        color="error"
        sx={{ 
          flexShrink: 0,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'rgba(220, 53, 69, 0.08)',
          },
        }}
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  ), [handleFinalChange]);

  const commonTextFieldStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1,
      transition: 'none',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'transparent',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'transparent',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#673ab7',
      },
    },
  };

  const commonSelectStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1,
      transition: 'none',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'transparent',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'transparent',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#673ab7',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'text.secondary',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#673ab7',
    },
    '& .MuiSelect-icon': {
      color: 'text.secondary',
    },
  };

  const renderConfigField = useCallback((cfg: ActionConfig) => {
    switch (cfg.type) {
      case 'text':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <TextField
                value={localValues[cfg.label] || ''}
                onChange={(e) => handleLocalChange(cfg.label, e.target.value)}
                onBlur={(e) => handleFinalChange(cfg.label, e.target.value)}
                fullWidth
                size="small"
                placeholder={cfg.description}
                sx={commonTextFieldStyles}
              />
            </Paper>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      case 'markdown':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <MarkdownEditor
                label={cfg.label}
                value={localValues[cfg.label] || ''}
                onChange={(value) => {
                  handleLocalChange(cfg.label, value);
                  handleFinalChange(cfg.label, value);
                }}
                required={cfg.required}
              />
            </Paper>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      case 'number':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <TextField
                type="number"
                value={localValues[cfg.label] || ''}
                onChange={(e) => handleLocalChange(cfg.label, Number(e.target.value))}
                onBlur={(e) => handleFinalChange(cfg.label, Number(e.target.value))}
                fullWidth
                size="small"
                placeholder={cfg.description}
                sx={commonTextFieldStyles}
              />
            </Paper>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      case 'boolean':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={localValues[cfg.label] || false}
                    onChange={(e) => handleFinalChange(cfg.label, e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase': {
                        '&.Mui-checked': {
                          color: '#673ab7',
                          '& + .MuiSwitch-track': {
                            backgroundColor: '#673ab7',
                            opacity: 0.5,
                          },
                        },
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      },
                    }}
                  />
                }
                label={cfg.description}
                sx={{
                  '& .MuiFormControlLabel-label': {
                    color: 'text.secondary',
                  },
                }}
              />
            </Paper>
          </Box>
        );
      case 'select':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <FormControl fullWidth size="small">
                <Select
                  value={localValues[cfg.label] || ''}
                  onChange={(e) => handleFinalChange(cfg.label, e.target.value)}
                  displayEmpty
                  sx={commonSelectStyles}
                >
                  <MenuItem value="" disabled>
                    <em>Select an option</em>
                  </MenuItem>
                  {cfg.options?.map((option) => (
                    <MenuItem 
                      key={option} 
                      value={option}
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(103, 58, 183, 0.08)',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(103, 58, 183, 0.12)',
                          '&:hover': {
                            backgroundColor: 'rgba(103, 58, 183, 0.16)',
                          },
                        },
                      }}
                    >
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      case 'json':
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <TextField
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
                size="small"
                placeholder={cfg.description}
                error={localValues[cfg.label] && typeof localValues[cfg.label] === 'string'}
                sx={commonTextFieldStyles}
              />
            </Paper>
            {cfg.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {cfg.description}
              </Typography>
            )}
          </Box>
        );
      case 'list':
        const listValue = Array.isArray(localValues[cfg.label]) ? localValues[cfg.label] : [];
        return (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {cfg.label}
            </Typography>
            <Stack spacing={1}>
              {listValue.map((item: string, index: number) => (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box display="flex" gap={1}>
                    <TextField
                      value={item}
                      onChange={(e) => {
                        const newList = [...listValue];
                        newList[index] = e.target.value;
                        handleLocalChange(cfg.label, newList);
                      }}
                      onBlur={(e) => {
                        const newList = [...listValue];
                        newList[index] = e.target.value;
                        handleFinalChange(cfg.label, newList);
                      }}
                      fullWidth
                      size="small"
                      sx={commonTextFieldStyles}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newList = listValue.filter((_: string, i: number) => i !== index);
                        handleFinalChange(cfg.label, newList);
                      }}
                      color="error"
                      sx={{ 
                        flexShrink: 0,
                        borderRadius: 1,
                        '&:hover': {
                          backgroundColor: 'rgba(220, 53, 69, 0.08)',
                        },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  handleFinalChange(cfg.label, [...listValue, '']);
                }}
                size="small"
                sx={{ 
                  alignSelf: 'flex-start',
                  color: '#673ab7',
                  '&:hover': {
                    backgroundColor: 'rgba(103, 58, 183, 0.08)',
                  },
                }}
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
      {action.config.length > 0 && (
        <>
          <Box sx={{ mb: 2 }}>
            <Divider />
          </Box>
          <Stack spacing={2}>
            {action.config.map((cfg) => (
              <Box key={cfg.label}>
                {renderConfigField(cfg)}
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default ActionConfigPanel; 