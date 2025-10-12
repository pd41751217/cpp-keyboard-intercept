#include "stable.h"
#include "hook/apihook.hpp"
#include "overlay/session.h"
#include "overlay/hookapp.h"
#include "inputhook.h"
 

namespace {

typedef SHORT(WINAPI *pfnGetAsyncKeyState)(int vKey);
typedef SHORT(WINAPI *pfnGetKeyState)(int vKey);
typedef BOOL(WINAPI *pfnGetKeyboardState)(__out_ecount(256) PBYTE lpKeyState);
typedef UINT(WINAPI *pfnGetRawInputData)(HRAWINPUT hRawInput, UINT uiCommand, LPVOID pData, PUINT pcbSize, UINT cbSizeHeader);
typedef UINT(WINAPI *pfnGetRawInputBuffer)(PRAWINPUT pData, PUINT pcbSize, UINT cbSizeHeader);

typedef int (WINAPI *pfnShowCursor)(__in BOOL bShow);
typedef BOOL(WINAPI *pfnGetCursorPos)(LPPOINT lpPoint);
typedef BOOL(WINAPI *pfnSetCursorPos)(int X, int Y);
typedef HCURSOR(WINAPI *pfnSetCursor)(HCURSOR hCursor);
typedef HCURSOR(WINAPI *pfnGetCursor)();

pfnGetAsyncKeyState T_GetAsyncKeyState = nullptr;
pfnGetKeyState T_GetKeyState = nullptr;
pfnGetKeyboardState T_GetKeyboardState = nullptr;
pfnGetRawInputData T_GetRawInputData = nullptr;
pfnGetRawInputBuffer T_GetRawInputBuffer = nullptr;

pfnShowCursor T_ShowCursor = nullptr;
pfnGetCursorPos T_GetCursorPos = nullptr;
pfnSetCursorPos T_SetCursorPos = nullptr;
pfnSetCursor T_SetCursor = nullptr;
pfnGetCursor T_GetCursor = nullptr;


struct InputStatus
{

    std::atomic<bool> inputStateSaved = false;

    std::atomic<int> cursorCount = 0;

    std::atomic<bool> cursorVisible = false;

    std::atomic<POINT> cursorPos = POINT{ 0, 0 };

    std::atomic<HCURSOR> cursor = nullptr;
};

InputStatus g_savedInputStatus;

}

SHORT WINAPI H_GetAsyncKeyState(__in int vKey)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalKeyInput())
    {
        return 0;
    }
    else
    {
        // Check for key remapping
        if (HookApp::instance()->uiapp()->isKeyRemapped(vKey))
        {
            int remappedKey = HookApp::instance()->uiapp()->getRemappedKey(vKey);
            return Windows::OrginalApi::GetAsyncKeyState(remappedKey);
        }
        
        FILE* ff = fopen("input.log", "a");
        if (ff)
        {
            fprintf(ff, "GetAsyncKeyState: vKey=%u\n", vKey);
            fclose(ff);
        }
        return Windows::OrginalApi::GetAsyncKeyState(vKey);
    }
}


SHORT WINAPI H_GetKeyState(__in int vKey)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalKeyInput())
    {
        return 0;
    }
    else
    {
        // Check for key remapping
        if (HookApp::instance()->uiapp()->isKeyRemapped(vKey))
        {
            int remappedKey = HookApp::instance()->uiapp()->getRemappedKey(vKey);
            return Windows::OrginalApi::GetKeyState(remappedKey);
        }
        
        return Windows::OrginalApi::GetKeyState(vKey);
    }
}

BOOL WINAPI H_GetKeyboardState(__out_ecount(256) PBYTE lpKeyState)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalKeyInput())
    {
        memset(lpKeyState, 0, 256);
        return TRUE;
    }
    else
    {
        BOOL result = Windows::OrginalApi::GetKeyboardState(lpKeyState);
        
        // Apply key remapping to the keyboard state
        if (result && lpKeyState)
        {
            // Create a copy of the original state
            BYTE originalState[256];
            memcpy(originalState, lpKeyState, 256);
            
            // Clear the remapped keys in the original positions
            for (int i = 0; i < 256; i++)
            {
                if (HookApp::instance()->uiapp()->isKeyRemapped(i))
                {
                    lpKeyState[i] = 0;
                }
            }
            
            // Set the remapped keys in their new positions
            for (int i = 0; i < 256; i++)
            {
                if (HookApp::instance()->uiapp()->isKeyRemapped(i))
                {
                    int remappedKey = HookApp::instance()->uiapp()->getRemappedKey(i);
                    if (remappedKey >= 0 && remappedKey < 256)
                    {
                        lpKeyState[remappedKey] = originalState[i];
                    }
                }
            }
        }
        
        return result;
    }
}

