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

## Building for Production

1. Build the React application:
   ```bash
   cd src/renderer
   npm run build
   ```

2. Build the Electron application:
   ```bash
   npm run build
   ```

## Project Structure

- `main.js` - Main Electron process
- `src/renderer/` - React application
  - `src/components/` - React components
  - `src/types/` - TypeScript type definitions
  - `src/preload.ts` - Electron preload script