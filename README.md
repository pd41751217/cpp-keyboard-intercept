# Electron App

## Installation

1. Clone the repository
2. Run `npm install` to install all required dependencies

## Compile Native Components

1. Run `npm run natives:build` to compile the native libraries and automatically copy them to the app-electron/public folder
2. Run `npm run natives:addon:build` to compile the addon module and copy it to the app-electron/public folder

## Running the Application

1. Run `npm run start` to launch the application. This will:

   - Copy all native components to the dist folder
   - Build the application and copy it to the dist folder
   - Start the renderer-window to serve the overlay-api on port 4000
   - Start the overlay-window to serve the overlay-api on port 4100
   - Open an Electron window displaying google.com and another hidden window with the overlay-api
   - By default, the app-electron will hook into the window titled "Forager by HopFrog" (you can modify this target in the main.ts file)

2. Launch your game and verify that the overlay-api is properly rendering inside the game window

# Native Libraries Overview

The native components are split into two main parts: `win-natives` and `node-natives`.

## `win-natives`

This library contains the core logic for the game overlay functionality on Windows.

- **`n_overlay`**: The primary DLL responsible for hooking into DirectX APIs (DX9, 10, 11, 12) within the target game process. It handles rendering the overlay UI, managing overlay windows, and processing input.
- **`n_ovhelper`**: A helper executable used to inject the `n_overlay.dll` into the target game process.
- **Detours**: Utilizes the Microsoft Detours library for function hooking.
- **IPC**: Implements an Inter-Process Communication mechanism for communication between the overlay DLL and external applications (like the Node.js addon).

## `node-natives`

This is a Node.js C++ addon that acts as a bridge between the JavaScript/Electron environment and the `win-natives` overlay library.

- **Binding**: Provides JavaScript bindings to the `win-natives` API, allowing the Electron application to control the overlay (e.g., create windows, send frame data, manage input).
- **Communication**: Facilitates the IPC connection with the `n_overlay.dll` running inside the game process.
- **Integration**: Simplifies the interaction with the native overlay code from the Electron application's main and renderer processes.

### `OverlayNodeApi` Interface

The communication between the Electron application (JavaScript/TypeScript) and the `node-natives` addon is defined by the `OverlayNodeApi` interface (`apps/app-electron/src/native/overlay-api/interfaces/overlay-lib.interface.ts`). This interface exposes the native functionalities to the JS side, enabling actions such as:

- Injecting the overlay into a game process (`injectProcess`).
- Managing overlay windows (`addWindow`, `closeWindow`, `sendWindowBounds`).
- Sending frame data for rendering (`sendFrameBuffer`, `sendSharedTextureHandle`).
- Handling input events (`startGameInputIntercept`, `stopGameInputIntercept`, `translateInputEvent`).
- Configuring hotkeys and other settings (`setHotkeys`, `sendCommand`).
- Receiving events from the native layer (`setEventCallback`).

## How `overlay-api` Works Under the Hood

The TypeScript façade you import as `OverlayApiLib` is just a thin wrapper on top of the pre-built native addon `overlay-api.node`. This addon exposes the `OverlayNodeApi` interface described above and performs three main tasks:

1. **IPC bridge** – Maintains a bi-directional IPC channel with the injected `n_overlay.dll` that lives inside the game process.
2. **Resource management** – Marshals shared memory buffers/texture handles between Electron and the overlay DLL, translating JS friendly types (`Buffer`, numbers) into the raw handles expected by DirectX.
3. **Event pump** – Propagates asynchronous events coming from the native layer back to the JavaScript world through `setEventCallback`.

### Typical Frame Flow

1. The hidden off-screen Electron window paints a new frame.
2. A `paint` event is emitted in the main process:
   - **CPU path** – `image.getBitmap()` is copied into a Node `Buffer` and delivered via `sendFrameBuffer`. Every frame incurs a full GPU→CPU→GPU copy.
3. Inside the game process the DLL receives the shared handle, opens it with `OpenSharedResource` and renders it directly on the in-game swap chain.

### Game Hooking Lifecycle

1. `startInjectInterval()` polls `overlayApi.getTopWindows()` every 5 s.
2. Matching windows are sent to `overlayApi.injectProcess()`, which in turn runs `n_ovhelper.exe` to inject the DLL.
3. When the DLL is fully initialised it emits `game.hook` and `graphics.window` events that are captured through `setEventCallback`.
4. `OverlayApiLib` updates its internal `AppsManager` state machine and keeps emitting higher-level observables such as `onHook$`.

# Based on Goverlay project

https://github.com/hiitiger/goverlay
