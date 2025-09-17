# Overlay API – Node-Native Addon

> Native **N-API** bindings that expose Dixper's _overlay_ engine to JavaScript / TypeScript. These bindings let you inject a lightweight DLL into any running Windows process and exchange high-performance IPC messages for real-time overlays, input interception, and in-game telemetry.

## Internal C/C++ Architecture

This native module connects JavaScript with Windows native APIs to create in-game overlays. Below is a description of its architecture, components, and operational flow.

### General Structure

The system consists of three main elements:

1. **Native Node Module**: A `.node` library that implements bindings between JavaScript and native C++ code
2. **Injectable DLL**: A DLL that gets injected into game processes to capture graphics and intercept input
3. **IPC System**: An inter-process communication mechanism that enables bidirectional message passing

### Code Organization

```
src/
├── main.cc               # Entry point and N-API bindings
├── overlay.h             # Main controller class
├── utils/                # Utilities for Windows, shared memory, etc.
├── ipc/                  # Inter-process communication system
├── message/              # Message protocol definitions
└── 3rd/                  # Third-party dependencies
```

## Main Components

### 1. Native Node Module (main.cc)

This component acts as a bridge between JavaScript and C++, exposing functions that can be called from Node.js. It defines entry points that correspond to the JavaScript API:

- `start()` / `stop()`: Initialization and resource cleanup
- `setEventCallback()`: Registration of callback for overlay events
- `addWindow()` / `closeWindow()`: Overlay window management
- `sendFrameBuffer()`: Transmission of graphical content
- `injectProcess()`: DLL injection into target processes
- `setHotkeys()`: Configuration of global keyboard shortcuts

