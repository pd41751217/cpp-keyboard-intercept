#include "stable.h"
#include "session.h"
#include "overlay.h"
#include "uiapp.h"
#include "hookapp.h"
#include "hook/inputhook.h"
#include "hotkey/hotkeycheck.h"

#if ALLOW_ASSOC_SYSIME
#pragma comment(lib, "imm32.lib")
#endif


#define  OVERLAY_MAGIC 0x908988
#define  OVERLAY_TASK 0x908987

const bool g_use_wndproc_hook = true;

UiApp::UiApp()
{
    overlayMagicMsg_ = RegisterWindowMessageW(L"n_overlay_0x010101");
    if (overlayMagicMsg_ == 0)
    {
        overlayMagicMsg_ = WM_USER + 0x88;
    }

    HookApp::instance()->overlayConnector()->remoteConnectEvent().add([this](){
        if (this->graphicsWindow_)
            HookApp::instance()->overlayConnector()->sendGraphicsWindowSetupInfo(graphicsWindow_, windowClientRect_.right - windowClientRect_.left, windowClientRect_.bottom - windowClientRect_.top, windowFocus_, true);
    }, this);
}

UiApp::~UiApp()
{
}

bool UiApp::trySetupGraphicsWindow(HWND window)
{
    WCHAR title[256] = {};
    GetWindowTextW(window, title, 256);
    LOGGER("n_overlay") << "window: " << window << ", title:" << title;

    if (session::graphicsWindow() && window != session::graphicsWindow())
    {
        LOGGER("n_overlay") << "window !=  session::graphicsWindow";

        return false;
    }

    if (graphicsWindow_ == window)
    {
        return true;
    }

    if (graphicsWindow_)
    {
        unhookWindow();
        graphicsWindow_ = nullptr;
    }

    bool res = setup(window);

    LOGGER("n_overlay") << "setup res:" << res;

    return res;
}

bool UiApp::setup(HWND window)
{
    std::lock_guard<std::mutex> lock(uilock_);

    bool focused = GetForegroundWindow() == window;
    RECT rect = { 0 };
    GetClientRect(window, &rect);

    if (hookWindow(window))
    {
        graphicsWindow_ = window;

        windowFocus_ = focused;
        windowClientRect_ = rect;

        HookApp::instance()->overlayConnector()->sendGraphicsWindowSetupInfo(window, rect.right - rect.left, rect.bottom - rect.top, focused, true);

        async([this]() {
            if (this->graphicsWindow_)
            {
                if (GetForegroundWindow() == this->graphicsWindow_)
                {
                    HookApp::instance()->overlayConnector()->translateWindowsToGameClient();
                }
            }
        });

        return true;
    }
    else
    {
        HookApp::instance()->overlayConnector()->sendGraphicsWindowSetupInfo(window, rect.right - rect.left, rect.bottom - rect.top, focused, false);

        unhookWindow();
        return false;
    }
}

HWND UiApp::window() const
{
    return graphicsWindow_.load();
}

bool UiApp::windowSetted() const
{
    return !!graphicsWindow_.load();
}

bool UiApp::windowFocused() const
{
    return windowFocus_;
}

void UiApp::async(const std::function<void()>& task)
{
    DAssert(session::graphicsWindow());

    std::lock_guard<std::mutex> lock(taskLock_);
    tasks_.push_back(task);

    PostMessage(graphicsWindow_, overlayMagicMsg_, OVERLAY_MAGIC, OVERLAY_TASK);
}

void UiApp::toggleInputIntercept()
{
    if (isIntercepting_)
    {
        stopInputIntercept();
    }
    else
    {
        startInputIntercept();
    }
}

void UiApp::startInputIntercept()
{
    CHECK_THREAD(Threads::Window);

    if (session::overlayEnabled())
    {
        if (!isIntercepting_)
        {
            isIntercepting_ = true;

            if (session::isWindowed())
            {
#if ALLOW_ASSOC_SYSIME
                if (!IMC_)
                {
                    IMC_ = ImmCreateContext();
                }
                originalIMC_ = ImmAssociateContext(graphicsWindow_, IMC_);
#endif
            }

            session::inputHook()->saveInputState();
            HookApp::instance()->overlayConnector()->sendInputIntercept();

            POINT pt{};
            Windows::OrginalApi::GetCursorPos(&pt);
            LPARAM lParam = 0;
            lParam = pt.x + (pt.y << 16);
            HookApp::instance()->overlayConnector()->processNCHITTEST(WM_NCHITTEST, 0, lParam);
            HookApp::instance()->overlayConnector()->processSetCursor();


#if AUTO_INPUT_INTERCEPT
            stopAutoIntercept();
#endif
        }
    }
}

void UiApp::stopInputIntercept()
{
    CHECK_THREAD(Threads::Window);

    if (session::overlayEnabled())
    {
        if (isIntercepting_)
        {
            isIntercepting_ = false;

#if ALLOW_ASSOC_SYSIME
            if (!originalIMC_)
            {
                ImmAssociateContext(graphicsWindow_, nullptr);
            }
            else
            {
                ImmAssociateContext(graphicsWindow_, originalIMC_);
                originalIMC_ = nullptr;
            }
            if (IMC_)
            {
                ImmReleaseContext(graphicsWindow_, IMC_);
                IMC_ = nullptr;
            }
#endif
            session::inputHook()->restoreInputState();
            HookApp::instance()->overlayConnector()->sendInputStopIntercept();
        }
    }
}

#if AUTO_INPUT_INTERCEPT
void UiApp::startAutoIntercept()
{
    if (session::overlayEnabled())
    {
        if (!isInterceptingMouseAuto_)
        {
            isInterceptingMouseAuto_ = true;
        }
    }
}
#endif

#if AUTO_INPUT_INTERCEPT
void UiApp::stopAutoIntercept()
{
    if (session::overlayEnabled())
    {
        if (isInterceptingMouseAuto_)
        {
            isInterceptingMouseAuto_ = false;
        }
    }
}
#endif

bool UiApp::shouldBlockOrginalMouseInput()
{
#if AUTO_INPUT_INTERCEPT
    //return isInterceptingMouseAuto_ || isIntercepting_;
    return isIntercepting_;
#else
    return isIntercepting_;
#endif
}

