# Game Overlay API Guide

This guide provides developers with the necessary information to integrate the Game Overlay system into their applications. The API allows for creating custom overlay windows, handling input, and displaying UI elements on top of DirectX games.

## Getting Started

### Prerequisites

- Windows development environment
- Visual Studio 2019+ recommended
- DirectX SDK (if developing custom rendering)
- Basic understanding of C++ and Windows API

### Integration Overview

There are two main approaches to using the Game Overlay system:

1. **External Application Integration**
   - Create an external application that communicates with the overlay via IPC
   - Use the overlay DLL for rendering your UI elements in the target game

2. **Direct Game Integration**
   - Integrate the overlay code directly into your game
   - Useful for developers who have access to the game source code

## Core API Components

### Initialization

To initialize the overlay system:

```cpp
// From an external application:
// 1. Inject the overlay DLL into the target process
DWORD processId = GetTargetProcessId();
std::wstring dllPath = L"path/to/n_overlay.dll";
bool success = InjectDll(processId, dllPath.c_str());

// 2. Establish IPC connection
IpcLink ipcLink;
ipcLink.connect("n_overlay_1a1y2o8l0b");

// 3. Initialize overlay
overlay::OverlayInit init;
init.processEnabled = true;
init.shareMemMutex = "unique_mutex_name";
// Configure hotkeys, windows, etc.
SendMessage(init);
```

### Window Management

#### Creating a Window

```cpp
overlay::Window window;
window.windowId = GenerateUniqueId();  // Implement your own ID generation
window.name = "MyOverlayWindow";
window.transparent = true;  // For windows with transparency
window.resizable = true;    // Allow user resizing
window.rect = { 100, 100, 400, 300 };  // x, y, width, height
window.minWidth = 200;
window.minHeight = 150;
window.maxWidth = 800;
window.maxHeight = 600;
window.dragBorderWidth = 5;  // Border size for resize handles

// Optional: Configure caption area for dragging
overlay::WindowCaptionMargin caption;
caption.left = 10;
caption.right = 10;
caption.top = 0;
caption.height = 30;
window.caption = caption;

// Send the window creation message
SendMessage(window);
```

#### Updating Window Properties

```cpp
overlay::WindowBounds bounds;
bounds.windowId = myWindowId;
bounds.rect = { newX, newY, newWidth, newHeight };
SendMessage(bounds);
```

#### Closing a Window

```cpp
overlay::WindowClose close;
close.windowId = myWindowId;
SendMessage(close);
```

### Rendering to Overlay Windows

The overlay system uses shared memory for window content. Each window has a framebuffer that you can draw to:

```cpp
// After creating a window, you'll receive a framebuffer event
// Use the buffer name to access the shared memory
std::string bufferName = window.bufferName;

// Map the shared memory buffer
HANDLE mapFile = OpenFileMapping(FILE_MAP_ALL_ACCESS, FALSE, bufferName.c_str());
void* buffer = MapViewOfFile(mapFile, FILE_MAP_ALL_ACCESS, 0, 0, 0);
overlay_game::FrameBuffer* frameBuffer = static_cast<overlay_game::FrameBuffer*>(buffer);

// Draw to the buffer (example using simple RGBA writes)
uint8_t* pixels = frameBuffer->buffer;
int width = frameBuffer->width;
int height = frameBuffer->height;

// Example: Fill with red
for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) {
        int pixelPos = (y * width + x) * 4;
        pixels[pixelPos] = 255;     // R
        pixels[pixelPos + 1] = 0;   // G
        pixels[pixelPos + 2] = 0;   // B
        pixels[pixelPos + 3] = 255; // A
    }
}

// Notify that the buffer has been updated
overlay::WindowFrameBuffer updateMsg;
updateMsg.windowId = myWindowId;
SendMessage(updateMsg);

// When done, release the shared memory
UnmapViewOfFile(buffer);
CloseHandle(mapFile);
```

### Input Handling

#### Intercepting Input

To capture input for your overlay windows:

```cpp
// Begin intercepting input
overlay::InputInterceptCommand cmd;
cmd.intercept = true;
SendMessage(cmd);

// Stop intercepting input
cmd.intercept = false;
SendMessage(cmd);
```

#### Hotkey Configuration

```cpp
std::vector<overlay::Hotkey> hotkeys;

overlay::Hotkey toggleOverlay;
toggleOverlay.name = "ToggleOverlay";
toggleOverlay.keyCode = VK_F8;
toggleOverlay.alt = false;
toggleOverlay.ctrl = true;
toggleOverlay.shift = false;
toggleOverlay.passthrough = false;  // Don't pass to game

hotkeys.push_back(toggleOverlay);

// Register hotkeys
overlay::HotkeyInfo hotkeyInfo;
hotkeyInfo.hotkeys = hotkeys;
SendMessage(hotkeyInfo);
```

#### Responding to Hotkeys

```cpp
// When receiving an InGameHotkeyDown message
void OnHotkeyDown(const overlay::InGameHotkeyDown& hotkeyMsg) {
    if (hotkeyMsg.name == "ToggleOverlay") {
        // Toggle overlay visibility
        overlay::ShowHideCommand cmd;
        cmd.show = !isOverlayVisible;
        SendMessage(cmd);
        isOverlayVisible = !isOverlayVisible;
    }
}
```

### Additional Features

