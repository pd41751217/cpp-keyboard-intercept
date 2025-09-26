#pragma once
#include "message/gmessage.hpp"
#include <mutex>
#include <map>
#include <set>


class UiApp : public Storm::Trackable<>
{
    std::uint32_t overlayMagicMsg_ =0;
    std::mutex uilock_;
    HHOOK msgHook_ = nullptr;
    HHOOK wndProcHook_ = nullptr;
    HHOOK wndRetProcHook_ = nullptr;

    WNDPROC oldWndProc_ = nullptr;

    std::atomic<HWND> graphicsWindow_ = nullptr;
    std::atomic<bool> windowFocus_ = false;
    RECT windowClientRect_ = {};

    bool isIntercepting_ = false;

    std::mutex taskLock_;
    std::deque<std::function<void()>> tasks_;

    // Key remapping configuration
    mutable std::mutex remapLock_;
    std::map<int, int> keyRemaps_;  // fromKey -> toKey mapping
    
    // Key blocking and passing configuration
    mutable std::mutex blockPassLock_;
    std::set<int> blockedKeys_;     // Keys to block (consume)
    std::set<int> passedKeys_;      // Keys to pass through (monitor only)

#if ALLOW_ASSOC_SYSIME
    HIMC IMC_ = nullptr;
    HIMC originalIMC_ = nullptr;
#endif

#if AUTO_INPUT_INTERCEPT
    bool isInterceptingMouseAuto_ = false;
#endif

public:
    UiApp();
    ~UiApp();

    bool trySetupGraphicsWindow(HWND window);

    bool setup(HWND window);

    HWND window() const;
    bool windowSetted() const;
    bool windowFocused() const;

    void async(const std::function<void()>& task);

    void toggleInputIntercept();
    void startInputIntercept();
    void stopInputIntercept();


    bool shouldBlockOrginalMouseInput();
    bool shouldBlockOrginalKeyInput();
    bool shouldBlockOrginalCursorViz();

    bool isInterceptingInput();

    // Key remapping methods
    void setKeyRemaps(const std::vector<overlay::KeyRemap>& remaps);
    void clearKeyRemaps();
    bool isKeyRemapped(int keyCode) const;
    int getRemappedKey(int keyCode) const;
    
    // Key blocking and passing methods
    void setBlockedKeys(const std::set<int>& keys);
    void setPassedKeys(const std::set<int>& keys);
    void clearBlockedKeys();
    void clearPassedKeys();
    bool isKeyBlocked(int keyCode) const;
    bool isKeyPassed(int keyCode) const;

#if AUTO_INPUT_INTERCEPT
    bool isInterceptingMouseAuto();
    void startAutoIntercept();
    void stopAutoIntercept();

#endif

    bool hookWindow(HWND window);
    void unhookWindow();

    void updateWindowState(HWND window);
    void clearWindowState();

    std::uint32_t gameWidth() const;
    std::uint32_t gameHeight() const;

private:

    static LRESULT CALLBACK GetMsgProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);
    static LRESULT CALLBACK CallWndProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);
    static LRESULT CALLBACK CallWndRetProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);

    static LRESULT WINAPI WindowProc(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);

    LRESULT hookGetMsgProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);
    LRESULT hookCallWndProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);
    LRESULT hookCallWndRetProc(_In_ int nCode, _In_ WPARAM wParam, _In_ LPARAM lParam);

    LRESULT hookWindowProc(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);

    bool checkHotkey();

    void _runTask();

    bool _setCusror();
};