int WINAPI H_ShowCursor(__in BOOL bShow)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalCursorViz())
    {
        int saveCount = g_savedInputStatus.cursorCount;
        g_savedInputStatus.cursorCount += bShow ? 1 : -1;
        g_savedInputStatus.cursorVisible = !!bShow;
        return saveCount;
    }
    else
    {
        return Windows::OrginalApi::ShowCursor(bShow);
    }
}

BOOL WINAPI H_GetCursorPos(LPPOINT lpPoint)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalMouseInput())
    {
        if (lpPoint)
        {
            *lpPoint = g_savedInputStatus.cursorPos;
        }
        return TRUE;
    }
    else
    {
        return Windows::OrginalApi::GetCursorPos(lpPoint);
    }
}

BOOL WINAPI H_SetCursorPos(int x, int y)
{
    // LOGGER("n_overlay") << "x :" << x << ", Y:" << y;

    if (HookApp::instance()->uiapp()->shouldBlockOrginalMouseInput())
    {
        g_savedInputStatus.cursorPos = POINT{x, y};
        return TRUE;
    }
    else
    {
        return Windows::OrginalApi::SetCursorPos(x, y);
    }
}

HCURSOR WINAPI H_SetCursor(HCURSOR cursor)
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalCursorViz())
    {
        g_savedInputStatus.cursor = cursor;
        return NULL;
    }
    else
    {
        return Windows::OrginalApi::SetCursor(cursor);
    }
}

HCURSOR WINAPI H_GetCursor()
{
    if (HookApp::instance()->uiapp()->shouldBlockOrginalCursorViz())
    {
        return g_savedInputStatus.cursor;
    }
    else
    {
        return Windows::OrginalApi::GetCursor();
    }
}

UINT WINAPI H_GetRawInputData(HRAWINPUT hRawInput, UINT uiCommand, LPVOID pData, PUINT pcbSize, UINT cbSizeHeader)
{
    UINT ret = 0;
    
    
    // Check if we should apply mouse modifications
    float movingSpeed = HookApp::instance()->overlayConnector()->getMovingSpeed();
    bool yAxisInvert = HookApp::instance()->overlayConnector()->getYAxisInvert();
    bool shouldModifySpeed = (movingSpeed != 1.0f) && HookApp::instance()->uiapp() && session::overlayEnabled() && session::graphicsActive();
    bool shouldInvertY = yAxisInvert && HookApp::instance()->uiapp() && session::overlayEnabled() && session::graphicsActive();
    bool shouldModifyInput = (shouldModifySpeed || shouldInvertY) && uiCommand == RID_INPUT && pData && pcbSize;
    
    if (shouldModifyInput)
    {
        // Get the size first
        UINT size = 0;
        Windows::OrginalApi::GetRawInputData(hRawInput, RID_INPUT, nullptr, &size, cbSizeHeader);
        
        if (size > 0 && size <= *pcbSize)
        {
            // Get the raw input data
            RAWINPUT* rawInput = (RAWINPUT*)malloc(size);
            if (rawInput)
            {
                UINT actualSize = Windows::OrginalApi::GetRawInputData(hRawInput, RID_INPUT, rawInput, &size, cbSizeHeader);
                
                if (actualSize > 0 && rawInput->header.dwType == RIM_TYPEMOUSE)
                {
                    
                    // Check if this is mouse movement (not button clicks)
                    // usFlags can be 0 for relative mouse movement, so we check if there's actual movement
                    if (rawInput->data.mouse.lLastX != 0 || rawInput->data.mouse.lLastY != 0)
                    {
                        // Apply speed multiplier to mouse movement deltas
                        if (shouldModifySpeed)
                        {
                            rawInput->data.mouse.lLastX = (LONG)(rawInput->data.mouse.lLastX * movingSpeed);
                            rawInput->data.mouse.lLastY = (LONG)(rawInput->data.mouse.lLastY * movingSpeed);
                        }
                        
                        // Apply Y-axis inversion
                        if (shouldInvertY)
                        {
                            rawInput->data.mouse.lLastY = -rawInput->data.mouse.lLastY;
                        }
                    }
                }
                
                // Copy modified data to output buffer
                memcpy(pData, rawInput, actualSize);
                *pcbSize = actualSize;
                ret = actualSize;
                
                free(rawInput);
            }
            else
            {
                // Fallback to original API if malloc fails
                ret = Windows::OrginalApi::GetRawInputData(hRawInput, uiCommand, pData, pcbSize, cbSizeHeader);
            }
        }
        else
        {
            // Fallback to original API
            ret = Windows::OrginalApi::GetRawInputData(hRawInput, uiCommand, pData, pcbSize, cbSizeHeader);
        }
    }
    else if (HookApp::instance()->uiapp()->isInterceptingInput())
    {
        // Original blocking behavior when intercepting input
        if (pcbSize)
        {
            if (pData == nullptr)
            {
                Windows::OrginalApi::GetRawInputData(hRawInput, uiCommand, nullptr, pcbSize, cbSizeHeader);
            }
            if (*pcbSize > 0)
            {
                LPBYTE lpb = new BYTE[*pcbSize];
                Windows::OrginalApi::GetRawInputData(hRawInput, uiCommand, lpb, pcbSize, cbSizeHeader);

                delete[] lpb;
                *pcbSize = 0;
            }
        }
        ret = 0;
    }
    else
    {
        // Normal pass-through
        ret = Windows::OrginalApi::GetRawInputData(hRawInput, uiCommand, pData, pcbSize, cbSizeHeader);
    }
    
    return ret;
}

