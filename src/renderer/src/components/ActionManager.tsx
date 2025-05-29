import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import { Action, ActionType } from '../types/Project';
import ActionEditor from './ActionEditor';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface ActionManagerProps {
  actions: Action[];
  onSaveAction: (action: Action) => void;
  onDeleteAction: (actionId: string) => void;
  onDragStart?: (event: React.DragEvent, action: Action) => void;
  onDragEnd?: () => void;
}

const ActionManager: React.FC<ActionManagerProps> = ({
  actions,
  onSaveAction,
  onDeleteAction,
  onDragStart,
  onDragEnd,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | undefined>();
  const [isDragging, setIsDragging] = useState(false);

  const handleEdit = (action: Action) => {
    setSelectedAction(action);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedAction(undefined);
    setIsEditorOpen(true);
  };

  const handleSave = (action: Action) => {
    onSaveAction(action);
    setIsEditorOpen(false);
  };

  const getTypeColor = (type: ActionType, isBuiltIn: boolean) => {
    if (isBuiltIn) return '#666666';
    switch (type) {
      case 'input':
        return '#10a37f';
      case 'output':
        return '#dc3545';
      case 'transform':
        return '#ffc107';
      case 'comparison':
        return '#673ab7';
      default:
        return '#666';
    }
  };

  const handleDragStart = (event: React.DragEvent, action: Action) => {
    setIsDragging(true);
    if (onDragStart) {
      onDragStart(event, action);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Actions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Action
        </Button>
      </Box>
      <Paper elevation={2}>
        <List>
          {actions.map((action) => (
            <ListItem
              key={action.id}
              draggable
              onDragStart={(e) => handleDragStart(e, action)}
              onDragEnd={handleDragEnd}
              sx={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                '&:last-child': {
                  borderBottom: 'none',
                },
                cursor: 'grab',
                '&:active': {
                  cursor: 'grabbing',
                },
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                },
                opacity: isDragging ? 0.5 : 1,
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: action.isBuiltIn ? '#666666' : action.color,
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {action.type.charAt(0).toUpperCase()}
              </Box>
              <ListItemText
                primary={action.name}
                secondary={
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Chip
                      label={action.type}
                      size="small"
                      sx={{
                        backgroundColor: getTypeColor(action.type, action.isBuiltIn || false),
                        color: 'white',
                      }}
                    />
                    {action.isBuiltIn && (
                      <Chip
                        label="Built-in"
                        size="small"
                        sx={{
                          backgroundColor: '#666666',
                          color: 'white',
                        }}
                      />
                    )}
                  </Stack>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="edit"
                  onClick={() => handleEdit(action)}
                  sx={{ mr: 1 }}
                >
                  <EditIcon />
                </IconButton>
                {!action.isBuiltIn && (
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => onDeleteAction(action.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
      {isEditorOpen && (
        <ActionEditor
          action={selectedAction}
          onSave={handleSave}
          onClose={() => setIsEditorOpen(false)}
          onDelete={onDeleteAction}
        />
      )}
    </Box>
  );
};

export default ActionManager; 