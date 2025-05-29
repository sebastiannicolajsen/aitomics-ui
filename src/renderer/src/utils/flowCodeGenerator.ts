import { Project, Action, Block } from '../types/Project';
import { builtInActions } from '../actions/builtInActions';
import { parse } from 'csv-parse/sync';

interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export function generateFlowCode(project: Project, globalActions: Action[], maxItems?: number, llmConfig?: LLMConfig): string {
  if (!project) return '';

  // Create a map of node IDs to their code and actions
  const nodeCodeMap = new Map<string, { code: string; action: Action }>();
  
  // Debug logging for available actions
  console.log('Available actions:', {
    builtIn: builtInActions.map(a => ({ id: a.id, name: a.name, wrapInAitomics: a.wrapInAitomics })),
    custom: globalActions.map(a => ({ id: a.id, name: a.name, wrapInAitomics: a.wrapInAitomics }))
  });

  // Debug the globalActions array
  console.log('Global actions array:', {
    length: globalActions.length,
    actions: globalActions.map(a => ({ id: a.id, name: a.name }))
  });

  // First, populate the nodeCodeMap for all blocks
  project.blocks.forEach(block => {
    if (block.actionId) {
      console.log('Processing block:', { 
        id: block.id, 
        actionId: block.actionId,
        type: block.type,
        name: block.name
      });

      // Check built-in actions first
      const builtInAction = builtInActions.find(a => a.id === block.actionId);
      if (builtInAction) {
        console.log('Found built-in action:', { 
          id: builtInAction.id, 
          name: builtInAction.name,
          wrapInAitomics: builtInAction.wrapInAitomics
        });
        // Strip TypeScript type annotations from the code, but preserve ternary expressions
        const strippedCode = builtInAction.code
          .split('\n')
          .map(line => {
            // If the line contains a ternary operator, preserve it
            if (line.includes('?') && line.includes(':')) {
              return line.trim();
            }
            // Otherwise strip TypeScript annotations
            return line.replace(/: [A-Za-z<>[\]]+/g, '').trim();
          })
          .join('\n');
        nodeCodeMap.set(block.id, { code: strippedCode, action: builtInAction });
        return;
      }

      // Then check custom actions
      const customAction = globalActions.find(a => a.id === block.actionId);
      if (customAction) {
        console.log('Found custom action:', { 
          id: customAction.id, 
          name: customAction.name,
          wrapInAitomics: customAction.wrapInAitomics,
          action: customAction
        });
        // Strip TypeScript type annotations from the code, but preserve ternary expressions
        const strippedCode = customAction.code
          .split('\n')
          .map(line => {
            // If the line contains a ternary operator, preserve it
            if (line.includes('?') && line.includes(':')) {
              return line.trim();
            }
            // Otherwise strip TypeScript annotations
            return line.replace(/: [A-Za-z<>[\]]+/g, '').trim();
          })
          .join('\n');
        nodeCodeMap.set(block.id, { code: strippedCode, action: customAction });
      } else {
        console.warn('No action found for block:', { 
          id: block.id, 
          actionId: block.actionId,
          availableActionIds: [...globalActions, ...builtInActions].map(a => a.id)
        });
      }
    }
  });

  // Debug logging
  console.log('Project blocks:', project.blocks.map(b => ({ id: b.id, type: b.type, actionId: b.actionId })));
  console.log('Transform blocks:', project.blocks.filter(b => b.type === 'transform').map(b => ({ id: b.id, actionId: b.actionId })));
  console.log('Node code map:', Array.from(nodeCodeMap.entries()).map(([id, info]) => ({ id, actionName: info.action.name })));

  // Generate the execution code
  const code = `// Generated execution code for ${project.name}
// This code represents the flow execution logic using Aitomics

// Import required dependencies
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// UI Logging toggle
const UI_LOGGING = true;

// Helper function for logging
function safeStringify(obj) {
  try {
    return typeof obj === 'object' ? JSON.stringify(obj) : String(obj);
  } catch (error) {
    return String(obj);
  }
}

// LLM Configuration
const llmConfig = {
  model: ${JSON.stringify(llmConfig?.model || "llama-3.2-3b-instruct")},
  path: "http://127.0.0.1",
  port: 1234,
  endpoint: "v1/chat/completions",
  settings: {
    temperature: ${llmConfig?.temperature || 0.7},
    max_tokens: ${llmConfig?.maxTokens || -1},
    stream: false
  }
};

// Cache for file contents
const fileCache = new Map();

// Function to parse file content based on file type
async function parseFileContent(filePath, nodeName) {
  // Log UI file loading regardless of cache status
  if (UI_LOGGING) {
    console.log('[FLOW_UI_LOG] ' + JSON.stringify({
      type: 'additional_file',
      nodeName: nodeName,
      filePath: filePath
    }));
  }

  // Check cache first
  if (fileCache.has(filePath)) {
    console.log('[FLOW] Using cached content for:', safeStringify(filePath));
    return fileCache.get(filePath);
  }

  try {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    let items;

    switch (fileExtension) {
      case 'json':
        const jsonContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(jsonContent);
        items = Array.isArray(jsonData) ? jsonData : [jsonData];
        break;
        
      case 'csv':
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        items = parse(csvContent, {
          columns: true,
          skip_empty_lines: true
        });
        break;
        
      default:
        // For other formats, treat as single item
        const content = fs.readFileSync(filePath, 'utf-8');
        items = [content];
    }

    // Import aitomics module if not already imported
    if (!global.aitomics) {
      global.aitomics = await import('aitomics');
    }
    const { Response: AitomicsResponse } = global.aitomics;

    // Convert items to Response objects using aitomics Response
    const responses = items.map((item) => AitomicsResponse.create(item, item, nodeName));
    
    // Cache the results
    console.log('[FLOW] Caching ' + responses.length + ' items from ' + safeStringify(filePath));
    fileCache.set(filePath, responses);
    
    return responses;
  } catch (error) {
    console.error('[FLOW_ERROR] Error processing file:', safeStringify({
      filePath,
      error: error.message
    }));
    return [];
  }
}

async function executeFlow() {
  // Import aitomics module
  global.aitomics = await import('aitomics');
  const {
    Caller,
    Response: AitomicsResponse,
    $,
    _,
    setConfigFromObject,
    ComparisonModel,
    KrippendorffsComparisonModel,
    CohensComparisonModel
  } = global.aitomics;

  // Set the LLM configuration
  setConfigFromObject(llmConfig);

  // Set up all transform and import nodes as aitomics callers
  // Each node that has wrapInAitomics enabled will be wrapped in a $ function
  const callers = {};
  const comparisonCallers = {};
  const exportCallers = {};
  
  ${(() => {
    const relevantBlocks = project.blocks.filter(block => {
      const isRelevant = block.type === 'transform' || block.type === 'import';
      console.log('Filtering block:', { id: block.id, type: block.type, isRelevant });
      return isRelevant;
    });

    console.log('Found relevant blocks:', relevantBlocks.length);

    return relevantBlocks.map(block => {
      const nodeInfo = nodeCodeMap.get(block.id);
      console.log('Processing block:', { 
        id: block.id, 
        type: block.type,
        hasNodeInfo: !!nodeInfo,
        actionName: nodeInfo?.action.name 
      });
      
      if (!nodeInfo) {
        console.warn('No action found for node:', block.id);
        return '';
      }
      
      // Create config object from node config
      const normalizedConfig = Object.entries(block.config || {}).reduce((acc, [key, value]) => {
        // Only normalize the config keys, not actionName or other properties
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        acc[normalizedKey] = value;
        return acc;
      }, {} as Record<string, any>);

      const configObject = JSON.stringify({
        ...normalizedConfig,  // Normalized config keys
        actionName: nodeInfo.action.name  // Keep actionName as is
      });
      
      // Only skip if wrapInAitomics is explicitly set to false
      const shouldWrap = nodeInfo.action.wrapInAitomics !== false;
      if (!shouldWrap) {
        console.log('Skipping aitomics wrapping for node:', block.id);
        // Format the function content
        const formattedCode = nodeInfo.code
          .trim()
          // Remove comments from the entire string first
          .replace(/\/\/.*$/gm, '') // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
          .split('\n')
          .map(line => {
            // Remove export and @ts-nocheck from the line
            return line
              .replace(/export\s+function/, 'function')
              .replace(/\/\/\s*@ts-nocheck/, '')
              .trim();
          })
          .filter(line => line.length > 0)
          .join(' ');

        return `  // Set up caller for ${block.type} node: ${block.name || block.id}
  callers['${block.id}'] = (${formattedCode})(${configObject});

`;
      }

      // Format the function content
      const formattedCode = nodeInfo.code
        .trim()
        // Remove comments from the entire string first
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .split('\n')
        .map(line => {
          // Remove export and @ts-nocheck from the line
          const cleanedLine = line
            .replace(/export\s+function/, 'function')
            .replace(/\/\/\s*@ts-nocheck/, '')
            .trim();
          
          // Preserve the entire line if it contains a conditional expression
          if (cleanedLine.includes('?') && cleanedLine.includes(':')) {
            return cleanedLine;
          }
          
          return cleanedLine;
        })
        .filter(line => line.length > 0)
        .join(' ');

      return `  // Set up caller for ${block.type} node: ${block.name || block.id}
  callers['${block.id}'] = $((input) => {
    const config = ${configObject};
    const fn = ${formattedCode};
    return fn(input, config);
  }, "${block.name || block.id}: ${nodeInfo.action.name}");

`;
    }).filter(Boolean).join('\n');
  })()}

  // Set up comparison callers
  ${(() => {
    const comparisonBlocks = project.blocks.filter(block => block.type === 'comparison');
    return comparisonBlocks.map(block => {
      const nodeInfo = nodeCodeMap.get(block.id);
      if (!nodeInfo) {
        console.warn('No action found for comparison node:', block.id);
        return '';
      }

      // Create config object from node config
      const normalizedConfig = Object.entries(block.config || {}).reduce((acc, [key, value]) => {
        // Only normalize the config keys, not actionName or other properties
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        acc[normalizedKey] = value;
        return acc;
      }, {} as Record<string, any>);

      const configObject = JSON.stringify({
        ...normalizedConfig,  // Normalized config keys
        actionName: nodeInfo.action.name  // Keep actionName as is
      });

      // Format the function content
      const formattedCode = nodeInfo.code
        .trim()
        // Remove comments from the entire string first
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .split('\n')
        .map(line => {
          // Remove export and @ts-nocheck from the line
          return line
            .replace(/export\s+function/, 'function')
            .replace(/\/\/\s*@ts-nocheck/, '')
            .trim();
        })
        .filter(line => line.length > 0)
        .join('\n    ');

      return `  // Set up comparison caller for node: ${block.name || block.id}
  comparisonCallers['${block.id}'] = (function() {
    const config = ${configObject};
    const fn = ${formattedCode};
    return (list1, list2) => fn(list1, list2, config);
  })();
`;
    }).filter(Boolean).join('\n');
  })()}

  // Set up export callers
  ${(() => {
    const exportBlocks = project.blocks.filter(block => block.type === 'export');
    return exportBlocks.map(block => {
      const nodeInfo = nodeCodeMap.get(block.id);
      if (!nodeInfo) {
        console.warn('No action found for export node:', block.id);
        return '';
      }

      // Create config object from node config
      const normalizedConfig = Object.entries(block.config || {}).reduce((acc, [key, value]) => {
        // Only normalize the config keys, not actionName or other properties
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        acc[normalizedKey] = value;
        return acc;
      }, {} as Record<string, any>);

      const configObject = JSON.stringify({
        ...normalizedConfig,  // Normalized config keys
        actionName: nodeInfo.action.name  // Keep actionName as is
      });

      // Format the function content
      const formattedCode = nodeInfo.code
        .trim()
        // Remove comments from the entire string first
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .split('\n')
        .map(line => {
          // Remove export and @ts-nocheck from the line
          return line
            .replace(/export\s+function/, 'function')
            .replace(/\/\/\s*@ts-nocheck/, '')
            .trim();
        })
        .filter(line => line.length > 0)
        .join('\n    ');

      return `  // Set up export caller for node: ${block.name || block.id}
  exportCallers['${block.id}'] = (function() {
    const config = ${configObject};
    const fn = ${formattedCode};
    return (data) => fn(data, config);
  })();
`;
    }).filter(Boolean).join('\n');
  })()}

  // Process import nodes
  const importResults = new Map();

  ${(() => {
    const importBlocks = project.blocks.filter(block => 
      block.type === 'import' && block.file && typeof block.file === 'string'
    );

    return importBlocks.map(block => {
      const filePath = block.file as string;
      return `  // Process import node: ${block.name || block.id}
  {
    const items = await parseFileContent('${filePath}', '${block.name || block.id}');
    importResults.set('${block.id}', items);
  }`;
    }).join('\n\n');
  })()}

  // Helper function to run a caller with error handling
  async function runCaller(callerId, input, nodeName) {
    const caller = callers[callerId];
    if (!caller) {
      console.warn('[FLOW_ERROR] No caller found for node:', nodeName);
      return input;
    }
    try {
      return await caller.run(input);
    } catch (error) {
      console.error('[FLOW_ERROR] Error running node:', {
        node: nodeName,
        error: error.message
      });
      throw error;
    }
  }

  // Process each import node's data
  const results = new Map();
  const comparisonResults = new Map();
  
  ${(() => {
    const importBlocks = project.blocks.filter(block => block.type === 'import');
    return importBlocks.map(block => {
      // Build the sequence of calls by traversing the graph
      const callSequence: Block[] = [];
      const processedNodes = new Set<string>();
      
      function buildSequence(nodeId: string) {
        if (processedNodes.has(nodeId)) return;
        processedNodes.add(nodeId);
        
        // Find all edges starting from this node
        const edges = project.edges
          .filter(edge => edge.source === nodeId)
          .sort((a, b) => {
            const aIndex = project.edges.findIndex(e => e.id === a.id);
            const bIndex = project.edges.findIndex(e => e.id === b.id);
            return aIndex - bIndex;
          });
        
        // Process each edge in order
        for (const edge of edges) {
          const targetBlock = project.blocks.find(b => b.id === edge.target);
          if (targetBlock && targetBlock.type === 'transform') {
            callSequence.push(targetBlock);
            buildSequence(targetBlock.id);
          }
        }
      }
      
      // Start building sequence from the import node
      buildSequence(block.id);
      
      return `  // Process data from import node: ${JSON.stringify(block.name || block.id)} (${maxItems ? 'processing ' + maxItems + ' items' : 'processing all items'})
  {
    const items = importResults.get(${JSON.stringify(block.id)}) || [];
    const itemsToProcess = items${maxItems !== undefined ? `.slice(0, ${maxItems})` : ''};
    
    console.log('[FLOW] Processing ' + itemsToProcess.length + ' items from ${JSON.stringify(block.name || block.id)}');
    
    // Create a map for this import node's results
    const nodeResults = [];
    results.set(${JSON.stringify(block.id)}, nodeResults);
    
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      try {
        // Log UI item update at the start of each iteration
        if (UI_LOGGING) {
          console.log('[FLOW_UI_LOG] ' + JSON.stringify({
            type: 'item_update',
            nodeId: ${JSON.stringify(block.id)},
            nodeName: ${JSON.stringify(block.name || block.id)},
            current: i + 1,
            total: itemsToProcess.length
          }));
        }

        console.log('[FLOW] Processing item ' + (i + 1) + '/' + itemsToProcess.length + ' from ${JSON.stringify(block.name || block.id)}');
        let result = item;
        let transformInput; // Declare once outside the transform loop
        
        // First run the import action if it exists
        const importCaller = callers[${JSON.stringify(block.id)}];
        if (importCaller) {
          const importInput = result;
          const importTime = new Date();
          console.log('[FLOW] conducting import: ${JSON.stringify(block.name || block.id)} (' + importTime.toISOString().slice(11, 23) + ')');
          result = await runCaller(${JSON.stringify(block.id)}, result, ${JSON.stringify(block.name || block.id)});
          
          // Log UI import if enabled
          if (UI_LOGGING) {
            console.log('[FLOW_UI_LOG] ' + JSON.stringify({
              type: 'import',
              nodeId: ${JSON.stringify(block.id)},
              nodeName: ${JSON.stringify(block.name || block.id)},
              input: importInput.output,
              output: result.output
            }));
          }
        }
        
        // Run all transforms in sequence if there are any
        ${callSequence.length > 0 ? callSequence.map((transformBlock, index) => `
        // Store the input before transformation
        transformInput = result;
        
        // Run the transform and store result
        const time_${transformBlock.id.replace(/[^a-zA-Z0-9]/g, '_')} = new Date();
        console.log('[FLOW] conducting transformation: ${JSON.stringify(transformBlock.name || transformBlock.id)} (' + time_${transformBlock.id.replace(/[^a-zA-Z0-9]/g, '_')}.toISOString().slice(11, 23) + ')');
        result = await runCaller(${JSON.stringify(transformBlock.id)}, result, ${JSON.stringify(transformBlock.name || transformBlock.id)});
        
        // Log UI transformation if enabled
        if (UI_LOGGING) {
          console.log('[FLOW_UI_LOG] ' + JSON.stringify({
            type: 'transform',
            nodeId: ${JSON.stringify(transformBlock.id)},
            nodeName: ${JSON.stringify(transformBlock.name || transformBlock.id)},
            input: transformInput.output,
            output: result.output
          }));
        }
        
        // Store the transform result under its own ID
        if (!results.has(${JSON.stringify(transformBlock.id)})) {
          results.set(${JSON.stringify(transformBlock.id)}, []);
        }
        results.get(${JSON.stringify(transformBlock.id)}).push(result);`).join('\n') : '// No transforms to run'}
        
        // Store the final result under the import node's ID
        nodeResults.push(result);
      } catch (error) {
        console.error('[FLOW_ERROR] Error processing item ' + (i + 1) + '/' + itemsToProcess.length + ':', {
          node: ${JSON.stringify(block.name || block.id)},
          error: error.message
        });
      }
    }
  }`;
    }).join('\n\n');
  })()}

  // Run all comparisons after all transforms are done
  ${(() => {
    const comparisonBlocks = project.blocks.filter(block => block.type === 'comparison');
    return comparisonBlocks.map(block => {
      const nodeInfo = nodeCodeMap.get(block.id);
      if (!nodeInfo) return '';

      // Find the two input sources for this comparison node
      const incomingEdges = project.edges.filter(e => e.target === block.id);
      if (incomingEdges.length !== 2) {
        console.warn('[FLOW_ERROR] Comparison node ${JSON.stringify(block.name || block.id)} requires exactly 2 inputs, found ' + incomingEdges.length);
        return '';
      }

      // Function to find the original import node
      function findSourceImportNode(nodeId: string): Block | undefined {
        const visited = new Set<string>();
        function traverse(currentId: string): Block | undefined {
          if (visited.has(currentId)) return undefined;
          visited.add(currentId);
          
          const currentBlock = project.blocks.find(b => b.id === currentId);
          if (!currentBlock) return undefined;
          
          if (currentBlock.type === 'import') return currentBlock;
          
          // Find incoming edges
          const incomingEdges = project.edges.filter(e => e.target === currentId);
          for (const edge of incomingEdges) {
            const result = traverse(edge.source);
            if (result) return result;
          }
          return undefined;
        }
        return traverse(nodeId);
      }

      const [source1, source2] = incomingEdges.map(e => e.source);
      const source1Import = findSourceImportNode(source1);
      const source2Import = findSourceImportNode(source2);

      return `  // Run comparison: ${JSON.stringify(block.name || block.id)}
  {
    const list1 = results.get(${JSON.stringify(source1)}) || [];
    const list2 = results.get(${JSON.stringify(source2)}) || [];
    
    try {
      // Log the comparison start
      console.log('[FLOW] Running comparison between ${JSON.stringify(source1Import?.name || source1)} and ${JSON.stringify(source2Import?.name || source2)}');
      
      const comparisonResult = await comparisonCallers[${JSON.stringify(block.id)}](list1, list2);
      comparisonResults.set(${JSON.stringify(block.id)}, comparisonResult);

      // Log UI comparison if enabled
      if (UI_LOGGING) {
        // Log the comparison details for inspection and UI state
        console.log('[FLOW_UI_LOG] ' + JSON.stringify({
          type: 'comparison_in_log',
          nodeId: ${JSON.stringify(block.id)},
          nodeName: ${JSON.stringify(block.name || block.id)},
          actionName: ${JSON.stringify(nodeInfo.action.name)},
          list1: ${JSON.stringify(source1Import?.name || source1)},
          list2: ${JSON.stringify(source2Import?.name || source2)},
          list1Size: list1.length,
          list2Size: list2.length,
          comparisonResult: comparisonResult
        }));
      }
    } catch (error) {
      console.error('[FLOW_ERROR] Error running comparison:', {
        node: ${JSON.stringify(block.name || block.id)},
        error: error.message
      });
    }
  }`;
    }).filter(Boolean).join('\n\n');
  })()}

  // Run all exports after all comparisons are done
  ${(() => {
    const exportBlocks = project.blocks.filter(block => block.type === 'export');
    if (exportBlocks.length === 0) return '';

    return `  // Process all exports
  {
    ${exportBlocks.map(block => {
      const nodeInfo = nodeCodeMap.get(block.id);
      if (!nodeInfo) return '';

      // Find the input source for this export node
      const incomingEdges = project.edges.filter(e => e.target === block.id);
      if (incomingEdges.length !== 1) {
        console.warn('[FLOW_ERROR] Export node ${block.name || block.id} requires exactly 1 input, found ' + incomingEdges.length);
        return '';
      }

      const source = incomingEdges[0].source;
      const sourceBlock = project.blocks.find(b => b.id === source);
      const isComparison = sourceBlock?.type === 'comparison';
      const sourceData = isComparison ? 'comparisonResults.get(\'' + source + '\')' : 'results.get(\'' + source + '\')';

      return `    // Export: ${block.name || block.id}
    {
      const data = ${sourceData};
      if (!data) {
        console.warn('[FLOW_ERROR] No data available for export:', safeStringify('${block.name || block.id}'));
        return;
      }
      
      try {
        const outputPath = '${block.outputPath}/${block.outputFilename}';
        if (!outputPath || outputPath === '/') {
          console.warn('[FLOW_ERROR] No output file specified for export:', safeStringify('${block.name || block.id}'));
          return;
        }
        
        const exportResult = await exportCallers['${block.id}'](data);
        
        // Save the export result to file
        fs.writeFileSync(
          outputPath,
          typeof exportResult === 'string' ? exportResult : JSON.stringify(exportResult, null, 2),
          'utf-8'
        );
        
        console.log('[FLOW] Export completed: ${block.name || block.id}');

        // Log UI export after completion if enabled
        if (UI_LOGGING) {
          console.log('[FLOW_UI_LOG] ' + JSON.stringify({
            type: 'export',
            nodeId: ${JSON.stringify(block.id)},
            nodeName: ${JSON.stringify(block.name || block.id)},
            actionName: ${JSON.stringify(nodeInfo.action.name)},
            outputPath: ${JSON.stringify(block.outputPath)},
            outputFilename: ${JSON.stringify(block.outputFilename)}
          }));
        }
      } catch (error) {
        console.error('[FLOW_ERROR] Error running export:', safeStringify({
          node: '${block.name || block.id}',
          error: error.message
        }));
      }
    }`;
    }).filter(Boolean).join('\n\n')}
  }`;
  })()}

  return { results, comparisonResults };
}

// Store the flow execution promise in a variable that can be awaited
const flowExecutionPromise = executeFlow().catch(error => {
  console.error('[FLOW_ERROR] Fatal error in flow execution:', error.message);
  throw error; // Re-throw to ensure the promise is rejected
});`;

  console.log('Generated code:', code);
  return code;
}

export default generateFlowCode;