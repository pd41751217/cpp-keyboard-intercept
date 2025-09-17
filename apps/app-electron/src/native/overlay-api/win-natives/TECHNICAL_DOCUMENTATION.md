# Game Overlay Technical Documentation

## Architecture Overview

The Game Overlay system is designed as a modular framework for injecting custom UI elements into DirectX-based games. The architecture follows a client-server model where the overlay DLL (n_overlay.dll) is injected into the target game process and communicates with external applications through an IPC mechanism.

## Key Components

### 1. Core Components

#### n_overlay
The main DLL that gets injected into the target game process. It provides the following functionality:
- DirectX API hooking (DX9, DX10, DX11, DX12)
- Rendering of overlay UI elements
- Input handling and interception
- Window management
- IPC communication

#### n_ovhelper
Helper application that handles injecting the overlay DLL into the target process using methods like:
- CreateRemoteThread + LoadLibrary for "unsafe" injection
- SetWindowsHookEx for "safer" injection

#### Detours
Microsoft library used for API hooking, allowing functions to be intercepted and redirected.

### 2. Technical Subsystems

#### Hooking Mechanism
The hooking system is built around the `ApiHook` template class which uses Microsoft Detours to intercept DirectX API calls. The main hooks include:

```cpp
template <class Fn>
struct ApiHook
{
    Fn ppOriginal_ = nullptr;
    std::wstring name_;
    DWORD_PTR *pTarget_ = nullptr;
    DWORD_PTR *pHooked_ = nullptr;
    bool actived_ = false;

    // ... methods for activating/deactivating hooks
}
```

Key hooks include:
- **Graphics API Hooks**: D3D9 Present/EndScene, DXGI Present/SwapChain methods
- **Input Hooks**: Windows message processing, keyboard and mouse input
- **Window Procedure Hooks**: For intercepting window messages

#### IPC System
Inter-process communication is handled through a custom IPC implementation:

- **IpcMsg**: Base class for all IPC messages
- **MsgPacker/MsgUnpacker**: Serialization/deserialization of messages
- **IpcLink**: Communication channel between processes

#### Message System
Game Overlay uses a JSON-based message system defined in `gmessage.hpp` for communication between components:

- **GMessage**: Base class for all messages
- **Message Types**:
  - **Window Management**: Window, WindowClose, WindowBounds, etc.
  - **Input Control**: InputInterceptCommand, GameInput, etc.
  - **Graphics Information**: GraphicsHookInfo, GraphicsFps, etc.
  - **System Commands**: ShowHideCommand, FpsCommand, etc.

#### Overlay Rendering
The overlay rendering system supports multiple DirectX versions:

- **DirectX 9**: Uses EndScene/Present hooks
- **DirectX 10/11/12**: Uses DXGI Present/SwapChain hooks
- **Sprites**: Custom sprite rendering for UI elements

## Technical Workflow

### Injection Process

1. **DLL Injection**:
   ```cpp
   bool unsafeInjectDll(DWORD dwProcessId, PCWSTR pszLibFile)
   {
       // Allocate memory in target process
       // Write DLL path to allocated memory
       // Create remote thread calling LoadLibraryW
   }
   ```

2. **Hook Installation**:
   ```cpp
   bool activeHook()
   {
       if (DetourTransactionBegin() != NO_ERROR)
           return false;
       if (DetourUpdateThread(GetCurrentThread()) != NO_ERROR)
           return false;
       if (DetourAttach((PVOID*)&pTarget_, pHooked_) != NO_ERROR)
       {
           DetourTransactionAbort();
       }
       else
       {
           actived_ = DetourTransactionCommit() == NO_ERROR;
           ppOriginal_ = force_cast<DWORD_PTR*, Fn>(pTarget_);
       }
       
       return succeed();
   }
   ```

### Rendering Process

1. **Hook DirectX APIs**:
   - D3D9: EndScene, Present, Reset
   - DXGI: Present, ResizeBuffers

2. **Render Overlay**:
   - Capture game's render target
   - Draw overlay UI elements
   - Present modified frame

3. **Sprite Rendering**:
   - Each DirectX version has its own sprite implementation
   - Custom shaders for rendering text and UI elements

### Input Handling

1. **Hook Windows Input**:
   - SetWindowsHookEx for GetMessage/CallWndProc
   - Custom WindowProc for the game window

2. **Input Interception**:
   ```cpp
   bool shouldBlockOrginalMouseInput();
   bool shouldBlockOrginalKeyInput();
   ```

3. **Event Propagation**:
   - Filter input events to determine if they should be handled by overlay or passed to the game
   - Support for hotkeys with modifiers (Ctrl, Alt, Shift)

## Window Management

The overlay system manages multiple windows:

```cpp
struct Window : public GMessage
{
    std::uint32_t windowId;
    std::uint32_t nativeHandle;
    std::string name;
    bool transparent = false;
    bool resizable = false;
    std::uint32_t maxWidth = 0;
    std::uint32_t maxHeight = 0;
    std::uint32_t minWidth = 0;
    std::uint32_t minHeight = 0;
    std::uint32_t dragBorderWidth = 0;

    std::string bufferName;
    WindowRect rect;
    std::optional<WindowCaptionMargin> caption;
};
```

Window features include:
- Transparency support
- Resizable windows with min/max constraints
- Custom window captions
- Drag-and-drop support
- Focus handling

## API Integration

### Hooking a Game Process

```cpp
// 1. Inject DLL into target process
// 2. Initialize overlay in DLL_PROCESS_ATTACH
INT WINAPI DllMain(HINSTANCE hModule, DWORD dwReason, LPVOID)
{
    if (dwReason == DLL_PROCESS_ATTACH)
    {
        DisableThreadLibraryCalls((HMODULE)hModule);
        g_moduleHandle = hModule;
        HookApp::initialize();
    }
    // ...
}

// 3. Set up DirectX hooks
void HookApp::initialize()
{
    // Initialize various hooks
    // Set up IPC connection
    // Initialize overlay system
}
```

### Creating an Overlay Window

To create an overlay window, send a Window message via IPC:

```cpp
Window window;
window.windowId = generateUniqueId();
window.name = "MyOverlayWindow";
window.rect = { x, y, width, height };
window.transparent = true;
window.resizable = true;
// ... set additional properties
```

### Input Interception

To intercept input for overlay UI:

```cpp
InputInterceptCommand cmd;
cmd.intercept = true;
// Send via IPC
```

## Performance Considerations

- **Memory Usage**: Shared memory for window buffers
- **CPU Overhead**: Minimal due to direct rendering hooks
- **Graphics Impact**: Negligible when no overlay windows are visible
- **Compatibility**: Supports multiple DirectX versions for broad game compatibility

## Security Considerations

- DLL injection can trigger anti-cheat systems
- Uses both "unsafe" and "safe" injection methods
- Game compatibility varies based on anti-cheat protection

## Debugging Techniques

- Logging system for tracking hook installation and API calls
- Support for debug console output (`//trace::DebugConsole::allocDebugConsole()`)
- FPS counter to monitor performance impact

## Extension Points

- Support for additional graphics APIs (Vulkan, OpenGL)
- Custom rendering effects for overlay elements
- Additional input handling methods
- New window types and behaviors 