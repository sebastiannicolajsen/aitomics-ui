import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CheckIcon from '@mui/icons-material/Check';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  helperText?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  label,
  required,
  helperText,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCursorPosition = useRef<number>(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Initialize history when dialog opens
  useEffect(() => {
    if (isEditorOpen) {
      setEditValue(value);
      historyRef.current = [value];
      historyIndexRef.current = 0;
    }
  }, [isEditorOpen, value]);

  const addToHistory = (newValue: string) => {
    // Remove any future history if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    
    // Don't add to history if it's the same as the last value
    if (historyRef.current[historyRef.current.length - 1] === newValue) {
      return;
    }
    
    historyRef.current.push(newValue);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const canUndo = () => historyIndexRef.current > 0;
  const canRedo = () => historyIndexRef.current < historyRef.current.length - 1;

  const handleUndo = () => {
    if (canUndo()) {
      historyIndexRef.current--;
      const newValue = historyRef.current[historyIndexRef.current];
      setEditValue(newValue);
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMarkdownStyles(newValue);
      }
    }
  };

  const handleRedo = () => {
    if (canRedo()) {
      historyIndexRef.current++;
      const newValue = historyRef.current[historyIndexRef.current];
      setEditValue(newValue);
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMarkdownStyles(newValue);
      }
    }
  };

  const handleClose = () => {
    // Reset to original value when closing without saving
    setEditValue(value);
    setIsEditorOpen(false);
  };

  const handleSave = () => {
    onChange(editValue);
    setIsEditorOpen(false);
  };

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current!);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      lastCursorPosition.current = preCaretRange.toString().length;
    }
  };

  const restoreCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && editorRef.current) {
      const range = document.createRange();
      let charCount = 0;
      let found = false;

      const traverseNodes = (node: Node) => {
        if (found) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeText = node.textContent || '';
          const nextCount = charCount + nodeText.length;
          
          if (nextCount >= lastCursorPosition.current) {
            const offset = lastCursorPosition.current - charCount;
            range.setStart(node, Math.min(offset, nodeText.length));
            range.setEnd(node, Math.min(offset, nodeText.length));
            found = true;
          }
          charCount = nextCount;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverseNodes(node.childNodes[i]);
          }
        }
      };

      traverseNodes(editorRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const updateContent = (text: string) => {
    setEditValue(text);
    addToHistory(text);
    
    if (editorRef.current) {
      editorRef.current.innerHTML = applyMarkdownStyles(text);
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        restoreCursorPosition();
      });
    }
  };

  const applyMarkdownStyles = (text: string) => {
    // Split the text into lines to handle headers
    const lines = text.split('\n');
    const styledLines = lines.map(line => {
      // Handle headers - style both the # symbols and the text
      if (line.startsWith('# ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1.4em;"># ${line.slice(2)}</span>`;
      }
      if (line.startsWith('## ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1.3em;">## ${line.slice(3)}</span>`;
      }
      if (line.startsWith('### ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1.2em;">### ${line.slice(4)}</span>`;
      }
      if (line.startsWith('#### ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1.1em;">#### ${line.slice(5)}</span>`;
      }
      if (line.startsWith('##### ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1em;">##### ${line.slice(6)}</span>`;
      }
      if (line.startsWith('###### ')) {
        return `<span style="color: #673ab7; font-weight: bold; font-size: 1em;">###### ${line.slice(7)}</span>`;
      }

      // Handle inline styles - style both the syntax and the text
      let styledLine = line;
      
      // Handle bold (**text**)
      styledLine = styledLine.replace(/\*\*(.*?)\*\*/g, '<span style="color: #673ab7; font-weight: bold;">**$1**</span>');
      
      // Handle italic (*text*)
      styledLine = styledLine.replace(/\*(.*?)\*/g, '<span style="font-style: italic;">*$1*</span>');
      
      // Handle code (`text`)
      styledLine = styledLine.replace(/`(.*?)`/g, '<span style="background-color: rgba(0, 0, 0, 0.04); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em;">`$1`</span>');

      return styledLine;
    });

    return styledLines.join('\n');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle undo/redo
    if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    // Handle redo with cmd/ctrl + y
    if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode('  ');
        range.deleteContents();
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    // Handle enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    saveCursorPosition();
    const text = e.currentTarget.textContent || '';
    setEditValue(text);
    addToHistory(text);
    
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMarkdownStyles(text);
        restoreCursorPosition();
      }
    });
  };

  const getPreviewText = (text: string) => {
    if (!text) return 'No markdown content';
    // Remove markdown syntax and get first 25 characters
    const plainText = text.replace(/[#*`]/g, '').trim();
    return plainText.length > 25 ? `${plainText.slice(0, 25)}...` : plainText;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {getPreviewText(value)}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setIsEditorOpen(true)}
          startIcon={<EditIcon />}
          sx={{
            borderColor: 'rgba(103, 58, 183, 0.2)',
            color: '#673ab7',
            '&:hover': {
              borderColor: '#673ab7',
              backgroundColor: 'rgba(103, 58, 183, 0.04)',
            },
          }}
        >
          Edit
        </Button>
      </Box>

      <Dialog
        open={isEditorOpen}
        onClose={handleSave}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #e0e0e0',
          pb: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ 
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              color: '#333333'
            }}>
              {label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Undo (⌘Z)">
                <IconButton
                  onClick={handleUndo}
                  disabled={!canUndo()}
                  size="small"
                  sx={{
                    color: canUndo() ? '#666666' : '#cccccc',
                    '&:hover': {
                      color: canUndo() ? '#10a37f' : undefined,
                      bgcolor: canUndo() ? 'rgba(16, 163, 127, 0.1)' : undefined,
                    },
                  }}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo (⌘⇧Z)">
                <IconButton
                  onClick={handleRedo}
                  disabled={!canRedo()}
                  size="small"
                  sx={{
                    color: canRedo() ? '#666666' : '#cccccc',
                    '&:hover': {
                      color: canRedo() ? '#10a37f' : undefined,
                      bgcolor: canRedo() ? 'rgba(16, 163, 127, 0.1)' : undefined,
                    },
                  }}
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Save (⌘S)">
              <IconButton
                onClick={handleSave}
                size="small"
                sx={{
                  color: '#666666',
                  '&:hover': {
                    color: '#10a37f',
                    bgcolor: 'rgba(16, 163, 127, 0.1)',
                  },
                }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={(e) => {
                e.stopPropagation(); // Prevent the dialog's onClose from firing
                handleClose();
              }}
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
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          '&.MuiDialogContent-root': {
            pt: 0
          }
        }}>
          <Box sx={{ 
            flex: 1,
            position: 'relative',
            '& .markdown-editor': {
              width: '100%',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.5',
              padding: '16px',
              outline: 'none',
              border: 'none',
              resize: 'none',
              backgroundColor: 'transparent',
              color: '#24292e',
              tabSize: 2,
              '&::placeholder': {
                color: '#999'
              }
            }
          }}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="markdown-editor"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              dangerouslySetInnerHTML={{ __html: applyMarkdownStyles(editValue) }}
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MarkdownEditor; 