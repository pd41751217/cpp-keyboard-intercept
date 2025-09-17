# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based game overlay application that creates real-time overlays on DirectX games (9/10/11/12). The system uses DLL injection to hook into game processes and provides high-performance rendering through shared memory.

### Core Architecture

- **app-electron**: Main Electron application that manages the overlay system
- **renderer-window**: Vite-based web application served on port 4000
- **overlay-window**: Vite-based web application served on port 4100 (renders the actual overlay content)
- **win-natives**: C++ DLL (`n_overlay.dll`) that gets injected into game processes for DirectX hooking
- **node-natives**: Node.js C++ addon (`overlay-api.node`) that bridges JavaScript and the native overlay system

## Development Commands

### Installation & Setup
```bash
npm install                    # Install dependencies
npm run natives:install        # Build and install all native components
```

### Building Native Components
```bash
npm run natives:build          # Build win-natives (C++ DLL and helper)
npm run natives:addon:build    # Build node-natives (Node.js addon)
```

### Running the Application
```bash
npm start                      # Start all services in parallel
npm run app-electron:serve     # Start only the Electron app
npm run renderer-window:serve  # Start only the renderer window (port 4000)
npm run overlay-window:serve   # Start only the overlay window (port 4100)
```

### Individual NX Commands
```bash
nx serve app-electron          # Build and run Electron app
nx serve renderer-window       # Serve renderer window with Vite
nx serve overlay-window        # Serve overlay window with Vite
nx run app-electron:copy-natives  # Copy native binaries to dist
```

## Key Components

### OverlayApiLib (`apps/app-electron/src/native/overlay-api/overlay-api.lib.ts`)
- Main TypeScript facade for the overlay system
- Manages DLL injection, window creation, and IPC communication
- Provides keyboard interception and remapping capabilities
- Handles game hook lifecycle and process monitoring

### OverlayNodeApi Interface (`apps/app-electron/src/native/overlay-api/interfaces/overlay-lib.interface.ts`)
- TypeScript interface that defines the native addon API
- Key methods: `injectProcess()`, `addWindow()`, `sendFrameBuffer()`, `setEventCallback()`
- Supports keyboard remapping, blocking, and injection commands

### Native Addon (`apps/app-electron/src/native/overlay-api/node-natives/`)
- C++ Node.js addon built with CMake and cmake-js
- Uses N-API for JavaScript bindings
- Implements IPC communication with injected DLL
- Manages shared memory for high-performance frame buffer transfers

### Game Injection System
- `n_overlay.dll`: Injected into target game processes
- `n_ovhelper.exe`: Helper executable for DLL injection
- Hooks DirectX APIs to render overlay content
- Intercepts keyboard/mouse input when enabled

## Development Workflow

### Target Game Configuration
Edit `apps/app-electron/src/GAME_TO_HOOK.ts` to specify which game window to target:
```typescript
export const GAME_TO_HOOK = {
  id: 'forager',
  windowName: 'Forager by HopFrog'  // Window title to match
};
```

### Frame Rendering Flow
1. Overlay content is rendered in the overlay-window (port 4100)
2. Electron captures the frame via `paint` event
3. Frame data is sent to the injected DLL via `sendFrameBuffer()`
4. DLL renders the overlay on top of the game's DirectX surface

### Keyboard Interception
The system supports multiple keyboard modes:
- `monitor`: Only observe key events
- `block_only`: Block specified keys
- `block_and_replace`: Block keys and inject replacements
- `selective_remap`: Remap specific keys to others

## Build Requirements

- **Node.js**: >= 20.0.0
- **Visual Studio**: 2022 with C++ build tools
- **CMake**: For building the Node.js addon
- **Electron**: 34.2.0 (specified in cmake-js config)

## Important Files

- `apps/app-electron/src/main.ts`: Application entry point and initialization
- `apps/app-electron/public/overlay-api.node`: Pre-built native addon
- `apps/app-electron/public/n_overlay.dll`: DirectX hooking DLL (x86/x64 versions)
- `apps/app-electron/public/injector_helper.exe`: DLL injection helper

## Testing & Debugging

- The application opens a browser window showing google.com by default
- The overlay renders on games matching the configured window name
- Check console logs for injection status and IPC communication
- Use `nx lint` for code linting (if available)

## Architecture Notes

- Built with Nx monorepo structure
- Uses RxJS for reactive programming and event handling
- Electron offscreen rendering with shared texture support (commented out)
- IPC communication uses named pipes for cross-process messaging
- Based on the goverlay project (https://github.com/hiitiger/goverlay)

## Security Considerations

This project implements DLL injection and game hooking techniques for legitimate overlay purposes. The native components should only be used with games you own and in accordance with their terms of service.