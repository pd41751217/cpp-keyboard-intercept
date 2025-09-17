# Game Overlay Documentation

## Project Overview

This project implements a game overlay system that allows rendering custom UI elements on top of DirectX games. The overlay works by hooking into DirectX (9, 10, 11, and 12) APIs and injecting custom rendering code. It consists of several components that work together to provide a seamless overlay experience.

## Key Components

### 1. Main Components

- **n_overlay**: The core DLL that gets injected into target game processes to render the overlay
- **n_ovhelper**: A helper application that handles the injection process
- **Detours**: Microsoft library used for API hooking
- **corelib**: Core utility library used by the overlay system
- **demo**: Demo applications demonstrating overlay functionality with different DirectX versions

### 2. Architecture

The project follows a client-server architecture:
- The overlay DLL (n_overlay) is injected into the game process
- It hooks into DirectX APIs to intercept and modify rendering calls
- It communicates with external applications through IPC
- It handles window management, input, and rendering for overlay UI elements

## Project Structure

```
/
├── bin/                   # Output directory for compiled binaries
├── Detours/               # Microsoft Detours library for API hooking
├── deps/                  # Dependencies
│   └── src/
│       └── corelib/       # Core utility library
├── demo/                  # Demo applications
│   ├── dx9app/            # DirectX 9 demo
│   ├── dx10app/           # DirectX 10 demo
│   └── dx11app/           # DirectX 11 demo
├── n_overlay/             # Core overlay module
│   ├── graphics/          # Graphics-related code (DirectX hooks and rendering)
│   ├── hook/              # Hooking mechanisms
│   ├── hotkey/            # Hotkey handling
│   ├── ipc/               # Inter-process communication
│   ├── message/           # Message handling
│   └── overlay/           # Core overlay functionality
├── n_ovhelper/            # Helper application for DLL injection
└── prebuilt/              # Pre-built binaries
```

## Core Components Detail

### n_overlay

The main DLL that gets injected into the target game process. It handles:
- DirectX API hooking (DX9, DX10, DX11, DX12)
- Rendering overlay UI elements
- Processing user input
- Window management
- IPC communication

Key files:
- `n_overlay/main.cpp`: Entry point for the DLL
- `n_overlay/overlay/overlay.h/cc`: Core overlay implementation
- `n_overlay/overlay/session.h/cc`: Session management
- `n_overlay/overlay/hookapp.h/cc`: Application hooking
- `n_overlay/overlay/uiapp.h/cc`: UI application logic

### n_ovhelper

Helper application that handles injecting the overlay DLL into the target process.

Key files:
- `n_ovhelper/main.cpp`: Implements DLL injection logic

### Graphics Hooks

The overlay supports multiple DirectX versions:
- DirectX 9: `n_overlay/graphics/d3d9hook.h/cc`
- DirectX 10: `n_overlay/graphics/d3d10graphics.h/cc`
- DirectX 11: `n_overlay/graphics/d3d11graphics.h/cc`
- DirectX 12: `n_overlay/graphics/d3d12graphics.h/cc`
- DXGI (Common): `n_overlay/graphics/dxgihook.h/cc`

## Building the Project

The project uses Visual Studio for building. 

1. Open `gameoverlay.sln` in Visual Studio
2. Build the solution for your target platform (Win32 or x64)
3. Alternatively, use the provided `build.bat` script which will:
   - Build the solution for both Win32 and x64 platforms in Release configuration
   - Copy the built binaries to the prebuilt directory

## Using the Overlay

To use the overlay in a game:

1. Inject the n_overlay.dll into the target game process using n_ovhelper
2. The overlay will hook into the game's DirectX APIs
3. Create and manage overlay windows through the API

## Demo Applications

The project includes several demo applications that demonstrate how the overlay works with different DirectX versions:
- `demo/dx9app`: DirectX 9 demo
- `demo/dx10app`: DirectX 10 demo
- `demo/dx11app`: DirectX 11 demo

These demos serve as examples of how to integrate with the overlay system.

## Technical Details

### Injection Methods

The project uses two injection methods:
1. **Unsafe Injection**: Using CreateRemoteThread and LoadLibrary
2. **Safe Injection**: Using SetWindowsHookEx

### Rendering Process

1. The overlay hooks into DirectX Present/ExecuteCommandList calls
2. It renders overlay UI elements before the game's frame is presented
3. It uses shared memory for communication between processes

### Input Handling

The overlay can intercept and process input events before they reach the game, allowing for overlay-specific input handling.

## Getting Started for New Developers

1. Clone the repository
2. Open gameoverlay.sln in Visual Studio
3. Build the solution
4. Run one of the demo applications
5. Study the demo code to understand how to integrate with your own application 