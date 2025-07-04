import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  TextField,
  Grid,
  Radio,
  RadioGroup,
  Paper,
  Tooltip,
  Link,
} from '@mui/material';
import Editor, { loader } from '@monaco-editor/react';
import { Action, ActionConfig, ActionType } from '../types/Project';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import DataObjectIcon from '@mui/icons-material/DataObject';
import StorageIcon from '@mui/icons-material/Storage';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TransformIcon from '@mui/icons-material/Transform';
import CompareIcon from '@mui/icons-material/Compare';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import InsightsIcon from '@mui/icons-material/Insights';
import AssessmentIcon from '@mui/icons-material/Assessment';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import BuildIcon from '@mui/icons-material/Build';
import ExtensionIcon from '@mui/icons-material/Extension';
import ApiIcon from '@mui/icons-material/Api';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import WebhookIcon from '@mui/icons-material/Webhook';
import HttpIcon from '@mui/icons-material/Http';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewListIcon from '@mui/icons-material/ViewList';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import SearchIcon from '@mui/icons-material/Search';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import InfoIcon from '@mui/icons-material/Info';
import { builtInActions } from '../actions/builtInActions';
import debounce from 'lodash/debounce';

const AVAILABLE_ICONS = [
  'Code', 'DataObject', 'Storage', 'CloudUpload', 'CloudDownload',
  'Transform', 'Compare', 'Analytics', 'Insights', 'Assessment',
  'Input', 'Output', 'Settings', 'Tune', 'Build',
  'Extension', 'Api', 'IntegrationInstructions', 'Webhook', 'Http',
  'StorageOutlined', 'TableChart', 'ViewColumn', 'ViewList',
  'FilterList', 'Sort', 'Search', 'FindInPage', 'FindReplace'
].map(name => `${name}Icon`);

const AVAILABLE_COLORS = [
  '#10a37f', '#0d8c6d', '#0b7a5d', // Green
  '#ffc107', '#e6ac00', '#cc9900', // Yellow
  '#673ab7', '#5e35b1', '#522d99', // Purple
  '#dc3545', '#bb2d3b', '#a52834', // Red
  '#2196f3', '#1e88e5', '#1976d2', // Blue
  '#ff9800', '#f57c00', '#ef6c00', // Orange
  '#795548', '#6d4c41', '#5d4037', // Brown
  '#607d8b', '#546e7a', '#455a64', // Blue Grey
  '#9c27b0', '#8e24aa', '#7b1fa2', // Deep Purple
  '#e91e63', '#d81b60', '#c2185b', // Pink
];

interface ActionEditorProps {
  action?: Action;
  onSave: (action: Action) => void;
  onClose: () => void;
  onDelete?: (actionId: string) => void;
}

// Add custom theme configuration
loader.init().then(monaco => {
  monaco.editor.defineTheme('beige', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8B8B8B' },
      { token: 'keyword', foreground: 'E74C3C' },
      { token: 'string', foreground: '2980B9' },
      { token: 'number', foreground: '3498DB' },
      { token: 'type', foreground: '9B59B6' },
      { token: 'function', foreground: '9B59B6' },
    ],
    colors: {
      'editor.background': '#FDFBF7',
      'editor.foreground': '#4A4A4A',
      'editor.lineHighlightBackground': '#F5F2E9',
      'editor.selectionBackground': '#E8E4D9',
      'editor.inactiveSelectionBackground': '#F5F2E9',
      'editorCursor.foreground': '#4A4A4A',
      'editorWhitespace.foreground': '#F5F2E9',
      'editorIndentGuide.background': '#F5F2E9',
      'editorIndentGuide.activeBackground': '#E8E4D9',
    }
  });

  // Configure TypeScript defaults
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    typeRoots: ["node_modules/@types"],
    strict: true,
    noImplicitAny: false,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    noImplicitThis: true,
    alwaysStrict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  });
});