bool UiApp::shouldBlockOrginalKeyInput()
{
#if AUTO_INPUT_INTERCEPT
    return (isInterceptingMouseAuto_ && HookApp::instance()->overlayConnector()->focusWindowId() != 0) || isIntercepting_;
#else
    return isIntercepting_;
#endif
}

bool UiApp::shouldBlockOrginalCursorViz()
{
    return isIntercepting_;
}

bool UiApp::isInterceptingInput()
{
    return isIntercepting_;
}

#if AUTO_INPUT_INTERCEPT
bool UiApp::isInterceptingMouseAuto()
{
    return isInterceptingMouseAuto_;
}
#endif

bool UiApp::hookWindow(HWND window)
{
    __trace__;

    if (g_use_wndproc_hook)
    {
        oldWndProc_ = (WNDPROC)GetWindowLongPtr(window, GWLP_WNDPROC);
        SetWindowLongPtr(window, GWLP_WNDPROC, (LONG_PTR)WindowProc);
        return oldWndProc_ != nullptr;
    }
    else
    {
        DWORD threadId = ::GetWindowThreadProcessId(window, nullptr);

        msgHook_ = SetWindowsHookExW(WH_GETMESSAGE, GetMsgProc, NULL, threadId);
        wndProcHook_ = SetWindowsHookExW(WH_CALLWNDPROC, CallWndProc, NULL, threadId);
        wndRetProcHook_ = SetWindowsHookExW(WH_CALLWNDPROCRET, CallWndRetProc, NULL, threadId);

        return msgHook_ != nullptr && wndProcHook_ != nullptr && wndRetProcHook_ != nullptr;
    }
}

void UiApp::unhookWindow()
{
    __trace__;
    if (g_use_wndproc_hook)
    {
        if (oldWndProc_)
        {
            SetWindowLongPtr(graphicsWindow_, GWLP_WNDPROC, (LONG_PTR)oldWndProc_);
        }
    }
    else
    {
        if (msgHook_)
        {
            UnhookWindowsHookEx(msgHook_);
            msgHook_ = nullptr;
        }
        if (wndProcHook_)
        {
            UnhookWindowsHookEx(wndProcHook_);
            wndProcHook_ = nullptr;
        }
        if (wndRetProcHook_)
        {
            UnhookWindowsHookEx(wndRetProcHook_);
            wndRetProcHook_ = nullptr;
        }
    }
}

void UiApp::updateWindowState(HWND window)
{
    windowFocus_ = GetForegroundWindow() == window;

    GetClientRect(window, &windowClientRect_);
}

void UiApp::clearWindowState()
{
    windowClientRect_ = {0};
    windowFocus_ = 0;
}

std::uint32_t UiApp::gameWidth() const
{
    return windowClientRect_.right - windowClientRect_.left;
}

std::uint32_t UiApp::gameHeight() const
{
    return windowClientRect_.bottom - windowClientRect_.top;
}

static void _appendKeymapLog(const std::string& line)
{
    try {
        std::ofstream ofs("C:\\cpp-keyboard-intercept\\key-remap.log", std::ios::app);
        if (ofs.is_open()) {
            ofs << line << "\n";
        }
    } catch (...) {
    }
}

void UiApp::setKeyRemaps(const std::vector<overlay::KeyRemap>& remaps)
{
    std::lock_guard<std::mutex> lock(remapLock_);
    keyRemaps_.clear();
    
    int added = 0;
    for (const auto& remap : remaps)
    {
        if (remap.enabled && remap.fromKey != 0 && remap.toKey != 0)
        {
            keyRemaps_[remap.fromKey] = remap.toKey;
            ++added;
        }
    }

    std::ostringstream oss;
    oss << "[setKeyRemaps] count=" << added << " entries: ";
    bool first = true;
    for (const auto& kv : keyRemaps_)
    {
        if (!first) oss << ", ";
        first = false;
        oss << kv.first << "->" << kv.second;
    }
    _appendKeymapLog(oss.str());
}

void UiApp::clearKeyRemaps()
{
    std::lock_guard<std::mutex> lock(remapLock_);
    keyRemaps_.clear();
}

bool UiApp::isKeyRemapped(int keyCode) const
{
    std::lock_guard<std::mutex> lock(remapLock_);
    return keyRemaps_.find(keyCode) != keyRemaps_.end();
}

int UiApp::getRemappedKey(int keyCode) const
{
    std::lock_guard<std::mutex> lock(remapLock_);
    auto it = keyRemaps_.find(keyCode);
    return (it != keyRemaps_.end()) ? it->second : keyCode;
}

// Key blocking and passing methods
void UiApp::setBlockedKeys(const std::set<int>& keys)
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    blockedKeys_ = keys;
    
    std::ostringstream oss;
    oss << "[setBlockedKeys] count=" << keys.size() << " keys: ";
    bool first = true;
    for (int key : keys)
    {
        if (!first) oss << ", ";
        first = false;
        oss << key;
    }
    _appendKeymapLog(oss.str());
}

void UiApp::setPassedKeys(const std::set<int>& keys)
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    passedKeys_ = keys;
    
    std::ostringstream oss;
    oss << "[setPassedKeys] count=" << keys.size() << " keys: ";
    bool first = true;
    for (int key : keys)
    {
        if (!first) oss << ", ";
        first = false;
        oss << key;
    }
    _appendKeymapLog(oss.str());
}

void UiApp::clearBlockedKeys()
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    blockedKeys_.clear();
    _appendKeymapLog("[clearBlockedKeys] cleared all blocked keys");
}

void UiApp::clearPassedKeys()
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    passedKeys_.clear();
    _appendKeymapLog("[clearPassedKeys] cleared all passed keys");
}

bool UiApp::isKeyBlocked(int keyCode) const
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    return blockedKeys_.find(keyCode) != blockedKeys_.end();
}

bool UiApp::isKeyPassed(int keyCode) const
{
    std::lock_guard<std::mutex> lock(blockPassLock_);
    return passedKeys_.find(keyCode) != passedKeys_.end();
}

