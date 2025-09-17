# Game Overlay

A powerful system for rendering custom UI overlays on top of DirectX games.

## Features

- Supports DirectX 9, 10, 11, and 12
- Injects seamlessly into target processes
- Provides API for custom UI rendering
- Handles input interception and event forwarding
- Thread-safe communication between processes

## Components

- **n_overlay**: Core DLL for DirectX hooking and rendering
- **n_ovhelper**: Helper application for DLL injection
- **Demo applications**: Examples for different DirectX versions

## Building

1. Open `gameoverlay.sln` in Visual Studio
2. Build for Win32 or x64 platform
3. Or use `build.bat` to build all configurations

## Usage

See the demo applications for integration examples. Basic steps:

1. Inject `n_overlay.dll` into target process
2. Create and manage overlay windows
3. Handle input events as needed

## Documentation

For more detailed information, see the [DOCUMENTATION.md](DOCUMENTATION.md) file.