UINT WINAPI H_GetRawInputBuffer(PRAWINPUT pData, PUINT pcbSize, UINT cbSizeHeader)
{
    if (HookApp::instance()->uiapp()->isInterceptingInput())
    {
        if (pcbSize)
        {
            if (pData == nullptr)
            {
                Windows::OrginalApi::GetRawInputBuffer(NULL, pcbSize, sizeof(RAWINPUTHEADER));
            }
            if (*pcbSize > 0)
            {
                UINT AllocatedBufferByteCount = *pcbSize * 16;
                RAWINPUT* RawInputBuffer = reinterpret_cast<RAWINPUT*>(malloc(AllocatedBufferByteCount));

                UINT AllocatedBufferByteCountTwo = AllocatedBufferByteCount;
                UINT Result = Windows::OrginalApi::GetRawInputBuffer(RawInputBuffer, &(AllocatedBufferByteCountTwo), sizeof(RAWINPUTHEADER));
                if (Result == -1)
                {
                    LOGGER("n_overlay") << "err :" << GetLastError();
                }
                else if (Result != 0)
                {
                    UINT RawInputCount = Result;
                    DefRawInputProc(&(RawInputBuffer), RawInputCount, sizeof(RAWINPUTHEADER));
                }

                free(RawInputBuffer);
            }
            *pcbSize = 0;
        }
        return 0;
    }
    else
    {
        return Windows::OrginalApi::GetRawInputBuffer(pData, pcbSize, cbSizeHeader);
    }
}

struct InputHooks
{
    std::unique_ptr<ApiHook<pfnGetAsyncKeyState> >  m_GetAsyncKeyStateHook;
    std::unique_ptr<ApiHook<pfnGetKeyState> >  m_GetKeyStateHook;
    std::unique_ptr<ApiHook<pfnGetKeyboardState> >  m_GetKeyboardStateHook;

    std::unique_ptr<ApiHook<pfnShowCursor> >  m_ShowCursorHook;
    std::unique_ptr<ApiHook<pfnGetCursorPos> >  m_GetCursorPosHook;
    std::unique_ptr<ApiHook<pfnSetCursorPos> >  m_SetCursorPosHook;

    std::unique_ptr<ApiHook<pfnSetCursor> >  m_SetCursorHook;
    std::unique_ptr<ApiHook<pfnGetCursor> >  m_GetCursorHook;