// In-game menu key methods
void UiApp::setInGameMenuKey(int keyCode)
{
    std::lock_guard<std::mutex> lock(ingamemenuLock_);
    ingamemenuKey_ = keyCode;
    
    std::ostringstream oss;
    oss << "[setInGameMenuKey] keyCode=" << keyCode;
    _appendKeymapLog(oss.str());
    
    // Schedule Home key press to trigger overlay show when ready
    // Use async to ensure it runs after all initialization is complete
    async([this]() {
        _handleHomeKeyPressWhenReady();
    });
}

int UiApp::getInGameMenuKey() const
{
    std::lock_guard<std::mutex> lock(ingamemenuLock_);
    return ingamemenuKey_;
}

// Private method to handle Home key press logic when system is ready
void UiApp::_handleHomeKeyPressWhenReady()
{
    // Check if all components are ready
    if (!session::overlayEnabled() || !session::graphicsActive()) {
        std::ostringstream logLine;
        logLine << "[LLKB] System not ready yet, retrying in 100ms";
        _appendKeymapLog(logLine.str());
        
        // Retry after a short delay
        async([this]() {
            Sleep(100);
            _handleHomeKeyPressWhenReady();
        });
        return;
    }
    
    // Check if overlay connector is available
    if (!HookApp::instance() || !HookApp::instance()->overlayConnector()) {
        std::ostringstream logLine;
        logLine << "[LLKB] Overlay connector not ready yet, retrying in 100ms";
        _appendKeymapLog(logLine.str());
        
        // Retry after a short delay
        async([this]() {
            Sleep(100);
            _handleHomeKeyPressWhenReady();
        });
        return;
    }
    
    // Everything is ready, proceed with Home key press
    std::ostringstream logLine;
    logLine << "[LLKB] calling _handleHomeKeyPress manually";
    _appendKeymapLog(logLine.str());
    _handleHomeKeyPress();
}

// Private method to handle Home key press logic
void UiApp::_handleHomeKeyPress()
{
    std::ostringstream logLine;
    logLine << "[LLKB] Home key pressed - showing overlay";
    _appendKeymapLog(logLine.str());
    
    // Send ingamemenuKey before showing overlay if configured
    int ingamemenuKey = getInGameMenuKey();
    if (ingamemenuKey > 0) {
        std::ostringstream menuLogLine;
        menuLogLine << "[LLKB] Sending ingamemenuKey=" << ingamemenuKey << " before overlay.show";
        _appendKeymapLog(menuLogLine.str());
        
        // Send key down
        sendSynthKey(static_cast<WORD>(ingamemenuKey), true, 0);
        // Send key up after small delay
        Sleep(50);
        sendSynthKey(static_cast<WORD>(ingamemenuKey), false, 0);
    }
    
    HookApp::instance()->overlayConnector()->sendInGameHotkeyDown("overlay.show");
}

LRESULT CALLBACK UiApp::GetMsgProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    return HookApp::instance()->uiapp()->hookGetMsgProc(nCode, wParam, lParam);
}

LRESULT CALLBACK UiApp::CallWndProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    return HookApp::instance()->uiapp()->hookCallWndProc(nCode, wParam, lParam);
}

LRESULT CALLBACK UiApp::CallWndRetProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    return HookApp::instance()->uiapp()->hookCallWndRetProc(nCode, wParam, lParam);
}

LRESULT WINAPI UiApp::WindowProc(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam)
{
    return HookApp::instance()->uiapp()->hookWindowProc(hWnd, Msg, wParam, lParam);
}


// Minimal experimental key remap: map 'Q' to 'W' at low level
// Installs a WH_KEYBOARD_LL hook and synthesizes 'W' while swallowing 'Q'.

// Global function to send synthesized key input
void sendSynthKey(WORD vk, bool isKeyDown, DWORD scanCodeLike) {
		INPUT input = { 0 };
		input.type = INPUT_KEYBOARD;
		input.ki.wVk = vk;
		input.ki.wScan = static_cast<WORD>(scanCodeLike);
		input.ki.dwFlags = isKeyDown ? 0 : KEYEVENTF_KEYUP;
		::SendInput(1, &input, sizeof(INPUT));
	}

namespace {
	HHOOK g_llkbHook = nullptr;
	HHOOK g_llmHook = nullptr;
	static const ULONG_PTR kMouseSwapTag = 0x4D535741; // 'MSWA'

	LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
		if (nCode == HC_ACTION && lParam) {
			const KBDLLHOOKSTRUCT* p = reinterpret_cast<const KBDLLHOOKSTRUCT*>(lParam);
			if (HookApp::instance()->uiapp() && session::overlayEnabled() && session::graphicsActive()) {
				// Only apply remap when the game window is in foreground
				HWND foregroundWindow = GetForegroundWindow();
				HWND gameWindow = HookApp::instance()->uiapp()->window();
				if (foregroundWindow == gameWindow) {
					const bool isKeyDown = (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN);
					const bool isKeyUp = (wParam == WM_KEYUP || wParam == WM_SYSKEYUP);
					
					// Handle Home/End keys for overlay show/hide
					if (isKeyDown) {
						if (p->vkCode == VK_HOME) {
							// Use the centralized Home key handler
							HookApp::instance()->uiapp()->_handleHomeKeyPress();
							return 1; // Consume the key
						}
						else if (p->vkCode == VK_END) {
							std::ostringstream logLine;
							logLine << "[LLKB] End key pressed - hiding overlay";
							_appendKeymapLog(logLine.str());
							HookApp::instance()->overlayConnector()->sendInGameHotkeyDown("overlay.hide");
							return 1; // Consume the key
						}
					}
					
					// Handle key blocking, passing, and remapping
					if (!HookApp::instance()->uiapp()->isInterceptingInput()) {
						if (isKeyDown || isKeyUp) {
                            std::ostringstream logLine;
							logLine << "[LLKB] vk=" << p->vkCode << (isKeyDown ? " DOWN" : (isKeyUp ? " UP" : ""));
							_appendKeymapLog(logLine.str());
                            auto ui = HookApp::instance()->uiapp();
                            
                            // Check if key should be blocked (consumed)
                            if (ui && ui->isKeyBlocked(static_cast<int>(p->vkCode))) {
                                logLine << "[LLKB] vk=" << p->vkCode << " BLOCKED (consumed)";
                                _appendKeymapLog(logLine.str());
                                return 1; // Consume the key - don't pass to game
                            }
                            
                            // Debug: Check if key is in blocked list (for debugging)
                            if (ui) {
                                std::ostringstream debugLine;
                                debugLine << "[LLKB] DEBUG: Checking vk=" << p->vkCode << " isBlocked=" << ui->isKeyBlocked(static_cast<int>(p->vkCode));
                                _appendKeymapLog(debugLine.str());
                            }
                            
                            // Check if key should be passed (monitor only)
                            if (ui && ui->isKeyPassed(static_cast<int>(p->vkCode))) {
                                logLine << "[LLKB] vk=" << p->vkCode << " PASSED (monitored)";
                                _appendKeymapLog(logLine.str());
                                // Continue to CallNextHookEx - let the key pass through
                            }
                            
                            // Check if key should be remapped
                            if (ui && ui->isKeyRemapped(static_cast<int>(p->vkCode))) {
                                int remapped = ui->getRemappedKey(static_cast<int>(p->vkCode));
                                logLine << "[LLKB] vk=" << p->vkCode << (isKeyDown ? " DOWN" : (isKeyUp ? " UP" : "")) << " -> " << remapped;
                                _appendKeymapLog(logLine.str());
                                sendSynthKey(static_cast<WORD>(remapped), isKeyDown, p->scanCode);
                                return 1; // Consume original key, send remapped key
                            }
                            
                            // Check if Numpad 5 should act as primary mouse button
                            if (p->vkCode == VK_NUMPAD5 && HookApp::instance()->overlayConnector()->getNumpad5Primary()) {
                                logLine << "[LLKB] vk=" << p->vkCode << (isKeyDown ? " DOWN" : (isKeyUp ? " UP" : "")) << " -> LEFT MOUSE BUTTON";
                                _appendKeymapLog(logLine.str());
                                
                                // Get current mouse position for the mouse message
                                POINT mousePt;
                                GetCursorPos(&mousePt);
                                HWND gameWindow = HookApp::instance()->uiapp()->window();
                                ScreenToClient(gameWindow, &mousePt);
                                LPARAM mouseLParam = MAKELPARAM(static_cast<UINT>(mousePt.x), static_cast<UINT>(mousePt.y));
                                
                                // Send mouse button message using PostMessageW (same as mouse swap)
                                UINT mouseMsg = 0;
                                WPARAM mouseWParam = 0;
                                if (isKeyDown) {
                                    mouseMsg = WM_LBUTTONDOWN;
                                    mouseWParam = MK_LBUTTON;
                                } else if (isKeyUp) {
                                    mouseMsg = WM_LBUTTONUP;
                                    mouseWParam = 0;
                                }
                                
                                PostMessageW(gameWindow, mouseMsg, mouseWParam, mouseLParam);
                                return 1; // Consume the Numpad 5 key
                            }
                            
                            // Check if Numpad + should act as secondary mouse button
                            if (p->vkCode == VK_ADD && HookApp::instance()->overlayConnector()->getNumpadPlusSecondary()) {
                                logLine << "[LLKB] vk=" << p->vkCode << (isKeyDown ? " DOWN" : (isKeyUp ? " UP" : "")) << " -> RIGHT MOUSE BUTTON";
                                _appendKeymapLog(logLine.str());
                                
                                // Get current mouse position for the mouse message
                                POINT mousePt;
                                GetCursorPos(&mousePt);
                                HWND gameWindow = HookApp::instance()->uiapp()->window();
                                ScreenToClient(gameWindow, &mousePt);
                                LPARAM mouseLParam = MAKELPARAM(static_cast<UINT>(mousePt.x), static_cast<UINT>(mousePt.y));
                                
                                // Send mouse button message using PostMessageW (same as mouse swap)
                                UINT mouseMsg = 0;
                                WPARAM mouseWParam = 0;
                                if (isKeyDown) {
                                    mouseMsg = WM_RBUTTONDOWN;
                                    mouseWParam = MK_RBUTTON;
                                } else if (isKeyUp) {
                                    mouseMsg = WM_RBUTTONUP;
                                    mouseWParam = 0;
                                }
                                
                                PostMessageW(gameWindow, mouseMsg, mouseWParam, mouseLParam);
                                return 1; // Consume the Numpad + key
                            }
						}
					}
				}
			}
		}
		// pass through
		return CallNextHookEx(g_llkbHook, nCode, wParam, lParam);
	}

    LRESULT CALLBACK LowLevelMouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
		if (nCode == HC_ACTION && lParam) {
			// Begin detailed logging block
			try {
				std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
				if (ofs.is_open()) {
					ofs << "[MouseSwap] --- Hook ENTER ---" << std::endl;
					ofs << "[MouseSwap] nCode=" << nCode << ", wParam=" << wParam << ", lParam!=NULL" << std::endl;
				}
			} catch (...) {}
			const MSLLHOOKSTRUCT* p = reinterpret_cast<const MSLLHOOKSTRUCT*>(lParam);
			// Pass through our own synthetic events (identified by tag)
			if (p->dwExtraInfo == kMouseSwapTag) {
				try {
					std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
					if (ofs.is_open()) {
						const char* msg = "UNKNOWN";
						if (wParam == WM_LBUTTONDOWN) msg = "WM_LBUTTONDOWN";
						else if (wParam == WM_LBUTTONUP) msg = "WM_LBUTTONUP";
						else if (wParam == WM_RBUTTONDOWN) msg = "WM_RBUTTONDOWN";
						else if (wParam == WM_RBUTTONUP) msg = "WM_RBUTTONUP";
						ofs << "[MouseSwap] Tagged synthetic detected (" << msg << ") -> pass through" << std::endl;
					}
				} catch (...) {}
				return CallNextHookEx(g_llmHook, nCode, wParam, lParam);
			}
			if (HookApp::instance()->uiapp() && session::overlayEnabled() && session::graphicsActive()) {
				// Only apply mouse swap when the game window is in foreground
				HWND foregroundWindow = GetForegroundWindow();
				HWND gameWindow = HookApp::instance()->uiapp()->window();
				try {
					std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
					if (ofs.is_open()) {
						ofs << "[MouseSwap] fgWnd=" << foregroundWindow << ", gameWnd=" << gameWindow << (foregroundWindow == gameWindow ? " (FOREGROUND)" : " (NOT FG)") << std::endl;
					}
				} catch (...) {}
				if (foregroundWindow == gameWindow) {
					// Check if moving speed adjustment is enabled
					// float movingSpeed = HookApp::instance()->overlayConnector()->getMovingSpeed();
					// if (movingSpeed != 1.0f && wParam == WM_MOUSEMOVE) {
					// 	// Handle moving speed adjustment for mouse movement
					// 	// Get the current mouse position
					// 	POINT currentPos = p->pt;
						
					// 	// Get the game window client area
					// 	RECT clientRect;
					// 	GetClientRect(gameWindow, &clientRect);
						
					// 	// Convert screen coordinates to client coordinates
					// 	POINT clientPos = currentPos;
					// 	ScreenToClient(gameWindow, &clientPos);
						
					// 	// Apply moving speed multiplier to the position
					// 	// For speed adjustment, we need to track the previous position
					// 	// and calculate the delta, then multiply by speed
					// 	static POINT lastClientPos = {0, 0};
					// 	static bool firstMove = true;
						
					// 	if (!firstMove) {
					// 		// Calculate movement delta
					// 		int deltaX = clientPos.x - lastClientPos.x;
					// 		int deltaY = clientPos.y - lastClientPos.y;
							
					// 		// Apply speed multiplier to delta
					// 		int adjustedDeltaX = static_cast<int>(deltaX * movingSpeed);
					// 		int adjustedDeltaY = static_cast<int>(deltaY * movingSpeed);
							
					// 		// Calculate new position based on adjusted delta
					// 		int newX = lastClientPos.x + adjustedDeltaX;
					// 		int newY = lastClientPos.y + adjustedDeltaY;
							
					// 		// Clamp to window bounds
					// 		newX = std::max(0, std::min(newX, static_cast<int>(clientRect.right - 1)));
					// 		newY = std::max(0, std::min(newY, static_cast<int>(clientRect.bottom - 1)));
							
					// 		// Convert adjusted client position back to screen coordinates
					// 		POINT adjustedScreenPos = { newX, newY };
					// 		ClientToScreen(gameWindow, &adjustedScreenPos);
							
					// 		// Set the real cursor position using SetCursorPos
					// 		SetCursorPos(adjustedScreenPos.x, adjustedScreenPos.y);
							
					// 		// Create the adjusted mouse position
					// 		LPARAM adjustedLParam = MAKELPARAM(static_cast<UINT>(newX), static_cast<UINT>(newY));
							
					// 		// Send the adjusted mouse movement using PostMessageW
					// 		WPARAM mouseWParam = 0;
					// 		if (p->flags & LLMHF_INJECTED) {
					// 			mouseWParam = 0;
					// 		}
							
					// 		// Log the moving speed adjustment
					// 		try {
					// 			std::ofstream ofs("C:\\cpp-keyboard-intercept\\moving-speed.log", std::ios::app);
					// 			if (ofs.is_open()) {
					// 				ofs << "[MovingSpeed] Speed: " << movingSpeed 
                    //                     << " last pos: (" << lastClientPos.x << "," << lastClientPos.y << ")"
                    //                     << " current pos: (" << clientPos.x << "," << clientPos.y << ")"
					// 					<< ", Delta: (" << deltaX << "," << deltaY << ")"
					// 					<< ", Adjusted: (" << adjustedDeltaX << "," << adjustedDeltaY << ")"
					// 					<< ", New Pos: (" << newX << "," << newY << ")"
					// 					<< ", Screen Pos: (" << adjustedScreenPos.x << "," << adjustedScreenPos.y << ")" << std::endl;
					// 			}
					// 		} catch (...) {}
							
					// 		PostMessageW(gameWindow, WM_MOUSEMOVE, mouseWParam, adjustedLParam);
							
					// 		// Update last position to the adjusted position
					// 		lastClientPos.x = newX;
					// 		lastClientPos.y = newY;
							
					// 		return 1; // Consume original input
					// 	} else {
					// 		// First move - just record the position
					// 		lastClientPos = clientPos;
					// 		firstMove = false;
					// 		return 1; // Consume original input
					// 	}
					// }
					
					// Check if Y-axis reversion is enabled
					// if (HookApp::instance()->overlayConnector()->getYAxisInvert()) {
					// 	// Handle Y-axis reversion for mouse movement
					// 	if (wParam == WM_MOUSEMOVE) {
					// 		// Get the current mouse position
					// 		POINT currentPos = p->pt;
							
					// 		// Get the game window client area
					// 		RECT clientRect;
					// 		GetClientRect(gameWindow, &clientRect);
							
					// 		// Convert screen coordinates to client coordinates
					// 		POINT clientPos = currentPos;
					// 		ScreenToClient(gameWindow, &clientPos);
							
					// 		// Invert the Y coordinate
					// 		int invertedY = clientRect.bottom - clientPos.y;
							
					// 		// Create the inverted mouse position in client coordinates
					// 		LPARAM invertedLParam = MAKELPARAM(static_cast<UINT>(clientPos.x), static_cast<UINT>(invertedY));
							
					// 		// Send the inverted mouse movement using PostMessageW
					// 		// For WM_MOUSEMOVE, wParam contains the key state flags
					// 		WPARAM mouseWParam = 0;
					// 		if (p->flags & LLMHF_INJECTED) {
					// 			// If this is an injected event, we might want to preserve some flags
					// 			mouseWParam = 0; // For mouse move, typically no special flags
					// 		}
							
					// 		PostMessageW(gameWindow, WM_MOUSEMOVE, mouseWParam, invertedLParam);
							
					// 		// Log the Y-axis reversion
					// 		try {
					// 			std::ofstream ofs("C:\\cpp-keyboard-intercept\\yaxis-revert.log", std::ios::app);
					// 			if (ofs.is_open()) {
					// 				ofs << "[YAxisInvert] Original Y: " << currentPos.y 
					// 					<< ", Client Y: " << clientPos.y 
					// 					<< ", Inverted Client Y: " << invertedY 
					// 					<< ", flags: " << p->flags << std::endl;
					// 			}
					// 		} catch (...) {}
							
					// 		return 1; // Consume original input
					// 	}
					// }
					
					// Check if mouse button swapping is enabled
					if (HookApp::instance()->overlayConnector()->getSwapMouseButtons()) {
						// Handle mouse button swapping
						if (wParam == WM_LBUTTONDOWN || wParam == WM_LBUTTONUP || 
							wParam == WM_RBUTTONDOWN || wParam == WM_RBUTTONUP) {
							
							// Create synthetic mouse input with swapped buttons
							INPUT input = { 0 };
							input.type = INPUT_MOUSE;
							input.mi.mouseData = 0;
							input.mi.dwExtraInfo = kMouseSwapTag; // tag our synthetic event
							input.mi.time = 0;
							
							// Use relative coordinates (no position change)
							input.mi.dx = 0;
							input.mi.dy = 0;
							
							// Set appropriate flags for button events only (no move event)
							input.mi.dwFlags = 0;
							
							// Swap the button flags
							if (wParam == WM_LBUTTONDOWN) {
								input.mi.dwFlags |= MOUSEEVENTF_RIGHTDOWN;
							} else if (wParam == WM_LBUTTONUP) {
								input.mi.dwFlags |= MOUSEEVENTF_RIGHTUP;
							} else if (wParam == WM_RBUTTONDOWN) {
								input.mi.dwFlags |= MOUSEEVENTF_LEFTDOWN;
							} else if (wParam == WM_RBUTTONUP) {
								input.mi.dwFlags |= MOUSEEVENTF_LEFTUP;
							}
							
							// Debug logging
							try {
								std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
								if (ofs.is_open()) {
									const char* originalMsg = "UNKNOWN";
									if (wParam == WM_LBUTTONDOWN) originalMsg = "WM_LBUTTONDOWN";
									else if (wParam == WM_LBUTTONUP) originalMsg = "WM_LBUTTONUP";
									else if (wParam == WM_RBUTTONDOWN) originalMsg = "WM_RBUTTONDOWN";
									else if (wParam == WM_RBUTTONUP) originalMsg = "WM_RBUTTONUP";
									const char* swappedMsg = "UNKNOWN";
									if (input.mi.dwFlags & MOUSEEVENTF_LEFTDOWN) swappedMsg = "MOUSEEVENTF_LEFTDOWN";
									else if (input.mi.dwFlags & MOUSEEVENTF_LEFTUP) swappedMsg = "MOUSEEVENTF_LEFTUP";
									else if (input.mi.dwFlags & MOUSEEVENTF_RIGHTDOWN) swappedMsg = "MOUSEEVENTF_RIGHTDOWN";
									else if (input.mi.dwFlags & MOUSEEVENTF_RIGHTUP) swappedMsg = "MOUSEEVENTF_RIGHTUP";
									ofs << "[MouseSwap] Injecting swapped input: Original=" << originalMsg << ", Swapped=" << swappedMsg << std::endl;
								}
							} catch (...) {}
							
							// Send the swapped mouse input using PostMessage (temporary approach)
							//::SendInput(1, &input, sizeof(INPUT));
                            UINT swappedMsg = 0;
							WPARAM swappedWParam = 0;
							if (wParam == WM_LBUTTONDOWN) { swappedMsg = WM_RBUTTONDOWN; swappedWParam = MK_RBUTTON; }
							else if (wParam == WM_LBUTTONUP) { swappedMsg = WM_RBUTTONUP; swappedWParam = 0; }
							else if (wParam == WM_RBUTTONDOWN) { swappedMsg = WM_LBUTTONDOWN; swappedWParam = MK_LBUTTON; }
							else if (wParam == WM_RBUTTONUP) { swappedMsg = WM_LBUTTONUP; swappedWParam = 0; }

							POINT clientPt{ p->pt.x, p->pt.y };
							ScreenToClient(gameWindow, &clientPt);
							LPARAM swappedLParam = MAKELPARAM(static_cast<UINT>(clientPt.x), static_cast<UINT>(clientPt.y));

							PostMessageW(gameWindow, swappedMsg, swappedWParam, swappedLParam);
							try {
								std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
								if (ofs.is_open()) {
									const char* swappedMsgName = (swappedMsg == WM_LBUTTONDOWN ? "WM_LBUTTONDOWN" :
										swappedMsg == WM_LBUTTONUP ? "WM_LBUTTONUP" :
										swappedMsg == WM_RBUTTONDOWN ? "WM_RBUTTONDOWN" :
										swappedMsg == WM_RBUTTONUP ? "WM_RBUTTONUP" : "UNKNOWN");
									ofs << "[MouseSwap] PostMessage sent: " << swappedMsgName
										<< " wParam=" << swappedWParam
										<< " lParam=(" << clientPt.x << "," << clientPt.y << ")" << std::endl;
								}
							} catch (...) {}
							
							return 1; // Consume original input
						}
					}
				}
			}
		}
		// pass through
		try {
			std::ofstream ofs("C:\\cpp-keyboard-intercept\\mouse-swap-debug.log", std::ios::app);
			if (ofs.is_open()) ofs << "[MouseSwap] pass-through path" << std::endl;
		} catch (...) {}
		return CallNextHookEx(g_llmHook, nCode, wParam, lParam);
	}
}

