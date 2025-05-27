import { Action } from '../types/Project';

export const builtInActions: Action[] = [
  {
    id: 'built-in-1',
    name: 'JSON Parser',
    type: 'transform',
    icon: 'DataObjectIcon',
    color: '#10a37f',
    code: `function json_parser(input: Input, config: Config): any {\n  try {\n    return JSON.parse(input.data);\n  } catch (error) {\n    return null;\n  }\n}`,
    config: [],
    isBuiltIn: true,
    description: 'Parses a JSON string into a JavaScript object. Returns null if parsing fails.',
  },
  {
    id: 'built-in-2',
    name: 'String to Number',
    type: 'transform',
    icon: 'TransformIcon',
    color: '#ffc107',
    code: `function string_to_number(input: Input, config: Config): any {\n  return Number(input.data);\n}`,
    config: [],
    isBuiltIn: true,
    description: 'Converts a string to a number. Returns NaN if the conversion fails.',
  },
  {
    id: 'built-in-3',
    name: 'Array Length',
    type: 'transform',
    icon: 'ListIcon',
    color: '#673ab7',
    code: `function array_length(input: Input, config: Config): any {\n  return Array.isArray(input.data) ? input.data.length : 0;\n}`,
    config: [],
    isBuiltIn: true,
    description: 'Returns the length of an array. Returns 0 if the input is not an array.',
  },
]; 