    std::unique_ptr<ApiHook<pfnGetRawInputData> >  m_GetRawInputDataHook;
    std::unique_ptr<ApiHook<pfnGetRawInputBuffer> >  m_GetRawInputBufferHook;

};

HMODULE g_hUser32 = nullptr;
static InputHooks g_inputHooks;


#define DoInputHook(hModule, Function) \
T_##Function = (pfn##Function)GetProcAddress(hModule, #Function);\
g_inputHooks.m_##Function##Hook.reset(new ApiHook<pfn##Function>(L#Function, (DWORD_PTR*)T_##Function, (DWORD_PTR*)H_##Function));\
result &= g_inputHooks.m_##Function##Hook->activeHook();\


bool InputHook::hook()
{
    __trace__;

    bool result = true;
    g_hUser32 = LoadLibraryA("user32.dll");

    DoInputHook(g_hUser32, GetAsyncKeyState);
    DoInputHook(g_hUser32, GetKeyState);
    DoInputHook(g_hUser32, GetKeyboardState);

    DoInputHook(g_hUser32, ShowCursor);
    DoInputHook(g_hUser32, GetCursorPos);
    DoInputHook(g_hUser32, SetCursorPos);
    DoInputHook(g_hUser32, SetCursor);
    DoInputHook(g_hUser32, GetCursor);

    // Manually create GetRawInputData hook instead of using macro
    T_GetRawInputData = (pfnGetRawInputData)GetProcAddress(g_hUser32, "GetRawInputData");
    if (T_GetRawInputData) {
        g_inputHooks.m_GetRawInputDataHook.reset(new ApiHook<pfnGetRawInputData>(L"GetRawInputData", (DWORD_PTR*)T_GetRawInputData, (DWORD_PTR*)H_GetRawInputData));
        result &= g_inputHooks.m_GetRawInputDataHook->activeHook();
    } else {
        result = false;
    }
    
    // DoInputHook(g_hUser32, GetRawInputBuffer);

    HookApp::instance()->overlayConnector()->sendInputHookInfo(result);

    this->hooked_ = result;
    return result;
}

void InputHook::unhook()
{
    g_inputHooks.m_GetAsyncKeyStateHook.reset();
    g_inputHooks.m_GetKeyStateHook.reset();
    g_inputHooks.m_GetKeyboardStateHook.reset();

    g_inputHooks.m_ShowCursorHook.reset();
    g_inputHooks.m_GetCursorPosHook.reset();
    g_inputHooks.m_SetCursorPosHook.reset();

    g_inputHooks.m_SetCursorHook.reset();
    g_inputHooks.m_GetCursorHook.reset();

    g_inputHooks.m_GetRawInputDataHook.reset();
    g_inputHooks.m_GetRawInputBufferHook.reset();
}

void InputHook::saveInputState()
{
    __trace__ ;

    if (!g_savedInputStatus.inputStateSaved)
    {
        g_savedInputStatus.cursorCount = Windows::OrginalApi::ShowCursor(TRUE);
        g_savedInputStatus.cursorCount -= 1;

        int showCursorCounter = Windows::OrginalApi::ShowCursor(TRUE);

        while (showCursorCounter  < 0)
        {
            auto nextCounter = Windows::OrginalApi::ShowCursor(TRUE);

            if (nextCounter == showCursorCounter)
            {
                __trace__ << "oops!";

                break;
            }

            showCursorCounter = nextCounter;
        }

        POINT cursorPos = { 0 };
        Windows::OrginalApi::GetCursorPos(&cursorPos);
        g_savedInputStatus.cursorPos.store(cursorPos);

        g_savedInputStatus.cursor = Windows::OrginalApi::GetCursor();

        g_savedInputStatus.inputStateSaved = true;
    }
}

void InputHook::restoreInputState()
{
    __trace__ ;

    if (g_savedInputStatus.inputStateSaved)
    {
        int curCursorCount = Windows::OrginalApi::ShowCursor(FALSE);

        if (g_savedInputStatus.cursorCount != curCursorCount)
        {
            BOOL showOrHide = g_savedInputStatus.cursorCount > curCursorCount ? TRUE : FALSE;

            int showCursorCounter = Windows::OrginalApi::ShowCursor(showOrHide);

            while (showCursorCounter != g_savedInputStatus.cursorCount)
            {

                auto nextCounter = Windows::OrginalApi::ShowCursor(showOrHide);

                if (nextCounter == showCursorCounter)
                {
                    __trace__ << "oops!" ;

                    break;
                }

                showCursorCounter = nextCounter;
            }
        }

        Windows::OrginalApi::SetCursor(g_savedInputStatus.cursor);
        if (g_savedInputStatus.cursorVisible)
        {
            Windows::OrginalApi::ShowCursor(TRUE);
        }

        g_savedInputStatus.inputStateSaved = false;
    }
}