LRESULT UiApp::hookWindowProc(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam)
{
	if (!g_llkbHook && session::graphicsActive())
	{
		g_llkbHook = ::SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandleW(NULL), 0);
	}
	if (!g_llmHook && session::graphicsActive())
	{
		g_llmHook = ::SetWindowsHookExW(WH_MOUSE_LL, LowLevelMouseProc, GetModuleHandleW(NULL), 0);
	}
    if (!session::overlayEnabled())
    {
        stopInputIntercept();
    }
    if (session::graphicsActive())
    {
        if (Msg == WM_KEYDOWN || Msg == WM_SYSKEYDOWN
            || Msg == WM_KEYUP || Msg == WM_SYSKEYUP)
        {
            if (checkHotkey())
            {
                return 0;
            }
        }

        if (Msg == overlayMagicMsg_ && wParam == OVERLAY_MAGIC)
        {
            if (lParam == OVERLAY_TASK)
            {
                _runTask();
            }
        }
    }

    if (Msg == WM_DESTROY)
    {
        LOGGER("n_overlay") << L"WM_DESTROY, " << graphicsWindow_;

        HookApp::instance()->overlayConnector()->sendGraphicsWindowDestroy(graphicsWindow_);

        unhookWindow();
        graphicsWindow_ = nullptr;

        HookApp::instance()->quit();
    }
    else if (Msg == WM_SIZE)
    {
        GetClientRect(graphicsWindow_, &windowClientRect_);
        HookApp::instance()->overlayConnector()->sendGraphicsWindowResizeEvent(graphicsWindow_, windowClientRect_.right - windowClientRect_.left, windowClientRect_.bottom - windowClientRect_.top);
    }

    else if (Msg == WM_KILLFOCUS)
    {
        windowFocus_ = false;
        HookApp::instance()->overlayConnector()->sendGraphicsWindowFocusEvent(graphicsWindow_, windowFocus_);
#if AUTO_INPUT_INTERCEPT
        stopAutoIntercept();
#endif
        stopInputIntercept();

    }
    else if (Msg == WM_SETFOCUS)
    {
        windowFocus_ = true;
        HookApp::instance()->overlayConnector()->sendGraphicsWindowFocusEvent(graphicsWindow_, windowFocus_);
    }
    else if (Msg == WM_SETCURSOR && LOWORD(lParam) == HTCLIENT)
    {
        if (_setCusror())
        {
            return 0;
        }
    }
    else if (Msg == WM_NCHITTEST)
    {
        if (isIntercepting_)
        {
            HookApp::instance()->overlayConnector()->processNCHITTEST(Msg, wParam, lParam);
        }
#if AUTO_INPUT_INTERCEPT
        else
        {
            HookApp::instance()->overlayConnector()->processNCHITTEST(Msg, wParam, lParam, false) ? startAutoIntercept() : stopAutoIntercept();
        }
#endif
    }

    if (session::graphicsActive())
    {
        if (!isIntercepting_)
        {

#if AUTO_INPUT_INTERCEPT
            if (!isInterceptingMouseAuto_ && !HookApp::instance()->isQuitSet() && !HookApp::instance()->overlayConnector()->isMousePressingOnOverlayWindow())
            {
                return CallWindowProc(oldWndProc_, hWnd, Msg, wParam, lParam);
            }

#else
            return CallWindowProc(oldWndProc_, hWnd, Msg, wParam, lParam);
#endif
        }

        if (Msg >= WM_MOUSEFIRST && Msg <= WM_MOUSELAST)
        {
            POINTS pt = MAKEPOINTS(lParam);
#if AUTO_INPUT_INTERCEPT
            if (!HookApp::instance()->overlayConnector()->processMouseMessage(Msg, wParam, lParam, isIntercepting_))
#else
            if (!HookApp::instance()->overlayConnector()->processMouseMessage(Msg, wParam, lParam))
#endif // AUTO_INPUT_INTERCEPT

            {
                if (Msg == WM_LBUTTONUP
                    || Msg == WM_MBUTTONUP)
                {
                    async([this]() { this->stopInputIntercept(); });
                }
            }
            return 0;
        }

        if (Msg == WM_INPUT)
        {
            return 0;
        }

        if ((Msg >= WM_KEYFIRST && Msg <= WM_KEYLAST)
            || (Msg >= WM_SYSKEYDOWN && Msg <= WM_SYSDEADCHAR))
        {
            // Only process keyboard events from the target game window
            if (hWnd != graphicsWindow_)
            {
                return CallWindowProc(oldWndProc_, hWnd, Msg, wParam, lParam);
            }

            // Check for key remapping
            if (isKeyRemapped(wParam))
            {
                int remappedKey = getRemappedKey(wParam);
                INPUT in = { 0 };
                in.type = INPUT_KEYBOARD;
                in.ki.wVk = remappedKey;
                
                if (Msg == WM_KEYUP || Msg == WM_SYSKEYUP)
                {
                    in.ki.dwFlags = KEYEVENTF_KEYUP;
                }
                
                SendInput(1, &in, sizeof(INPUT));
                return 0; // consume original key
            }

            bool inputHandled = HookApp::instance()->overlayConnector()->processkeyboardMessage(Msg, wParam, lParam);
            if (inputHandled)
            {
                /*if (Msg == WM_KEYDOWN)
                {
                    if (!HookApp::instance()->overlayConnector()->directMessageInput())
                    {
                        TranslateMessage(pMsg);
                    }
                }*/
            }
            return 0;
        }
    }

    return CallWindowProc(oldWndProc_, hWnd, Msg, wParam, lParam);
}


