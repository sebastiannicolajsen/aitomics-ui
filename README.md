# Aitomics UI

A local desktop application for managing Aitomics projects with a block-based code editor interface.

## Requirements

This application requires [LM Studio](https://lmstudio.ai/) to be installed on your system, as `aitomics` and `aitomics-ui` rely on it for local language model operations. Please ensure you have LM Studio installed before proceeding with the installation (you will use this tool to install models locally).

# Install

## Release Version
Download the latest release for your operating system:
- **macOS**: Download the `.dmg` file from the [latest release](https://github.com/aitomics/aitomics-ui/releases/latest)
- **Windows**: Download the `.exe` installer from the [latest release](https://github.com/aitomics/aitomics-ui/releases/latest)

If you encounter any issues during installation or usage, please check the [Application Logs](#application-logs) section for troubleshooting.


## Features

### 1. Create flows for handling analysis of various data sources

![Create flows](docs/media/aitomics-1.gif)

### 2. Create custom actions using aitomics or pure javascript

![Custom actions](docs/media/aitomics-2.gif)

### 3. Execute your flows using various llms

![Execute flows](docs/media/aitomics-3.gif)

### 4. Get detailed feedback during execution

![Execution feedback](docs/media/aitomics-4.gif)


### In addition....

- Export the code to run yourself or modify it.
- Export different formats, including rich data formats from `aitomics` to track changes.
- Create comparisons between multiple data flows, e.g., between sentiment analysis and human codes. 
- The app comes with a standard project which uses the file [here](https://github.com/sebastiannicolajsen/aitomics-ui/blob/main/data/customer_reviews.json) as input for both flows (you determine your output files).

## Development Setup

Follow these steps to set up the development environment:

1. **Prerequisites**
   - Install [Node.js](https://nodejs.org/) (LTS version recommended)
   - Install [Git](https://git-scm.com/downloads)
   - A code editor (like [Visual Studio Code](https://code.visualstudio.com/))

2. **Clone the Repository**
   ```bash
   # Clone the repository
   git clone https://github.com/aitomics/aitomics-ui.git
   
   # Navigate into the project directory
   cd aitomics-ui
   ```

3. **Install Dependencies**
   ```bash
   # Install main dependencies
   npm install
   
   # Install renderer dependencies
   cd src/renderer
   npm install
   cd ../..  # Return to root directory
   ```

4. **Start Development Server**
   ```bash
   # Start the application in development mode
   npm run dev
   ```

The application should now open in development mode with hot reloading enabled. Any changes you make to the code will automatically refresh the application.

If you encounter any issues during setup or development, please check the [Application Logs](#application-logs) section for troubleshooting.



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

The application logs contain detailed information about:
- Application startup and initialization
- Flow execution and processing
- Error messages and stack traces
- UI state changes and user interactions

Logs are appended to the file each time the application runs, with timestamps and log levels (INFO, ERROR, WARN, DEBUG).

### Log File Locations

#### macOS
- Log file: `~/Library/Application Support/aitomics-ui/app.log`
- Console.app: Search for "Aitomics UI" to view all logs including system-level information

#### Windows
- Log file: `%APPDATA%\Aitomics UI\app.log`
- Event Viewer: Application logs can be found under "Windows Logs" > "Application"