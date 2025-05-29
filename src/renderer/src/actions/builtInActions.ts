import { Action } from '../types/Project';

export const builtInActions: Action[] = [
  {
    id: 'built-in-1',
    name: 'Extract JSON Attribute',
    type: 'input',
    icon: 'DataObjectIcon',
    color: '#10a37f',
    code: `function extract_json_attribute(input, config) {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const attribute = config.attribute_path;
    if (!attribute) return null;
    
    // Split the attribute path by dots to handle nested properties
    const path = attribute.split('.');
    let result = data;
    
    // Traverse the path
    for (const key of path) {
      if (result === null || result === undefined) return null;
      result = result[key];
    }
    
    return result;
  } catch (error) {
    return null;
  }
}`,
    config: [
      {
        type: 'text',
        label: 'Attribute Path',
        required: true,
        description: 'The path to the attribute you want to extract. Use dot notation for nested properties (e.g., "user.address.city")',
      }
    ],
    isBuiltIn: true,
    description: 'Extracts a specific attribute from a JSON input. Supports nested attributes using dot notation (e.g., "user.address.city"). Returns null if the attribute is not found or if the input is not valid JSON.',
  },
  {
    id: 'built-in-2',
    name: 'Extract CSV Cell',
    type: 'input',
    icon: 'TableChartIcon',
    color: '#ffc107',
    code: `function extract_csv_cell(input: Input, config: Config): any {
  try {
    const lines = input.data.split('\\n');
    if (!lines.length) return null;
    
    const rowIndex = parseInt(config.row_number) - 1; // Convert to 0-based index
    const colIndex = parseInt(config.column_number) - 1; // Convert to 0-based index
    
    if (rowIndex < 0 || colIndex < 0) return null;
    if (rowIndex >= lines.length) return null;
    
    const row = lines[rowIndex].split(',');
    if (colIndex >= row.length) return null;
    
    return row[colIndex].trim();
  } catch (error) {
    return null;
  }
}`,
    config: [
      {
        type: 'number',
        label: 'Row Number',
        required: true,
        description: 'The row number to extract (1-based index)',
      },
      {
        type: 'number',
        label: 'Column Number',
        required: true,
        description: 'The column number to extract (1-based index)',
      }
    ],
    isBuiltIn: true,
    description: 'Extracts a specific cell from a CSV input by row and column numbers. Both row and column numbers are 1-based (start from 1). Returns null if the cell is not found or if the input is not valid CSV.',
  },
  {
    id: 'built-in-3',
    name: 'LLM Analysis',
    type: 'transform',
    icon: 'AnalyticsIcon',
    color: '#673ab7',
    code: `// @ts-nocheck
export function process(config: Config): any {
  // When wrapInAitomics is disabled, this function should return an aitomics caller
  // and only expects a configuration object containing your custom config values
  const prompt = String(config.prompt);
  return $(prompt, config.actionName);
}`,
    config: [
      {
        type: 'text',
        label: 'prompt',
        required: true,
        description: 'The prompt to use for the LLM analysis',
      }
    ],
    isBuiltIn: true,
    description: 'Performs LLM analysis using the provided prompt. Uses the aitomics caller to instantiate the analysis. The prompt should be a detailed description of what you want the LLM to analyze.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-4',
    name: 'To Lowercase',
    type: 'transform',
    icon: 'TextFieldsIcon',
    color: '#2196f3',
    code: `// @ts-nocheck
export function process(config: Config): any {
  return _.lowerCase;
}`,
    config: [],
    isBuiltIn: true,
    description: 'Converts text to lowercase.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-5',
    name: 'To Uppercase',
    type: 'transform',
    icon: 'TextFieldsIcon',
    color: '#2196f3',
    code: `// @ts-nocheck
export function process(config: Config): any {
  return _.upperCase;
}`,
    config: [],
    isBuiltIn: true,
    description: 'Converts text to uppercase.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-6',
    name: 'Stringify',
    type: 'transform',
    icon: 'DataObjectIcon',
    color: '#4caf50',
    code: `// @ts-nocheck
export function process(config: Config): any {
  return _.JSONToString;
}`,
    config: [],
    isBuiltIn: true,
    description: 'Stringifies a JSON object.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-7',
    name: 'Parse JSON',
    type: 'transform',
    icon: 'DataObjectIcon',
    color: '#4caf50',
    code: `// @ts-nocheck
export function process(config: Config): any {
  return _.stringToJSON;
}`,
    config: [],
    isBuiltIn: true,
    description: 'Parses text into a JSON object.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-8',
    name: 'Raw Export',
    type: 'output',
    icon: 'DownloadIcon',
    color: '#ff9800',
    code: `// @ts-nocheck
export function process(input: any[], config: Config): any {
  return input;
}`,
    config: [],
    isBuiltIn: true,
    description: 'Exports the raw input data without any transformation.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-9',
    name: 'Export JSON',
    type: 'output',
    icon: 'DataObjectIcon',
    color: '#4caf50',
    code: `// @ts-nocheck
export function process(input: any[], config: Config): any {
  const outputs = input.map(item => item.output);
  return JSON.stringify(outputs);
}`,
    config: [],
    isBuiltIn: true,
    description: 'Exports the final result of each transformation as a JSON array.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-10',
    name: 'Export CSV',
    type: 'output',
    icon: 'TableChartIcon',
    color: '#2196f3',
    code: `// @ts-nocheck
export function process(input: any[], config: Config): any {
  const outputs = input.map(item => item.output);
  return outputs.join('\\n');
}`,
    config: [],
    isBuiltIn: true,
    description: 'Exports the final result of each transformation as a newline-separated list.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-11',
    name: 'Krippendorff\'s Alpha',
    type: 'comparison',
    icon: 'CompareIcon',
    color: '#673ab7',
    code: `// @ts-nocheck
export function process(list1, list2, config: Config): any {
  const model = new KrippendorffsComparisonModel(config.categories);
  return ComparisonModel.compareMultiple(list1, list2, model);
}`,
    config: [
      {
        type: 'list',
        label: 'categories',
        required: true,
        description: 'List of categories to use for comparison (e.g., ["positive", "negative", "neutral"])',
        defaultValue: []
      }
    ],
    isBuiltIn: true,
    description: 'Calculates Krippendorff\'s Alpha coefficient between two lists of categorical data. The coefficient measures the agreement between two raters, accounting for chance agreement.',
    wrapInAitomics: false,
  },
  {
    id: 'built-in-12',
    name: "Cohen's Kappa",
    type: 'comparison',
    icon: 'CompareIcon',
    color: '#FF9800',
    code: `function process(list1, list2, config) {
  const model = new CohensComparisonModel(config.label);
  const kappa = ComparisonModel.compareMultiple(list1, list2, model);
  return kappa;
}`,
    config: [
      {
        type: 'text',
        label: 'label',
        required: true,
        description: 'The label to calculate Cohen\'s Kappa for (presence/absence)'
      }
    ],
    description: 'Calculates Cohen\'s Kappa for a specific label, measuring agreement between two raters for binary data (presence/absence of the specified label).',
    isBuiltIn: true,
    wrapInAitomics: false
  }
]; 