LRESULT UiApp::hookGetMsgProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    if (nCode >= 0)
    {
        if (!session::overlayEnabled())
        {
            stopInputIntercept();
        }
        if (session::graphicsActive())
        {
            MSG* pMsg = (MSG*)lParam;
            if (pMsg->hwnd == graphicsWindow_ && wParam == PM_REMOVE)
            {
                if (pMsg->message == WM_KEYDOWN || pMsg->message == WM_SYSKEYDOWN
                    || pMsg->message == WM_KEYUP || pMsg->message == WM_SYSKEYUP)
                {
                    if (checkHotkey())
                    {
                        return 0;
                    }
                }

                if (pMsg->message == overlayMagicMsg_ && pMsg->wParam == OVERLAY_MAGIC)
                {
                    if (pMsg->lParam == OVERLAY_TASK)
                    {
                        _runTask();
                    }
                }

                if (!isIntercepting_)
                {
                    
#if AUTO_INPUT_INTERCEPT
                    if (!isInterceptingMouseAuto_ && !HookApp::instance()->isQuitSet() && !HookApp::instance()->overlayConnector()->isMousePressingOnOverlayWindow())
                    {
                        return CallNextHookEx(msgHook_, nCode, wParam, lParam);
                    }
                    
#else
                    return CallNextHookEx(msgHook_, nCode, wParam, lParam);
#endif
                }

                if (pMsg->message >= WM_MOUSEFIRST && pMsg->message <= WM_MOUSELAST)
                {
                    POINTS pt = MAKEPOINTS(pMsg->lParam);

                    if (overlay_game::pointInRect(pt, windowClientRect_))
                    {
#if AUTO_INPUT_INTERCEPT
                        if (!HookApp::instance()->overlayConnector()->processMouseMessage(pMsg->message, pMsg->wParam, pMsg->lParam, isIntercepting_))
#else
                        if (!HookApp::instance()->overlayConnector()->processMouseMessage(pMsg->message, pMsg->wParam, pMsg->lParam))
#endif // AUTO_INPUT_INTERCEPT

                        {
                            if (pMsg->message == WM_LBUTTONUP
                                || pMsg->message == WM_MBUTTONUP)
                            {
                                async([this]() { this->stopInputIntercept(); });
                            }
                        }
                        pMsg->message = WM_NULL;
                        return 0;
                    }
                }

                if ((pMsg->message >= WM_KEYFIRST && pMsg->message <= WM_KEYLAST)
                    || (pMsg->message >= WM_SYSKEYDOWN && pMsg->message <= WM_SYSDEADCHAR))
                {
                    // Only process keyboard events from the target game window
                    if (pMsg->hwnd != graphicsWindow_)
                    {
                        return CallNextHookEx(msgHook_, nCode, wParam, lParam);
                    }

				// Check for key remapping
				if (isKeyRemapped(pMsg->wParam))
				{
					int remappedKey = getRemappedKey(pMsg->wParam);
					INPUT in = { 0 };
					in.type = INPUT_KEYBOARD;
					in.ki.wVk = remappedKey;
					
					if (pMsg->message == WM_KEYUP || pMsg->message == WM_SYSKEYUP)
					{
						in.ki.dwFlags = KEYEVENTF_KEYUP;
					}
					
					SendInput(1, &in, sizeof(INPUT));
					pMsg->message = WM_NULL; // consume original key
					return 0;
				}

                    bool inputHandled = HookApp::instance()->overlayConnector()->processkeyboardMessage(pMsg->message, pMsg->wParam, pMsg->lParam);
                    if (inputHandled)
                    {
                        // if (pMsg->message == WM_KEYDOWN)
                        // {
                        //     if (!HookApp::instance()->overlayConnector()->directMessageInput())
                        //     {
                        //         TranslateMessage(pMsg);
                        //     }
                        // }
                        pMsg->message = WM_NULL;
                    }
                    return 0;
                }
            }
        }
    }
    return CallNextHookEx(msgHook_, nCode, wParam, lParam);
}

