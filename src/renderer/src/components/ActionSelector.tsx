import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
} from '@mui/material';
import { Action } from '../types/Project';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import * as Icons from '@mui/icons-material';

interface ActionSelectorProps {
  value?: Action;
  onChange: (action: Action | undefined) => void;
  availableActions: Action[];
  nodeType: 'import' | 'export' | 'transform' | 'comparison';
}

const ActionSelector: React.FC<ActionSelectorProps> = ({
  value,
  onChange,
  availableActions,
  nodeType,
}) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Map node types to action types
  const typeMap: Record<string, string> = {
    'import': 'input',
    'export': 'output',
    'transform': 'transform',
    'comparison': 'comparison'
  };

  const compatibleActions = availableActions.filter(
    action => action.type === typeMap[nodeType]
  );

  const handleSelect = (action: Action) => {
    onChange(action);
    setIsSelectorOpen(false);
  };

  const handleRemove = () => {
    onChange(undefined);
    setIsConfirmOpen(false);
  };

  const renderIcon = (iconName: string) => {
    const cleanIconName = iconName.replace(/Icon$/, '');
    const IconComponent = (Icons as any)[cleanIconName];
    return IconComponent ? <IconComponent sx={{ fontSize: '1.2rem' }} /> : null;
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
        onClick={() => !value && setIsSelectorOpen(true)}
      >
        {value ? (
          <>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(145deg, ${value.color}30 0%, ${value.color}20 100%)`,
                color: value.color,
                border: `1px solid ${value.color}40`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: `linear-gradient(145deg, ${value.color}40 0%, ${value.color}30 100%)`,
                  border: `1px solid ${value.color}60`,
                },
                '& .MuiSvgIcon-root': {
                  fontSize: '1.2rem',
                },
              }}
            >
              {renderIcon(value.icon)}
            </Box>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {value.name}
            </Typography>
            <Tooltip title="Remove action">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmOpen(true);
                }}
                sx={{
                  color: '#666666',
                  '&:hover': {
                    color: '#666666',
                    bgcolor: 'rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <EditIcon sx={{ color: '#666666', fontSize: '1.2rem' }} />
            <Typography variant="body2" color="text.secondary">
              No action set
            </Typography>
          </>
        )}
      </Paper>

      {/* Action Selection Dialog */}
      <Dialog
        open={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #e0e0e0',
          pb: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6">Select Action</Typography>
          <IconButton
            onClick={() => setIsSelectorOpen(false)}
            size="small"
            sx={{
              color: '#666666',
              '&:hover': {
                color: '#10a37f',
                bgcolor: 'rgba(16, 163, 127, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List>
            {compatibleActions.map((action) => (
              <ListItem
                key={action.id}
                button
                onClick={() => handleSelect(action)}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(145deg, ${action.color}30 0%, ${action.color}20 100%)`,
                      color: action.color,
                      border: `1px solid ${action.color}40`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: `linear-gradient(145deg, ${action.color}40 0%, ${action.color}30 100%)`,
                        border: `1px solid ${action.color}60`,
                      },
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.2rem',
                      },
                    }}
                  >
                    {renderIcon(action.icon)}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={action.name}
                  secondary={action.description}
                  secondaryTypographyProps={{
                    sx: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this action? This will clear all configuration settings.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsConfirmOpen(false)}
            sx={{
              color: '#666666',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRemove}
            sx={{
              color: '#666666',
              bgcolor: 'rgba(0, 0, 0, 0.08)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ActionSelector; 