SHORT Windows::OrginalApi::GetAsyncKeyState(_In_ int vKey)
{
    if (g_inputHooks.m_GetAsyncKeyStateHook)
    {
        return g_inputHooks.m_GetAsyncKeyStateHook->callOrginal<SHORT>(vKey);
    }
    else
    {
        return ::GetAsyncKeyState(vKey);
    }
}

SHORT Windows::OrginalApi::GetKeyState(_In_ int vKey)
{
    if (g_inputHooks.m_GetKeyStateHook)
    {
        return g_inputHooks.m_GetKeyStateHook->callOrginal<SHORT>(vKey);
    }
    else
    {
        return ::GetKeyState(vKey);
    }
}

BOOL Windows::OrginalApi::GetKeyboardState(__out_ecount(256) PBYTE lpKeyState)
{
    if (g_inputHooks.m_GetKeyboardStateHook)
    {
        return g_inputHooks.m_GetKeyboardStateHook->callOrginal<BOOL>(lpKeyState);
    }
    else
    {
        return ::GetKeyboardState(lpKeyState);
    }
}

INT Windows::OrginalApi::ShowCursor(__in BOOL bShow)
{
    // LOGGER("n_overlay") << "bShow :" << bShow;

    if (g_inputHooks.m_ShowCursorHook)
    {
        return g_inputHooks.m_ShowCursorHook->callOrginal<INT>(bShow);
    }
    else
    {
        return ::ShowCursor(bShow);
    }
}

BOOL Windows::OrginalApi::GetCursorPos(LPPOINT lpPoint)
{
    if (g_inputHooks.m_GetCursorPosHook)
    {
        return g_inputHooks.m_GetCursorPosHook->callOrginal<BOOL>(lpPoint);
    }
    else
    {
        return ::GetCursorPos(lpPoint);
    }
}

BOOL Windows::OrginalApi::SetCursorPos(int X, int Y)
{
    if (g_inputHooks.m_SetCursorPosHook)
    {
        return g_inputHooks.m_SetCursorPosHook->callOrginal<BOOL>(X, Y);
    }
    else
    {
        return ::SetCursorPos(X, Y);
    }
}

HCURSOR Windows::OrginalApi::GetCursor()
{
    if (g_inputHooks.m_GetCursorHook)
    {
        return g_inputHooks.m_GetCursorHook->callOrginal<HCURSOR>();
    }
    else
    {
        return ::GetCursor();
    }
}

HCURSOR Windows::OrginalApi::SetCursor(HCURSOR cursor)
{
    if (g_inputHooks.m_SetCursorHook)
    {
        return g_inputHooks.m_SetCursorHook->callOrginal<HCURSOR>(cursor);
    }
    else
    {
        return ::SetCursor(cursor);
    }
}

UINT Windows::OrginalApi::GetRawInputData(HRAWINPUT hRawInput, UINT uiCommand, LPVOID pData, PUINT pcbSize, UINT cbSizeHeader)
{
    if (g_inputHooks.m_GetRawInputDataHook)
    {
        return g_inputHooks.m_GetRawInputDataHook->callOrginal<UINT>(hRawInput, uiCommand, pData, pcbSize, cbSizeHeader);
    }
    else
    {
        return ::GetRawInputData(hRawInput, uiCommand, pData, pcbSize, cbSizeHeader);
    }
}

UINT Windows::OrginalApi::GetRawInputBuffer(PRAWINPUT pData, PUINT pcbSize, UINT cbSizeHeader)
{
    if (g_inputHooks.m_GetRawInputBufferHook)
    {
        return g_inputHooks.m_GetRawInputBufferHook->callOrginal<UINT>(pData, pcbSize, cbSizeHeader);
    }
    else
    {
        return ::GetRawInputBuffer(pData, pcbSize, cbSizeHeader);
    }
}