LRESULT UiApp::hookCallWndProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    if (nCode >= 0)
    {
        CWPSTRUCT* cwp = (CWPSTRUCT*)lParam;

        if (cwp->hwnd == graphicsWindow_)
        {
            if (cwp->message == WM_DESTROY)
            {
                LOGGER("n_overlay") << L"WM_DESTROY, " << graphicsWindow_;

                HookApp::instance()->overlayConnector()->sendGraphicsWindowDestroy(graphicsWindow_);

                unhookWindow();
                graphicsWindow_ = nullptr;

                HookApp::instance()->quit();
            }
            else if (cwp->message == WM_SIZE)
            {
                GetClientRect(graphicsWindow_, &windowClientRect_);
                HookApp::instance()->overlayConnector()->sendGraphicsWindowResizeEvent(graphicsWindow_, windowClientRect_.right - windowClientRect_.left, windowClientRect_.bottom - windowClientRect_.top);
            }

            else if (cwp->message == WM_KILLFOCUS)
            {
                windowFocus_ = false;
                HookApp::instance()->overlayConnector()->sendGraphicsWindowFocusEvent(graphicsWindow_, windowFocus_);
#if AUTO_INPUT_INTERCEPT
                stopAutoIntercept();
#endif
                stopInputIntercept();

            }
            else if (cwp->message == WM_SETFOCUS)
            {
                windowFocus_ = true;
                HookApp::instance()->overlayConnector()->sendGraphicsWindowFocusEvent(graphicsWindow_, windowFocus_);
            }
            else if (cwp->message == WM_SETCURSOR && LOWORD(cwp->lParam) == HTCLIENT)
            {
                if (_setCusror())
                {
                    return 0;
                }
            }
            else if (cwp->message == WM_NCHITTEST)
            {
                if (isIntercepting_)
                {
                    HookApp::instance()->overlayConnector()->processNCHITTEST(cwp->message, cwp->wParam, cwp->lParam);
                }
#if AUTO_INPUT_INTERCEPT
                else
                {
                    HookApp::instance()->overlayConnector()->processNCHITTEST(cwp->message, cwp->wParam, cwp->lParam, false) ? startAutoIntercept() : stopAutoIntercept();
                }
#endif
            }
        }
    }

    return CallNextHookEx(wndProcHook_, nCode, wParam, lParam);
}