The module uses N-API (Node's Native API) to make it possible to call these methods from JavaScript efficiently and safely across Node versions.

### 2. Main Controller (overlay.h)

The `OverlayMain` class acts as the central orchestrator of the system. Its responsibilities include:

- Managing DLL injection into target processes
- Maintaining IPC connections with injected processes
- Tracking active overlay windows
- Managing shared graphic buffers
- Propagating events from games to JavaScript

This component maintains the system state and coordinates all interactions between Node.js processes and injected games.

### 3. Shared Memory System

To transfer graphical data between processes efficiently, the system uses shared memory instead of standard IPC communication:

- A shared memory segment is created for each overlay window
- BGRA buffers (images with alpha channel) are transmitted through this memory
- Minimizes memory copies to improve performance
- Allows real-time visual data transmission without overloading IPC

The implementation uses Windows APIs `CreateFileMapping` and `MapViewOfFile` to create memory regions accessible from both processes.

### 4. IPC Communication System

Communication between the Node.js process and injected game processes is performed through a custom IPC system based on named pipes:

- Typed and versioned message protocol
- Automatic serialization of structures to JSON
- Bidirectional host-client connection
- Support for multiple clients connected simultaneously

## Operational Flow

The system operates following these sequential steps:

### 1. Initialization

1. The JavaScript application calls `Overlay.start()`
2. An instance of `OverlayMain` is created in C++
3. The IPC server is started to listen for connections from injected processes
4. An event callback is registered to communicate what happens in the game back to JavaScript

### 2. DLL Injection

1. The application identifies a target game process (e.g., via `getTopWindows()`)
2. It calls `injectProcess()` with the process ID
3. The system:
   - Opens a handle to the target process
   - Determines if it's 32 or 64-bit to select the appropriate DLL
   - Allocates memory in the address space of the remote process
   - Writes the DLL path to that memory
   - Creates a remote thread that executes LoadLibrary with that path
   - The DLL initializes within the game process
4. The DLL establishes an IPC connection back to the host

### 3. Graphics System Hooks

Once inside the game process, the injected DLL:

1. Detects which graphics API the game is using (DirectX 9/10/11/12, OpenGL, or Vulkan)
2. Installs hooks at key functions in the graphics pipeline:
   - For DirectX: hooks on Present, EndScene, SwapChain
   - For OpenGL: hooks on SwapBuffers, wglSwapBuffers
   - For Vulkan: hooks on vkQueuePresentKHR
3. Notifies the host about the graphics window characteristics (resolution, etc.)
4. Begins sending FPS data and resize events

These hooks allow the system to insert its own rendering just before the frame is presented on screen.

### 4. Input Hook Installation

To capture or intercept user input:

1. The DLL installs hooks in the window procedure (WindowProc) of the game
2. It intercepts keyboard and mouse messages (WM_KEYDOWN, WM_MOUSEMOVE, etc.)
3. Depending on the configuration:
   - It can forward these events to the host for notification
   - It can block these events (not passing them to the original game)
   - It can let them pass normally

This mechanism allows both monitoring and controlling user input.

### 5. Overlay Window Creation

When JavaScript requests creating an overlay window:

1. It calls `addWindow()` with parameters such as dimensions, position, etc.
2. The system:
   - Creates a unique identifier for the window
   - Allocates a shared memory segment for its graphical data
   - Notifies the injected processes about the new window
3. The DLL in the game creates the necessary graphical resources:
   - Textures to store the visual content
   - Shaders for rendering with transparency
   - Structures for tracking position/size

### 6. Overlay Content Rendering

The graphical data flow follows this path:

1. JavaScript generates visual content (via Canvas, WebGL, etc.)
2. It obtains the pixel data in RGBA/BGRA format
3. It calls `sendFrameBuffer()` with the buffer and dimensions
4. The system writes this data directly to shared memory
5. It notifies the game process that a new frame is available
6. In the next rendering cycle of the game, the DLL:
   - Reads the data from shared memory
   - Updates the corresponding texture
   - Renders this texture over the game frame
   - Allows the modified frame to be presented on screen

This process occurs for each frame, enabling fluid animations.

### 7. Event System

Events flow bidirectionally:

**From game to JavaScript:**

1. The DLL detects an event (input, FPS change, resize, etc.)
2. It creates a typed IPC message with the event details
3. It sends it to the host through the IPC channel
4. The host deserializes the message
5. It invokes the JavaScript callback registered with `setEventCallback()`
6. The JavaScript application reacts to the event

**From JavaScript to game:**

1. JavaScript calls methods like `sendCommand()` or `setHotkeys()`
2. The host serializes the parameters into an IPC message
3. It sends this message to the relevant injected processes
4. The DLL executes the corresponding action (change cursor, show FPS, etc.)

## IPC Message Types

The system uses various message types for inter-process communication:

| Message Type              | Direction  | Purpose                                  |
| ------------------------- | ---------- | ---------------------------------------- |
| GameProcessInfo           | DLL → Host | Reports injected game process            |
| OverlayInit               | Host → DLL | Initializes overlay with configuration   |
| GameInput                 | DLL → Host | Notifies input events                    |
| GameInputIntercept        | Host → DLL | Activates/deactivates input interception |
| WindowFrameBuffer         | Host → DLL | Sends new frame for overlay window       |
| GraphicsWindowSetup       | DLL → Host | Reports detected game window             |
| GraphicsWindowRezizeEvent | DLL → Host | Notifies size change                     |
| GraphicsFps               | DLL → Host | Reports current FPS                      |
| InGameHotkeyDown          | DLL → Host | Notifies pressed hotkey                  |

### Communication Diagram

```
  ┌─────────────────┐                 ┌───────────────────┐
  │  Node Process   │                 │  Game Process     │
  │                 │                 │                    │
  │ ┌─────────────┐ │  1. Injection   │ ┌───────────────┐ │
  │ │ overlay-api │─┼─────────────────┼─▶    n_overlay  │ │
  │ └─────────────┘ │                 │ └───────┬───────┘ │
  │       │         │                 │         │         │
  │       │         │  2. IPC Connect │         │         │
  │       │◀────────┼─────────────────┼─────────┘         │
  │       │         │                 │                    │
  │       │         │  3. Events      │                    │
  │       │◀────────┼─────────────────┼────────────────────┤
  │       │         │                 │                    │
  │       │         │  4. Commands    │                    │
  │       │─────────┼─────────────────┼───────────────────▶│
  │       │         │                 │                    │
  │       │         │  5. Framebuffer │                    │
  │       │─────────┼─────────────────┼───────────────────▶│
  └─────────────────┘                 └───────────────────┘
```

## Technical Challenges Solved

### 1. Secure Code Injection

DLL injection is a complex technique that requires handling:

- Differences between 32 and 64-bit processes
- Process access permissions
- Safe initialization within the remote process
- Clean release of resources upon termination

### 2. Graphics API Hooks

The system implements advanced hooking techniques:

- Dynamic detection of graphics APIs used
- Runtime hook installation
- Preservation of original behavior
- Compatibility with multiple DirectX/OpenGL versions

### 3. Shared Memory Performance

To maintain high performance:

- Shared memory is pre-allocated to the maximum window size
- The number of memory copies is minimized
- Efficient rendering techniques are used
- Synchronization mechanisms are implemented to prevent data corruption

### 4. Cross-Process Compatibility

The system ensures compatibility:

- Between 32/64-bit processes
- Across different Windows versions
- With various game engines and graphics configurations
- With common anti-cheat protection systems

## Typical Use Cases

1. **Informational overlays**: Display statistics, notifications, or additional information about the game
2. **Custom interfaces**: Add controls and interfaces not present in the original game
3. **Behavior modification**: Intercept input to implement new mechanics
4. **Telemetry and analysis**: Capture data about game performance and behavior