#### FPS Display

```cpp
// Show/hide FPS counter
overlay::FpsCommand cmd;
cmd.showfps = true;  // or false to hide
cmd.position = static_cast<uint32_t>(overlay::FpsPosition::TopRight);
SendMessage(cmd);
```

#### Cursor Customization

```cpp
// Set cursor type
overlay::CursorCommand cmd;
cmd.cursor = "arrow";  // Options: arrow, ibeam, hand, cross, wait, help, sizeall, etc.
SendMessage(cmd);
```

## Message Handling

To receive messages from the overlay:

```cpp
void ProcessOverlayMessage(const std::string& type, const std::string& message) {
    // Parse JSON message
    auto json = nlohmann::json::parse(message);
    
    if (type == "window.framebuffer") {
        // Handle framebuffer update
        auto msg = json.get<overlay::WindowFrameBuffer>();
        // Update the window with the new framebuffer content
    }
    else if (type == "game.hotkey.down") {
        // Handle hotkey press
        auto msg = json.get<overlay::InGameHotkeyDown>();
        OnHotkeyDown(msg);
    }
    // Handle other message types...
}
```

## Best Practices

1. **Performance Optimization**
   - Minimize framebuffer updates to reduce overhead
   - Only intercept input when necessary
   - Use transparent areas in windows when possible to minimize redraw

2. **Compatibility**
   - Test with various DirectX versions (9, 10, 11, 12)
   - Handle window resize events gracefully
   - Be prepared for hook failures in some games

3. **User Experience**
   - Provide clear hotkey information to users
   - Make overlay windows easily movable/resizable
   - Ensure overlay elements don't interfere with critical game UI

4. **Security**
   - Be aware that DLL injection may trigger anti-cheat systems
   - Consider alternative integration methods for games with strict anti-cheat

## Common Issues and Troubleshooting

### Injection Failures
- Check target process permissions
- Verify DLL path is correct
- Try alternative injection methods

### Rendering Issues
- Ensure proper DirectX version compatibility
- Check framebuffer dimensions match window size
- Verify alpha blending is handled correctly

### Input Problems
- Verify input interception is being toggled correctly
- Check if game uses custom input handling
- Ensure hotkeys don't conflict with game controls

## Sample Code

### Basic Overlay Application

```cpp
#include "overlay_api.h"

class MyOverlayApp {
private:
    IpcLink ipcLink_;
    uint32_t mainWindowId_;
    bool isConnected_ = false;
    bool isVisible_ = false;

public:
    bool Initialize() {
        // Connect to overlay
        isConnected_ = ipcLink_.connect("n_overlay_1a1y2o8l0b");
        if (!isConnected_) {
            return false;
        }

        // Set up message handler
        ipcLink_.setMessageCallback([this](const std::string& type, const std::string& msg) {
            this->HandleMessage(type, msg);
        });

        // Create main window
        overlay::Window window;
        window.windowId = 1;  // Simple ID for example
        window.name = "MainOverlay";
        window.transparent = true;
        window.rect = { 100, 100, 400, 300 };
        SendMessage(window);
        
        mainWindowId_ = window.windowId;
        isVisible_ = true;
        
        return true;
    }

    void ToggleVisibility() {
        isVisible_ = !isVisible_;
        
        overlay::ShowHideCommand cmd;
        cmd.show = isVisible_;
        SendMessage(cmd);
    }

    void SendMessage(const overlay::GMessage& msg) {
        json jsonMsg = msg.toJson();
        std::string msgStr = jsonMsg.dump();
        
        overlay::OverlayIpc ipcMsg;
        ipcMsg.type = msg.msgType();
        ipcMsg.message = msgStr;
        
        ipcLink_.sendMessage(ipcMsg);
    }

    void HandleMessage(const std::string& type, const std::string& msgStr) {
        // Process incoming messages
        // ...
    }
};
```

## Advanced Topics

### Custom Rendering
For advanced rendering needs, you may need to implement your own rendering logic using the appropriate DirectX version:

```cpp
// Example for DirectX 11
void RenderCustomOverlay(ID3D11DeviceContext* context, ID3D11RenderTargetView* rtv) {
    // Set render target
    context->OMSetRenderTargets(1, &rtv, nullptr);
    
    // Draw custom overlay elements
    // ...
    
    // Reset render target
    ID3D11RenderTargetView* nullRTV = nullptr;
    context->OMSetRenderTargets(1, &nullRTV, nullptr);
}
```

### Multi-Window Management
For complex overlays with multiple windows:

```cpp
class WindowManager {
private:
    std::map<uint32_t, OverlayWindow> windows_;
    uint32_t nextWindowId_ = 1;

public:
    uint32_t CreateWindow(const std::string& name, int x, int y, int width, int height) {
        uint32_t windowId = nextWindowId_++;
        
        overlay::Window window;
        window.windowId = windowId;
        window.name = name;
        window.rect = { x, y, width, height };
        // Configure additional properties
        
        SendMessage(window);
        
        windows_[windowId] = OverlayWindow(window);
        return windowId;
    }
    
    void DestroyWindow(uint32_t windowId) {
        if (windows_.find(windowId) != windows_.end()) {
            overlay::WindowClose close;
            close.windowId = windowId;
            SendMessage(close);
            
            windows_.erase(windowId);
        }
    }
    
    // Additional window management methods
};
``` 