const ActionEditor: React.FC<ActionEditorProps> = ({
  action,
  onSave,
  onClose,
  onDelete,
}) => {
  const [name, setName] = useState(action?.name || '');
  const [type, setType] = useState<ActionType>(action?.type || 'input');
  const [icon, setIcon] = useState(action?.icon || 'CodeIcon');
  const [color, setColor] = useState(action?.isBuiltIn ? '#666666' : (action?.color || '#10a37f'));
  const [wrapInAitomics, setWrapInAitomics] = useState(action?.wrapInAitomics ?? true);
  const [code, setCode] = useState(action?.code || '');
  const [configs, setConfigs] = useState<ActionConfig[]>(action?.config || []);
  const [description, setDescription] = useState(action?.description || '');
  const [editorModel, setEditorModel] = useState<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const isInitialLoad = React.useRef(true);

  // Add debounced update functions
  const debouncedUpdateName = useCallback(
    debounce((value: string) => {
      setName(value);
    }, 500),
    []
  );

  const debouncedUpdateDescription = useCallback(
    debounce((value: string) => {
      setDescription(value);
    }, 500),
    []
  );

  const debouncedUpdateConfig = useCallback(
    debounce((index: number, field: keyof ActionConfig, value: any) => {
      const newConfigs = [...configs];
      newConfigs[index] = {
        ...newConfigs[index],
        [field]: value,
      };
      setConfigs(newConfigs);
    }, 500),
    [configs]
  );

  // Clean up model and editor when component unmounts
  useEffect(() => {
    return () => {
      if (editorModel) {
        editorModel.dispose();
        setEditorModel(null);
      }
      if (editorInstance) {
        editorInstance.dispose();
        setEditorInstance(null);
      }
    };
  }, [editorModel, editorInstance]);

  // Update state when action prop changes - this should only load the existing code
  useEffect(() => {
    if (action) {
      setName(action.name || '');
      setType(action.type || 'input');
      setIcon(action.icon || 'CodeIcon');
      setColor(action.isBuiltIn ? '#666666' : (action.color || '#10a37f'));
      setCode(action.code); // Just load the existing code without modification
      setConfigs(action.config || []);
      setDescription(action.description || '');
      setWrapInAitomics(action.wrapInAitomics ?? true);
    }
    isInitialLoad.current = true;
  }, [action]);

  // Update code template when type or wrapInAitomics changes
  useEffect(() => {
    // Skip if this is the initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (type === 'comparison') {
      setCode(`// @ts-nocheck
export function process(list1, list2, config: Config): any {
  // This function should compare list1 and list2 and return a result
  return 0;
}`);
    } else if (type === 'output') {
      setCode(`// @ts-nocheck
export function process(input: any[], config: Config): any {
  // This function should process a list of elements and return a result
  return input;
}`);
    } else if (!wrapInAitomics) {
      if (type === 'transform') {
        setCode(`// @ts-nocheck
export function process(config: Config): any {
  // When wrapInAitomics is disabled, this function should return an aitomics caller
  // and only expects a configuration object containing actionName and your custom config values
  return $(config.prompt, config.actionName);
}`);
      } else {
        setCode(`// @ts-nocheck
$(config.prompt, config.actionName)`);
      }
    } else {
      setCode(`// @ts-nocheck
export function process(input: any, config: Config): any {
  // When wrapInAitomics is disabled, this function should return an aitomics caller
  // and only expects a configuration object containing actionName and your custom config values
  return input;
}`);
    }
  }, [type, wrapInAitomics]);

  // Generate type definitions based on configs
  const generateTypeDefinitions = () => {
    const inputProperties = configs.map(config => {
      let type = 'any';
      switch (config.type) {
        case 'text':
          type = 'string';
          break;
        case 'number':
          type = 'number';
          break;
        case 'boolean':
          type = 'boolean';
          break;
        case 'select':
          type = config.options ? `'${config.options.join("' | '")}'` : 'string';
          break;
        case 'json':
          type = 'any';
          break;
        case 'list':
          type = 'string[]';
          break;
      }
      // Convert label to lowercase and replace spaces with underscores
      const parsedLabel = config.label.toLowerCase().replace(/\s+/g, '_');
      return `  ${parsedLabel}: ${type};`;
    }).join('\n');

    return `declare interface Input {
  [key: string]: any;
}

declare interface Config {
  actionName: string; // The name of this action
${inputProperties}
}`;
  };

  // Update type definitions when configs change
  useEffect(() => {
    loader.init().then(monaco => {
      // Reset the entire TypeScript language service
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });

      // Clear all existing type definitions
      monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);

      // Configure compiler options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        strict: true,
        noImplicitAny: false,
        strictNullChecks: true,
        strictFunctionTypes: true,
        strictBindCallApply: true,
        strictPropertyInitialization: true,
        noImplicitThis: true,
        alwaysStrict: true
      });

      // Add type definitions
      const typeDefinitions = generateTypeDefinitions();
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        typeDefinitions,
        'file:///types.d.ts'
      );

      // Re-enable validation
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    });
  }, [configs]);

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setCode(value);
    }
  };

  const handleSave = () => {
    if (!action) return;
    
    const updatedAction: Action = {
      ...action,
      id: action.id || crypto.randomUUID(),
      name: name,
      type: type,
      icon: icon,
      color: color,
      code: code,
      config: configs,
      description: description,
      isBuiltIn: action.isBuiltIn || false,
      wrapInAitomics: wrapInAitomics,
    };
    
    onSave(updatedAction);
    onClose();
  };

  const handleAddConfig = () => {
    setConfigs([
      ...configs,
      {
        type: 'text',
        label: '',
        required: false,
      },
    ]);
  };

  const handleRemoveConfig = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const renderIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      CodeIcon,
      DataObjectIcon,
      StorageIcon,
      CloudUploadIcon,
      CloudDownloadIcon,
      TransformIcon,
      CompareIcon,
      AnalyticsIcon,
      InsightsIcon,
      AssessmentIcon,
      InputIcon,
      OutputIcon,
      SettingsIcon,
      TuneIcon,
      BuildIcon,
      ExtensionIcon,
      ApiIcon,
      IntegrationInstructionsIcon,
      WebhookIcon,
      HttpIcon,
      StorageOutlinedIcon,
      TableChartIcon,
      ViewColumnIcon,
      ViewListIcon,
      FilterListIcon,
      SortIcon,
      SearchIcon,
      FindInPageIcon,
      FindReplaceIcon,
    };
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent sx={{ fontSize: '1.2rem' }} /> : null;
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderRadius: 2,
      boxShadow: '0 2px 16px 0 rgba(0,0,0,0.06)',
    }}>
      <Box 
        sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: `linear-gradient(145deg, ${action?.isBuiltIn ? '#66666620' : color + '20'} 0%, ${action?.isBuiltIn ? '#66666610' : color + '10'} 100%)`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {renderIcon(icon) && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              background: `linear-gradient(145deg, ${action?.isBuiltIn ? '#66666630' : color + '30'} 0%, ${action?.isBuiltIn ? '#66666620' : color + '20'} 100%)`,
              color: action?.isBuiltIn ? '#666666' : color,
            }}>
              {renderIcon(icon)}
            </Box>
          )}
          <Typography variant="h6" sx={{ color: action?.isBuiltIn ? '#666666' : color, fontWeight: 500 }}>
            {action ? 'Edit Action' : 'Create New Action'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {action && onDelete && !action.isBuiltIn && (
            <IconButton
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this action?')) {
                  try {
                    await onDelete(action.id);
                    onClose();
                  } catch (error) {
                    console.error('Error deleting action:', error);
                    window.alert('Failed to delete action. Please try again.');
                  }
                }
              }}
              color="error"
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(220, 53, 69, 0.08)',
                },
              }}
            >
              <DeleteIcon />
            </IconButton>
          )}
          <Button
            onClick={onClose}
            sx={{
              color: '#6e6e80',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!name || !type || !icon || !code}
            sx={{
              background: `linear-gradient(145deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 4px 12px ${color}40`,
              '&:hover': {
                background: `linear-gradient(145deg, ${color}dd 0%, ${color}cc 100%)`,
                boxShadow: `0 6px 16px ${color}50`,
              },
            }}
          >
            {action?.isBuiltIn ? 'Duplicate' : 'Save Action'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Stack spacing={3}>
          <TextField
            label="Action Name"
            defaultValue={name}
            onChange={(e) => {
              // Update local state immediately
              setName(e.target.value);
              // Debounce the actual update
              debouncedUpdateName(e.target.value);
            }}
            fullWidth
            disabled={action?.isBuiltIn}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'none',
              },
            }}
          />

          <TextField
            label="Description"
            defaultValue={description}
            onChange={(e) => {
              // Update local state immediately
              setDescription(e.target.value);
              // Debounce the actual update
              debouncedUpdateDescription(e.target.value);
            }}
            fullWidth
            multiline
            rows={2}
            disabled={action?.isBuiltIn}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'none',
              },
            }}
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Icon</InputLabel>
                <Select
                  value={icon}
                  label="Icon"
                  onChange={(e) => setIcon(e.target.value)}
                  disabled={action?.isBuiltIn}
                  renderValue={(value) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {renderIcon(value)}
                      <Typography>{value.replace(/Icon$/, '')}</Typography>
                    </Box>
                  )}
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  {AVAILABLE_ICONS.map((iconName) => (
                    <MenuItem 
                      key={iconName} 
                      value={iconName}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        '&:hover': {
                          backgroundColor: `${action?.isBuiltIn ? '#66666610' : color + '10'}`,
                        },
                        '&.Mui-selected': {
                          backgroundColor: `${action?.isBuiltIn ? '#66666620' : color + '20'}`,
                          '&:hover': {
                            backgroundColor: `${action?.isBuiltIn ? '#66666630' : color + '30'}`,
                          },
                        },
                      }}
                    >
                      {renderIcon(iconName)}
                      <Typography>{iconName.replace(/Icon$/, '')}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Color</InputLabel>
                <Select
                  value={color}
                  label="Color"
                  onChange={(e) => setColor(e.target.value)}
                  disabled={action?.isBuiltIn}
                  renderValue={(value) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: value,
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                      <Typography>{value}</Typography>
                    </Box>
                  )}
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  {AVAILABLE_COLORS.map((color) => (
                    <MenuItem 
                      key={color} 
                      value={color}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        '&:hover': {
                          backgroundColor: `${action?.isBuiltIn ? '#66666610' : color + '10'}`,
                        },
                        '&.Mui-selected': {
                          backgroundColor: `${action?.isBuiltIn ? '#66666620' : color + '20'}`,
                          '&:hover': {
                            backgroundColor: `${action?.isBuiltIn ? '#66666630' : color + '30'}`,
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: color,
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                      <Typography>{color}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Action Type</Typography>
            <RadioGroup
              value={type}
              onChange={(e) => setType(e.target.value as ActionType)}
              sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}
            >
              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  '& .MuiRadio-root': {
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1,
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                  },
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    height: 60,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                    position: 'relative',
                    background: type === 'input' 
                      ? 'linear-gradient(145deg, #10a37f20 0%, #10a37f10 100%)'
                      : 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                    color: type === 'input' ? '#10a37f' : '#6e6e80',
                    border: `1px solid ${type === 'input' ? '#10a37f40' : 'rgba(110, 110, 128, 0.2)'}`,
                    opacity: type === 'input' ? 1 : 0.7,
                    '&:hover': {
                      background: type === 'input'
                        ? 'linear-gradient(145deg, #10a37f30 0%, #10a37f20 100%)'
                        : 'linear-gradient(145deg, #d1f0e6 0%, #b8e9db 100%)',
                      boxShadow: type === 'input'
                        ? '0 4px 12px rgba(16, 163, 127, 0.2)'
                        : '0 4px 12px rgba(16, 163, 127, 0.1)',
                    },
                    mb: 0.5,
                    borderRadius: 1,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Radio value="input" disabled={action?.isBuiltIn} />
                  <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, mr: 1 }}>
                    <InputIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Input
                  </Typography>
                </Paper>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  '& .MuiRadio-root': {
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1,
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                  },
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    height: 60,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                    position: 'relative',
                    background: type === 'output' 
                      ? 'linear-gradient(145deg, #dc354520 0%, #dc354510 100%)'
                      : 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                    color: type === 'output' ? '#dc3545' : '#6e6e80',
                    border: `1px solid ${type === 'output' ? '#dc354540' : 'rgba(110, 110, 128, 0.2)'}`,
                    opacity: type === 'output' ? 1 : 0.7,
                    '&:hover': {
                      background: type === 'output'
                        ? 'linear-gradient(145deg, #dc354530 0%, #dc354520 100%)'
                        : 'linear-gradient(145deg, #f0d1d1 0%, #e6b8b8 100%)',
                      boxShadow: type === 'output'
                        ? '0 4px 12px rgba(220, 53, 69, 0.2)'
                        : '0 4px 12px rgba(220, 53, 69, 0.1)',
                    },
                    mb: 0.5,
                    borderRadius: 1,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Radio value="output" disabled={action?.isBuiltIn} />
                  <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, mr: 1 }}>
                    <OutputIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Output
                  </Typography>
                </Paper>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  '& .MuiRadio-root': {
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1,
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                  },
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    height: 60,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                    position: 'relative',
                    background: type === 'transform' 
                      ? 'linear-gradient(145deg, #ffc10720 0%, #ffc10710 100%)'
                      : 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                    color: type === 'transform' ? '#ffc107' : '#6e6e80',
                    border: `1px solid ${type === 'transform' ? '#ffc10740' : 'rgba(110, 110, 128, 0.2)'}`,
                    opacity: type === 'transform' ? 1 : 0.7,
                    '&:hover': {
                      background: type === 'transform'
                        ? 'linear-gradient(145deg, #ffc10730 0%, #ffc10720 100%)'
                        : 'linear-gradient(145deg, #f0e9d1 0%, #e6dbb8 100%)',
                      boxShadow: type === 'transform'
                        ? '0 4px 12px rgba(255, 193, 7, 0.2)'
                        : '0 4px 12px rgba(255, 193, 7, 0.1)',
                    },
                    mb: 0.5,
                    borderRadius: 1,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Radio value="transform" disabled={action?.isBuiltIn} />
                  <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, mr: 1 }}>
                    <TransformIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Transform
                  </Typography>
                </Paper>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  '& .MuiRadio-root': {
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1,
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                  },
                }}
              >
                <Paper
                  sx={{
                    p: 1,
                    height: 60,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    cursor: action?.isBuiltIn ? 'default' : 'pointer',
                    position: 'relative',
                    background: type === 'comparison' 
                      ? 'linear-gradient(145deg, #673ab720 0%, #673ab710 100%)'
                      : 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                    color: type === 'comparison' ? '#673ab7' : '#6e6e80',
                    border: `1px solid ${type === 'comparison' ? '#673ab740' : 'rgba(110, 110, 128, 0.2)'}`,
                    opacity: type === 'comparison' ? 1 : 0.7,
                    '&:hover': {
                      background: type === 'comparison'
                        ? 'linear-gradient(145deg, #673ab730 0%, #673ab720 100%)'
                        : 'linear-gradient(145deg, #d1d1f0 0%, #b8b8e9 100%)',
                      boxShadow: type === 'comparison'
                        ? '0 4px 12px rgba(103, 58, 183, 0.2)'
                        : '0 4px 12px rgba(103, 58, 183, 0.1)',
                    },
                    mb: 0.5,
                    borderRadius: 1,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Radio value="comparison" disabled={action?.isBuiltIn} />
                  <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center', flexShrink: 0, mr: 1 }}>
                    <CompareIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Comparison
                  </Typography>
                </Paper>
              </Box>
            </RadioGroup>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {type !== 'output' && type !== 'comparison' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={wrapInAitomics}
                    onChange={(e) => setWrapInAitomics(e.target.checked)}
                    disabled={action?.isBuiltIn}
                  />
                }
                label="Wrap code in Aitomics constructs"
                sx={{
                  '& .MuiFormControlLabel-label': {
                    color: 'text.secondary',
                  },
                }}
              />
            )}
            {type !== 'output' && type !== 'comparison' && (
              <Tooltip 
                title="By default, this should be enabled unless you have specific knowledge of Aitomics. Your code should be pure JavaScript. If disabled, the function should return an aitomics caller and the function should only expect a configuration object."
                placement="right"
                arrow
              >
                <IconButton
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>JavaScript Code</Typography>
            {(!wrapInAitomics || type === 'output' || type === 'comparison') && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                When wrapInAitomics is disabled, the function should return an aitomics caller. See the{' '}
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.electron?.ipcRenderer) {
                      window.electron.ipcRenderer.invoke('open-external-link', 'https://github.com/sebastiannicolajsen/aitomics');
                    }
                  }}
                  sx={{
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Aitomics repository
                </Link>
                {' '}for more information.
              </Typography>
            )}
            <Box sx={{ 
              height: 300, 
              border: 1, 
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              <Editor
                height="100%"
                defaultLanguage="typescript"
                language="typescript"
                value={code}
                onChange={(value) => {
                  if (value) {
                    setCode(value);
                  }
                }}
                theme="beige"
                options={{
                  readOnly: action?.isBuiltIn,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  wordBasedSuggestions: 'currentDocument',
                  parameterHints: { enabled: true },
                  formatOnPaste: true,
                  formatOnType: true,
                  model: null // Force model recreation
                }}
                beforeMount={(monaco) => {
                  // Reset the entire TypeScript language service
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                  });

                  // Clear all existing type definitions
                  monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);

                  // Configure compiler options
                  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    target: monaco.languages.typescript.ScriptTarget.ES2020,
                    allowNonTsExtensions: true,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    noEmit: true,
                    esModuleInterop: true,
                    jsx: monaco.languages.typescript.JsxEmit.React,
                    reactNamespace: "React",
                    allowJs: true,
                    typeRoots: ["node_modules/@types"],
                    strict: true,
                    noImplicitAny: false,
                    strictNullChecks: true,
                    strictFunctionTypes: true,
                    strictBindCallApply: true,
                    strictPropertyInitialization: true,
                    noImplicitThis: true,
                    alwaysStrict: true
                  });
                }}
                onMount={(editor, monaco) => {
                  // Create a new model with explicit TypeScript settings
                  const modelUri = monaco.Uri.parse('file:///action.ts');
                  const model = monaco.editor.createModel(code, 'typescript', modelUri);
                  
                  // Set the model on the editor
                  editor.setModel(model);
                  
                  // Force TypeScript mode
                  monaco.editor.setModelLanguage(model, 'typescript');
                }}
              />
            </Box>
          </Box>

          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle2">Configuration</Typography>
              {!action?.isBuiltIn && (
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddConfig}
                  size="small"
                  sx={{
                    color: '#10a37f',
                    '&:hover': {
                      backgroundColor: 'rgba(16, 163, 127, 0.08)',
                    },
                  }}
                >
                  Add Config
                </Button>
              )}
            </Box>
            {configs.map((config, index) => (
              <Box 
                key={index} 
                sx={{ 
                  mb: 2, 
                  p: 2, 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 2,
                  background: 'linear-gradient(145deg, #f7f7f8 0%, #f0f0f1 100%)',
                }}
              >
                <Stack spacing={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">Config #{index + 1}</Typography>
                    {!action?.isBuiltIn && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveConfig(index)}
                        color="error"
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(220, 53, 69, 0.08)',
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  <TextField
                    label="Label"
                    defaultValue={config.label}
                    onChange={(e) => {
                      // Update local state immediately
                      const newConfigs = [...configs];
                      newConfigs[index] = {
                        ...newConfigs[index],
                        label: e.target.value,
                      };
                      setConfigs(newConfigs);
                      // Debounce the actual update
                      debouncedUpdateConfig(index, 'label', e.target.value);
                    }}
                    fullWidth
                    disabled={action?.isBuiltIn}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'none',
                      },
                    }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={config.type}
                      label="Type"
                      onChange={(e) => {
                        // Update local state immediately
                        const newConfigs = [...configs];
                        newConfigs[index] = {
                          ...newConfigs[index],
                          type: e.target.value as ActionConfig['type'],
                        };
                        setConfigs(newConfigs);
                        // Debounce the actual update
                        debouncedUpdateConfig(index, 'type', e.target.value as ActionConfig['type']);
                      }}
                      disabled={action?.isBuiltIn}
                      sx={{
                        borderRadius: 2,
                        transition: 'none',
                      }}
                    >
                      <MenuItem value="text">Text</MenuItem>
                      <MenuItem value="number">Number</MenuItem>
                      <MenuItem value="boolean">Boolean</MenuItem>
                      <MenuItem value="select">Select</MenuItem>
                      <MenuItem value="json">JSON</MenuItem>
                      <MenuItem value="list">List</MenuItem>
                      <MenuItem value="markdown">Markdown</MenuItem>
                    </Select>
                  </FormControl>
                  {config.type === 'select' && (
                    <TextField
                      label="Options (comma-separated)"
                      defaultValue={config.options?.join(',') || ''}
                      onChange={(e) => {
                        // Update local state immediately
                        const newConfigs = [...configs];
                        newConfigs[index] = {
                          ...newConfigs[index],
                          options: e.target.value.split(','),
                        };
                        setConfigs(newConfigs);
                        // Debounce the actual update
                        debouncedUpdateConfig(index, 'options', e.target.value.split(','));
                      }}
                      fullWidth
                      disabled={action?.isBuiltIn}
                      helperText="Enter options separated by commas"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'none',
                        },
                      }}
                    />
                  )}
                  {config.type === 'list' && (
                    <Box>
                      <TextField
                        label="Default Values (comma-separated)"
                        defaultValue={Array.isArray(config.defaultValue) ? config.defaultValue.join(',') : ''}
                        onChange={(e) => {
                          // Update local state immediately
                          const newConfigs = [...configs];
                          newConfigs[index] = {
                            ...newConfigs[index],
                            defaultValue: e.target.value.split(',').map(v => v.trim()),
                          };
                          setConfigs(newConfigs);
                          // Debounce the actual update
                          debouncedUpdateConfig(index, 'defaultValue', e.target.value.split(',').map(v => v.trim()));
                        }}
                        fullWidth
                        disabled={action?.isBuiltIn}
                        helperText="Enter default values separated by commas"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'none',
                          },
                        }}
                      />
                    </Box>
                  )}
                  <TextField
                    label="Description"
                    defaultValue={config.description || ''}
                    onChange={(e) => {
                      // Update local state immediately
                      const newConfigs = [...configs];
                      newConfigs[index] = {
                        ...newConfigs[index],
                        description: e.target.value,
                      };
                      setConfigs(newConfigs);
                      // Debounce the actual update
                      debouncedUpdateConfig(index, 'description', e.target.value);
                    }}
                    fullWidth
                    multiline
                    rows={2}
                    disabled={action?.isBuiltIn}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'none',
                      },
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.required}
                        onChange={(e) => {
                          // Update local state immediately
                          const newConfigs = [...configs];
                          newConfigs[index] = {
                            ...newConfigs[index],
                            required: e.target.checked,
                          };
                          setConfigs(newConfigs);
                          // Debounce the actual update
                          debouncedUpdateConfig(index, 'required', e.target.checked);
                        }}
                        disabled={action?.isBuiltIn}
                      />
                    }
                    label="Required"
                  />
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default ActionEditor; 