LRESULT UiApp::hookCallWndRetProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam)
{
    if (nCode >= 0)
    {
        CWPRETSTRUCT * cwp = (CWPRETSTRUCT *)lParam;

        if (cwp->hwnd == graphicsWindow_)
        {
            if (cwp->message == WM_SETCURSOR && LOWORD(cwp->lParam) == HTCLIENT)
            {
                if (_setCusror())
                {
                    return 0;
                }
            }
        }
    }
    return CallNextHookEx(wndRetProcHook_, nCode, wParam, lParam);
}

bool UiApp::checkHotkey()
{
#if defined(_DEBUG) || defined(DEBUG)
    if (Windows::OrginalApi::GetAsyncKeyState(VK_F1))
    {
        toggleInputIntercept();
        return true;
    }
#endif

#ifndef HOTKEY_THREADED
    HotkeyCheck::instance()->checkHotkeys();
#endif // HOTKEY_THREADED

    return false;
}

void UiApp::_runTask()
{
    std::deque<std::function<void()>> tasks;
    {
        std::lock_guard<std::mutex> lock(taskLock_);
        tasks.swap(tasks_);
    }

    for (auto& task : tasks)
    {
        task();
    }
}

bool UiApp::_setCusror()
{
    if (isIntercepting_)
    {
        if (HookApp::instance()->overlayConnector()->processSetCursor())
        {
            return true;
        }
    }

#if AUTO_INPUT_INTERCEPT
    else if (isInterceptingMouseAuto_)
    {
        if (HookApp::instance()->overlayConnector()->processSetCursor())
        {
            return true;
        }
    }
#endif

    return false;
}

