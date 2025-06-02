# Aitomics UI

A local desktop application for managing Aitomics projects with a block-based code editor interface.

## Features

- Create and manage Aitomics projects
- Block-based code editor with support for implementing yourself (JS) via Aitomics.
- Drag-and-drop interface for arranging blocks
- Local storage for projects

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   cd src/renderer
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Building and Running

### Development Mode
Run the application in development mode with hot reloading:
```bash
npm run dev
```

### Production Build (Local)
Build and run the application in production mode locally:
```bash
# Build the application (includes preparing flow dependencies)
NODE_ENV=production npm run build

# Run the production build
NODE_ENV=production npm start
```

### Production Package
Create a distributable package of the application:
```bash
# This will build the application and create installers/packages
npm run package-app
```

### Flow Dependencies
The application uses a script to prepare flow dependencies during the build process. This ensures that all required packages are available for flow execution. The dependencies are:
- Prepared during the build process
- Stored in `build/flow-dependencies`
- Included in the final application package
- Automatically used by the application when executing flows

You can manually prepare the dependencies (if needed) using:
```bash
npm run prepare-flow-deps
```

## Project Structure

- `main.js` - Main Electron process
- `src/renderer/` - React application
  - `src/components/` - React components
  - `src/types/` - TypeScript type definitions
  - `src/preload.ts` - Electron preload script
- `scripts/` - Build and utility scripts
  - `prepare-flow-deps.js` - Script for preparing flow dependencies
  - `release.js` - Script for handling releases

## Application Logs

The application logs are stored in the following locations:

### macOS
- Log file: `~/Library/Application Support/aitomics-ui/app.log`
- Console.app: Search for "Aitomics UI" to view all logs including system-level information

### Windows
- Log file: `%APPDATA%\Aitomics UI\app.log`
- Event Viewer: Application logs can be found under "Windows Logs" > "Application"

The log file contains detailed information about:
- Application startup and initialization
- Flow execution and processing
- Error messages and stack traces
- UI state changes and user interactions

Logs are appended to the file each time the application runs, with timestamps and log levels (INFO, ERROR, WARN, DEBUG).