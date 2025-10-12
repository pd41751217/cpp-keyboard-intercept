import { exec } from 'child_process';
import { BrowserWindow, screen, shell, globalShortcut, ipcMain } from 'electron';
import { Subject, interval } from 'rxjs';
import { Subscription } from 'rxjs/internal/Subscription';
import { filter, first } from 'rxjs/operators';
import { AppsManager, Hook, HookApp, HookAppStatus } from '../../hook/apps-manager';
import { OverlayNodeApi } from './interfaces/overlay-lib.interface';

import * as os from 'os';

const overlayApiLib = require('../../../public/overlay-api.node') as OverlayNodeApi;

const WindowDefaultOptions: Electron.BrowserWindowConstructorOptions = {
  x: 0,
  y: 0,
  height: 730,
  width: 1000,
  frame: false,
  show: false,
  transparent: true,
  resizable: false,
  alwaysOnTop: true, // Keep window on top to receive keyboard events
  skipTaskbar: true, // Don't show in taskbar
  webPreferences: {
    // TODO: Comment this to use the shared texture
    offscreen: true,
    nodeIntegration: true,
    contextIsolation: false,
    // Allow popups and dropdowns to render properly
    webSecurity: false,
    // TODO: Uncomment this to share the texture with the overlay-api
    // offscreen: {
    //   useSharedTexture: true,
    // },
  },
};

enum AppWindows {
  MAIN_WINDOW = 'main-window',
}

enum WindowsPlacement {
  MAIN_WINDOW = 'StatusBar',
  MENU = 'MainOverlay',
  OVERLAY_TIP = 'OverlayTip',
}

export class OverlayApiLib {
  private windows: Record<string, { id: string; ref: Electron.BrowserWindow }> = {};
  private injectIntervalSub: Subscription;
  private hooksEnabled = false;

  public onHook$ = new Subject<number>();
  public overlayApi: OverlayNodeApi;
  public isStarted: boolean = false;
  public width: number = 0;
  public height: number = 0;

  public appsManager = new AppsManager();

  public renderWindow: BrowserWindow;

  // Keyboard event subjects
  public onKeyDown$ = new Subject<{ keyCode: number; modifiers: number; originalKey?: number }>();
  public onKeyUp$ = new Subject<{ keyCode: number; modifiers: number; originalKey?: number }>();

  // Keyboard configuration state
  private keyMappings = new Map<number, number>(); // originalKey → newKey
  private blockedKeys = new Set<number>();
  private interceptMode: 'block_and_replace' | 'block_only' | 'monitor' | 'selective_remap' = 'monitor';
  
  // Mouse configuration state
  private swapMouseButtons: boolean = false;
  
  // Global hotkey handling
  private homeKeyCode = 36; // VK_HOME
  private endKeyCode = 35;  // VK_END

  public async init(): Promise<void> {
    console.log( 'init', this.isStarted);
    if (!this.isStarted) {
      this.startOverlay();

      this.setCallbackEvents();

      await this.createRenderWindow();

      // Listen for settings from renderer to apply keyboard config
      this.registerSettingsIpc();

      this.isStarted = true;
    }
  }

  public startOverlay(): void {
    this.overlayApi = overlayApiLib;
    this.overlayApi.start();
  }

  public deinit(): void {
    // Unregister global shortcuts
    globalShortcut.unregisterAll();
  }


  public startIntercept(): void {
    console.log('Starting input intercept...');
    this.overlayApi.sendCommand({
      command: 'input.intercept',
      intercept: true,
    });
  }

  public stopIntercept(): void {
    this.overlayApi.sendCommand({
      command: 'input.intercept',
      intercept: false,
    });
  }

  public setCallbackEvents(): void {
    this.overlayApi.setEventCallback(
      (
        event: string,
        payload: any,
      ) => {
        //console.log(`overlay: event ${event} payload ${JSON.stringify(payload)}`);
        if (event === 'game.input') {
          if (payload.windowId !== undefined) {
            const target = BrowserWindow.fromId(payload.windowId);
            if (target) {
              const inputEvent = this.overlayApi.translateInputEvent(payload as any);
              if (inputEvent) {
                // Apply DPI scaling compensation similar to goverlay
                const display = screen.getDisplayMatching(target.getBounds());
                const scale = display?.scaleFactor || 1;
                if ('x' in inputEvent) inputEvent.x = Math.round(inputEvent.x / scale);
                if ('y' in inputEvent) inputEvent.y = Math.round(inputEvent.y / scale);
                target.webContents.sendInputEvent(inputEvent as any);
              }
            }
          }
        } else if (event === 'game.keyboard.down') {
          if (payload.keyCode !== undefined) {
            console.log('keyboard down', payload.keyCode, payload.modifiers, payload.originalKey);
            this.onKeyDown$.next({
              keyCode: payload.keyCode,
              modifiers: payload.modifiers || 0,
              originalKey: payload.originalKey,
            });
          }
        } else if (event === 'game.keyboard.up') {
          if (payload.keyCode !== undefined) {
            console.log('keyboard up', payload.keyCode, payload.modifiers, payload.originalKey);
            this.onKeyUp$.next({
              keyCode: payload.keyCode,
              modifiers: payload.modifiers || 0,
              originalKey: payload.originalKey,
            });
          }
        } else if (event === 'game.keyboard.event') {
          if (payload.keyCode !== undefined && payload.isDown !== undefined) {
            console.log('keyboard event', payload.keyCode, payload.isDown, payload.modifiers, payload.originalKey);
            const eventData = {
              keyCode: payload.keyCode,
              modifiers: payload.modifiers || 0,
              originalKey: payload.originalKey,
            };
            if (payload.isDown) {
              this.onKeyDown$.next(eventData);
            } else {
              this.onKeyUp$.next(eventData);
            }
          }
        } else if (event === 'graphics.window.event.focus') {
          if (payload.focusWindowId) {
            console.log('focus', payload.focusWindowId);
          }
        } else if (event === 'game.window.focused') {
          if (payload.focusWindowId !== undefined) {
            BrowserWindow.getAllWindows().forEach((w) => w.blurWebView());
            const focusWin = BrowserWindow.fromId(payload.focusWindowId);
            if (focusWin) {
              focusWin.focusOnWebView();
            }
          }
        } else if (event === 'game.hook') {
          if (payload.pid) {
            console.log('hook', payload.pid);
          }
        } else if (event === 'game.exit') {
          if (payload.pid) {
            this.onGameExit(payload.pid);
          }
        } else if (event === 'log') {
          if (payload.message) {
            console.log('log', payload.message);
          }
        } else if (event === 'game.log') {
          if (payload.message) {
            console.log('game.log', payload.message);
          }
        } else if (event === 'sharedmem.framebuffer') {
          if (payload.width && payload.height) {
            console.log('sharedmem.framebuffer', payload.width, payload.height);
          }
        } else if (event === 'game.process') {
          if (payload.pid) {
            console.log('game.process', payload.pid);
            
            // Send ingamemenuKey configuration to native layer when game process is detected
            const app = this.appsManager.getAppByPid(payload.pid);
            if (app && app.ingamemenuKey !== undefined) {
              console.log('Sending ingamemenuKey to native layer for game process:', app.ingamemenuKey);
              this.setInGameMenuKey(app.ingamemenuKey);
            }
          }
        } else if (event === 'graphics.fps') {
          //console.log('graphics.fps', payload);
        } else if (event === 'graphics.window') {
          if (payload.width && payload.height) {
            console.log('graphics.window', payload.width, payload.height);
          }
        } else if (event === 'graphics.window.event.resize') {
          if (payload.width && payload.height) {
            if (payload.width !== this.width || payload.height !== this.height) {
              console.log('graphics.window.event.resize', payload.width, payload.height);
            }
          }
        } else if (event === 'game.input.intercept') {
          console.log('game.input.intercept', payload?.intercepting);
        } else if (event === 'game.hotkey.down') {
          console.log('In-game hotkey pressed:', payload?.name);
          if (payload?.name === 'overlay.show') {
            console.log('Home key pressed in game - showing overlay');
            this.showOverlay();
          } else if (payload?.name === 'overlay.hide') {
            console.log('End key pressed in game - hiding overlay');
            this.hideOverlay();
          }
        } else {
          console.log(`overlay: event ${event} info ${JSON.stringify(payload)}`);
        }
      },
    );
  }

  public quit(): void {
    for (const window of Object.values(this.windows)) {
      window.ref.close();
    }
    if (this.overlayApi) {
      this.overlayApi.stop();
    }
  }

  private onGameExit(pid: number): void {
    if (this.appsManager.modifyAppByPid(pid, { status: HookAppStatus.WAITING })?.id) {
      this.appsManager.modifyAppByPid(pid, { status: HookAppStatus.WAITING });
    }
  }

  private onGameHook(pid: number): void {
    const appToInject = this.appsManager.getAppByPid(pid);

    if (!appToInject) {
      // logger.instance.error(`overlay: game: app not found ${pid}`);
      return;
    }

    if (appToInject.status === HookAppStatus.INJECTED) {
      // logger.instance.info(`overlay: game: app already injected and hooked ${appToInject.id}`);
    } else {
      this.appsManager.modifyAppById(appToInject.id, { status: HookAppStatus.INJECTED });
    }

    // logger.instance.info(`overlay: game: waiting to game exit ${pid}`);

    const pidSub: Subscription = interval(5000).subscribe(() => {
      exec(`tasklist /fi "pid eq ${pid}"`, (error, stdout) => {
        if (stdout?.includes('No tasks are running')) {
          this.onGameExit(pid);
          pidSub?.unsubscribe();
        }
      });
    });
  }

  private hook(windowsList, appToInject: HookApp): void {
    const appInjectedFound = this.appsManager.getAppById(appToInject.id);

    if (appInjectedFound.status === HookAppStatus.INJECTED) {
      return;
    }

    const windowsFound =
      [...windowsList].filter((window) => window.title.toLowerCase().indexOf(appToInject.windowName.toLowerCase()) !== -1)[0] ?? null;
    if (!windowsFound) {
      return;
    }

    this.appsManager.modifyAppById(appToInject.id, { pid: windowsFound.processId, status: HookAppStatus.INJECTING });

    const a = this.overlayApi.injectProcess(windowsFound);

    console.log(`injector: injectProcess ${JSON.stringify(a)}`);
    if (a.injectSucceed) {
      this.onHook$
        .pipe(
          filter((pid) => pid === windowsFound.processId),
          first(),
        )
        .subscribe((pid: number) => {
          // logger.instance.info(`injector: hooking ${appToInject.id}`);
          this.onGameHook(pid);
        });
      this.onHook$.next(windowsFound.processId);
    } else {
      this.onHook$
        .pipe(
          filter((pid) => pid === windowsFound.processId),
          first(),
        )
        .subscribe((pid: number) => {
          // logger.instance.info(`injector: hooking ${appToInject.id}`);
          this.onGameHook(pid);
        });
    }
  }

  public startInjectInterval(): void {
    this.hooksEnabled = true;
    this.injectIntervalSub = interval(5000)
      .pipe(filter(() => this.hooksEnabled))
      .subscribe(() => {
        const appsWaiting = this.appsManager.getAppByStatus(HookAppStatus.WAITING);

        if (appsWaiting.length) {
          const windowsList = this.overlayApi.getTopWindows();

          appsWaiting.forEach((app: HookApp) => {
            this.hook(windowsList, app);
          });
        }
      });
  }

  public stopInjectInterval(): void {
    this.hooksEnabled = false;
    this.injectIntervalSub?.unsubscribe();
  }

  public removeHook(hooks: Hook[]): void {
    hooks.forEach((hook) => {
      this.appsManager.removeAppById(hook.id);
    });
  }

  public reloadWindows(): void {
    for (const window of Object.values(this.windows)) {
      window.ref.reload();
    }
  }

  public addHook(hooks: Hook[]): void {
    hooks.forEach((hook) => {
      if (this.appsManager.getAppById(hook.id)) {
        if (this.appsManager.getAppById(hook.id).status === HookAppStatus.INJECTED && this.appsManager.getAppById(hook.id).pid) {
          this.onGameHook(this.appsManager.getAppById(hook.id).pid);
        }
        return;
      }
      const appAdded = this.appsManager.addApp(hook.id, hook.windowName, 0, HookAppStatus.WAITING, hook.ingamemenuKey);

      if (appAdded.status === HookAppStatus.INJECTED && appAdded.pid) {
        this.onGameHook(appAdded.pid);
      }
    });
  }

  public changeWindowSize(windowId: string, windowWidth: number, windowHeight: number, windowX: number, windowY: number): void {
    const window = this.windows[windowId];

    if (window) {
      const width: number = windowWidth ? windowWidth : window.ref.getBounds().width;
      const height: number = windowHeight ? windowHeight : window.ref.getBounds().height;
      const x: number = windowX ? windowX : window.ref.getBounds().x;
      const y: number = windowY ? windowY : window.ref.getBounds().y;

      window.ref.setMinimumSize(width, height);
      window.ref.setSize(width, height);

      this.overlayApi.sendWindowBounds(window.ref.id, {
        rect: {
          x,
          y,
          width: width,
          height: height,
        },
      });
    } else {
      console.error(`overlay: change size window ${windowId} not found`);
    }
  }

  private createWindow(windowId: string, option: Electron.BrowserWindowConstructorOptions): BrowserWindow {
    const window = new BrowserWindow(option);
    this.windows[windowId] = { id: windowId, ref: window };

    window.on('closed', () => {
      delete this.windows[windowId];
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    if (global.DEBUG) {
      window.webContents.on(
        "before-input-event",
        (event: Electron.Event, input: Electron.Input) => {
          if (input.key === "F12" && input.type === "keyDown") {
            window.webContents.openDevTools();
          }
        }
      );
    }

    return window;
  }

  private addOverlayWindow(
    name: string,
    window: Electron.BrowserWindow,
    dragborder: number = 0,
    captionHeight: number = 0,
    transparent: boolean = false,
  ): BrowserWindow {
    const bounds = window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const scale = display?.scaleFactor || 1;

    this.overlayApi.addWindow(window.id, {
      name,
      transparent,
      resizable: window.isResizable(),
      maxWidth: window.isResizable() ? display.bounds.width : bounds.width,
      maxHeight: window.isResizable() ? display.bounds.height : bounds.height,
      minWidth: window.isResizable() ? 100 : bounds.width,
      minHeight: window.isResizable() ? 100 : bounds.height,
      nativeHandle: window.getNativeWindowHandle().readUInt32LE(0),
      rect: {
        x: bounds.x,
        y: bounds.y,
        width: Math.floor(bounds.width * scale),
        height: Math.floor(bounds.height * scale),
      },
      caption: {
        left: Math.floor(dragborder * scale),
        right: Math.floor(dragborder * scale),
        top: Math.floor(dragborder * scale),
        height: Math.floor(captionHeight * scale),
      },
      dragBorderWidth: dragborder,
    });

    // TODO: Comment this to use the shared texture
    window.webContents.on('paint', (event, dirty, image) => {
      this.overlayApi.sendFrameBuffer(window.id, image.getBitmap(), image.getSize().width, image.getSize().height);
    });
    // TODO: Uncomment this to share the texture with the overlay-api
    // window.webContents.setFrameRate(240);
    // window.webContents.on('paint', (event) => {
    //   const tex = event.texture;
    //   if (tex) {
    //     const handle = tex.textureInfo.sharedTextureHandle;
    //     let handleNumber;

    //     if (os.endianness() == 'LE') {
    //       handleNumber = handle.readInt32LE();
    //     } else {
    //       handleNumber = handle.readInt32BE();
    //     }

    //     // Pass the handle directly as Buffer without converting it to a number
    //     if (handle) {
    //       this.overlayApi.sendFrameBuffer(
    //         window.id,
    //         handleNumber, // Pass the Buffer directly
    //         tex.textureInfo.codedSize.width,
    //         tex.textureInfo.codedSize.height,
    //       );

    //       // Release the texture to avoid memory leaks
    //       tex.release();
    //     }
    //   }
    // });

    window.on('ready-to-show', () => {
      window.focusOnWebView();
    });

    // Keep native window rect in sync on move/resize
    const sendBounds = () => {
      const b = window.getBounds();
      const d = screen.getDisplayMatching(b);
      const s = d?.scaleFactor || 1;
      this.overlayApi.sendWindowBounds(window.id, {
        rect: {
          x: b.x,
          y: b.y,
          width: Math.floor(b.width * s),
          height: Math.floor(b.height * s),
        },
      });
    };
    window.on('move', sendBounds);
    window.on('resize', sendBounds);

    window.on('closed', () => {
      this.overlayApi.closeWindow(window.id);
      const windowRef = this.windows[window.id];
      if (windowRef) {
        windowRef.ref.close();
      }
    });

    // Mirror goverlay: forward cursor changes to native (improves pointer feedback)
    window.webContents.on('cursor-changed', (event, type) => {
      let cursor = '';
      switch (type) {
        case 'default': cursor = 'IDC_ARROW'; break;
        case 'pointer': cursor = 'IDC_HAND'; break;
        case 'crosshair': cursor = 'IDC_CROSS'; break;
        case 'text': cursor = 'IDC_IBEAM'; break;
        case 'wait': cursor = 'IDC_WAIT'; break;
        case 'help': cursor = 'IDC_HELP'; break;
        case 'move': cursor = 'IDC_SIZEALL'; break;
        case 'nwse-resize': cursor = 'IDC_SIZENWSE'; break;
        case 'nesw-resize': cursor = 'IDC_SIZENESW'; break;
        case 'ns-resize': cursor = 'IDC_SIZENS'; break;
        case 'ew-resize': cursor = 'IDC_SIZEWE'; break;
        case 'none': cursor = ''; break;
      }
      this.overlayApi.sendCommand({ command: 'cursor', cursor });
    });

    return window;
  }

  public async createRenderWindow(): Promise<void> {
    try {
      const window = this.createWindow(AppWindows.MAIN_WINDOW, WindowDefaultOptions);
      await window.loadURL('http://localhost:4100');

      this.renderWindow = this.addOverlayWindow(WindowsPlacement.MAIN_WINDOW, window, 0, 20, true);
      
      // Add keyboard event handling for Home/End keys
      //this.setupKeyboardShortcuts(window);
    } catch (error) {
      console.error(`overlay: Messages UI error ${(error as Error).message}`);
      throw error;
    }
  }

  // ==============================
  // KEYBOARD MODULE METHODS
  // ==============================

  // Remapping APIs
  public setKeyMapping(originalKey: number, newKey: number): void {
    this.keyMappings.set(originalKey, newKey);
    this.syncKeyboardConfig();
  }

  public removeKeyMapping(originalKey: number): void {
    this.keyMappings.delete(originalKey);
    this.syncKeyboardConfig();
  }

  public clearAllMappings(): void {
    this.keyMappings.clear();
    this.syncKeyboardConfig();
  }

  public blockKeys(keyCodes: number[], block: boolean): void {
    keyCodes.forEach((keyCode) => {
      if (block) {
        this.blockedKeys.add(keyCode);
      } else {
        this.blockedKeys.delete(keyCode);
      }
    });
    this.syncKeyboardConfig();
  }

  // Mode API
  public setInterceptMode(mode: 'block_and_replace' | 'block_only' | 'monitor' | 'selective_remap'): void {
    this.interceptMode = mode;
    this.overlayApi.sendCommand({
      command: 'keyboard.mode',
      mode: mode,
    });
  }

  // Event injection
  public sendKey(keyCode: number, modifiers: number = 0): void {
    // Send key down
    this.overlayApi.sendCommand({
      command: 'keyboard.inject',
      keyCode: keyCode,
      modifiers: modifiers,
      isDown: true,
    });

    // Send key up after small delay
    setTimeout(() => {
      this.overlayApi.sendCommand({
        command: 'keyboard.inject',
        keyCode: keyCode,
        modifiers: modifiers,
        isDown: false,
      });
    }, 50);
  }

  // Send ingamemenuKey configuration to native layer
  public setInGameMenuKey(keyCode: number): void {
    this.overlayApi.sendCommand({
      command: 'game.ingamemenu',
      keyCode: keyCode,
    });
  }

  // Convenience methods for event subscription
  public onKeyDown(callback: (keyCode: number, modifiers: number, originalKey?: number) => void): void {
    this.onKeyDown$.subscribe((event) => {
      callback(event.keyCode, event.modifiers, event.originalKey);
    });
  }

  public onKeyUp(callback: (keyCode: number, modifiers: number, originalKey?: number) => void): void {
    this.onKeyUp$.subscribe((event) => {
      callback(event.keyCode, event.modifiers, event.originalKey);
    });
  }

  // Private method to sync keyboard configuration with native layer
  private syncKeyboardConfig(): void {
    // Send key mappings
    if (this.keyMappings.size > 0) {
      const mappings: Record<number, number> = {};
      this.keyMappings.forEach((newKey, originalKey) => {
        mappings[originalKey] = newKey;
      });
      console.log('[syncKeyboardConfig] Sending mappings:', mappings);
      console.log('[syncKeyboardConfig] Calling overlayApi.sendCommand...');
      try {
        this.overlayApi.sendCommand({
          command: 'keyboard.remap',
          mappings: mappings,
        });
        console.log('[syncKeyboardConfig] sendCommand completed successfully');
      } catch (error) {
        console.error('[syncKeyboardConfig] sendCommand failed:', error);
      }
    } else {
      console.log('[syncKeyboardConfig] No mappings to send');
    }

    // Send blocked keys
    if (this.blockedKeys.size > 0) {
      this.overlayApi.sendCommand({
        command: 'keyboard.block',
        blockedKeys: Array.from(this.blockedKeys),
      });
    }
  }

  // Apply settings from renderer
  private registerSettingsIpc(): void {
    ipcMain.removeAllListeners('overlay:apply-settings');
    ipcMain.on('overlay:apply-settings', (event, settings: { keyboard?: Array<{ sourceKey: string; mode: string; targetKey: string }>; mouse?: { swapButtons?: boolean; numpad5Primary?: boolean; numpadPlusSecondary?: boolean; yAxisInvert?: boolean; movingSpeed?: number } }) => {
      try {
        if (settings.keyboard) {
          this.applyKeyboardSettings(settings.keyboard);
        }
        if (settings.mouse) {
          this.applyMouseSettings(settings.mouse);
        }
      } catch (e) {
        console.error('Failed to apply settings:', e);
      }
    });
  }

  private applyMouseSettings(mouse: { swapButtons?: boolean; numpad5Primary?: boolean; numpadPlusSecondary?: boolean; yAxisInvert?: boolean; movingSpeed?: number }): void {
    try {
      // Swap primary/secondary buttons (handled in native/game layer)
      if (mouse.swapButtons !== undefined) {
        this.overlayApi.sendCommand({ command: 'mouse.swap', enabled: !!mouse.swapButtons } as any);
      }
      
      // Numpad 5 as primary button (handled in native/game layer)
      if (mouse.numpad5Primary !== undefined) {
        console.log('[MouseSettings] Sending numpad5Primary command:', !!mouse.numpad5Primary);
        this.overlayApi.sendCommand({ command: 'mouse.numpad5primary', enabled: !!mouse.numpad5Primary } as any);
      }
      
      // Numpad + as secondary button (handled in native/game layer)
      if (mouse.numpadPlusSecondary !== undefined) {
        console.log('[MouseSettings] Sending numpadPlusSecondary command:', !!mouse.numpadPlusSecondary);
        this.overlayApi.sendCommand({ command: 'mouse.numpadplussecondary', enabled: !!mouse.numpadPlusSecondary } as any);
      }

      // Y-axis revert (handled in native/game layer)
      if (mouse.yAxisInvert !== undefined) {
        console.log('[MouseSettings] Sending yAxisInvert command:', !!mouse.yAxisInvert);
        this.overlayApi.sendCommand({ command: 'mouse.yaxisinvert', enabled: !!mouse.yAxisInvert } as any);
      }

      // Moving speed (handled in native/game layer)
      if (mouse.movingSpeed !== undefined) {
        // Clamp speed to valid range (0.1 - 5.0)
        const clampedSpeed = Math.max(0.1, Math.min(5.0, mouse.movingSpeed));
        if (clampedSpeed !== mouse.movingSpeed) {
          console.warn('[MouseSettings] Moving speed clamped from', mouse.movingSpeed, 'to', clampedSpeed);
        }
        console.log('[MouseSettings] Sending movingSpeed command:', clampedSpeed);
        this.overlayApi.sendCommand({ command: 'mouse.movingspeed', speed: clampedSpeed } as any);
      }
      
      // TODO: Wire additional mouse settings in later steps
    } catch (err) {
      console.error('[MouseSettings] Failed to apply mouse settings', err);
    }
  }

  private applyKeyboardSettings(keyboard: Array<{ sourceKey: string; mode: string; targetKey: string }>): void {
    // Clear current config
    this.keyMappings.clear();
    this.blockedKeys.clear();

    const toVk = (name?: string): number | null => (name ? this.mapKeyNameToVirtualKey(name) : null);

    console.log('[KeyboardSettings] Processing mappings:', keyboard?.length || 0);

    // Separate keys by mode
    const remapMappings: Record<number, number> = {};
    const blockedKeys: number[] = [];
    const passedKeys: number[] = [];

    for (const m of keyboard || []) {
      const sourceVk = toVk(m.sourceKey);
      if (!sourceVk) {
        console.log('[KeyboardSettings] Invalid source key:', m.sourceKey);
        continue;
      }

      const mode = (m.mode || '').toLowerCase();
      console.log('[KeyboardSettings] Processing:', m.sourceKey, '->', m.targetKey, 'mode:', mode);
      
      if (mode === 'mapping' || mode === 'remap') {
        const targetVk = toVk(m.targetKey);
        if (targetVk) {
          remapMappings[sourceVk] = targetVk;
          this.keyMappings.set(sourceVk, targetVk);
          console.log('[KeyboardSettings] Added mapping:', sourceVk, '->', targetVk);
        } else {
          console.log('[KeyboardSettings] Invalid target key:', m.targetKey);
        }
      } else if (mode === 'block') {
        blockedKeys.push(sourceVk);
        this.blockedKeys.add(sourceVk);
        console.log('[KeyboardSettings] Added blocked key:', sourceVk);
      } else if (mode === 'pass') {
        passedKeys.push(sourceVk);
        console.log('[KeyboardSettings] Added passed key:', sourceVk);
      } else {
        console.log('[KeyboardSettings] Unknown mode:', m.mode);
        // monitor/ignore → no action
      }
    }

    // Send remap mappings to C++ DLL
    if (Object.keys(remapMappings).length > 0) {
      try {
        this.overlayApi.sendCommand({
          command: 'keyboard.remap',
          mappings: remapMappings
        });
        console.log('[KeyboardSettings] Sent remap mappings to C++ DLL');
      } catch (error) {
        console.error('[KeyboardSettings] Failed to send remap mappings:', error);
      }
    }

    // Send blocked keys to C++ DLL
    if (blockedKeys.length > 0) {
      try {
        this.overlayApi.sendCommand({
          command: 'keyboard.block',
          blockedKeys: blockedKeys
        });
        console.log('[KeyboardSettings] Sent blocked keys to C++ DLL:', blockedKeys);
      } catch (error) {
        console.error('[KeyboardSettings] Failed to send blocked keys:', error);
      }
    }

    // Send passed keys to C++ DLL
    if (passedKeys.length > 0) {
      try {
        this.overlayApi.sendCommand({
          command: 'keyboard.pass',
          passedKeys: passedKeys
        });
        console.log('[KeyboardSettings] Sent passed keys to C++ DLL:', passedKeys);
      } catch (error) {
        console.error('[KeyboardSettings] Failed to send passed keys:', error);
      }
    }

    // Use selective_remap so native uses both maps and blocks
    this.setInterceptMode('selective_remap');
    this.syncKeyboardConfig();
  }

  // Map UI key names to Win32 virtual-key codes
  private mapKeyNameToVirtualKey(name: string): number | null {
    const n = name.trim();
    const upper = n.toUpperCase();
    const vk: Record<string, number> = {
      'BACKSPACE': 0x08, 'TAB': 0x09, 'ENTER': 0x0D, 'RETURN': 0x0D, 'SHIFT': 0x10, 'CTRL': 0x11, 'CONTROL': 0x11,
      'ALT': 0x12, 'PAUSE': 0x13, 'CAPSLOCK': 0x14, 'ESC': 0x1B, 'ESCAPE': 0x1B, 'SPACE': 0x20, 'PAGEUP': 0x21,
      'PAGEDOWN': 0x22, 'END': 0x23, 'HOME': 0x24, 'LEFT': 0x25, 'UP': 0x26, 'RIGHT': 0x27, 'DOWN': 0x28,
      'PRINTSCREEN': 0x2C, 'INSERT': 0x2D, 'DELETE': 0x2E,
      'NUMLOCK': 0x90, 'SCROLLLOCK': 0x91,
      'VOLUMEUP': 0xAF, 'VOLUMEDOWN': 0xAE, 'VOLUMEMUTE': 0xAD,
      'MEDIASTOP': 0xB2, 'MEDIAPREV': 0xB1, 'MEDIANEXT': 0xB0, 'MEDIAPLAY': 0xB3, 'MEDIAPAUSE': 0xB3,
      'WIN': 0x5B, 'APPS': 0x5D,
    };

    // Letters A-Z
    if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
      return upper.charCodeAt(0);
    }
    // Numbers 0-9 (top row)
    if (/^[0-9]$/.test(upper)) {
      return 0x30 + parseInt(upper, 10);
    }
    // Function keys F1-F24
    const fMatch = /^F(\d{1,2})$/.exec(upper);
    if (fMatch) {
      const idx = parseInt(fMatch[1], 10);
      if (idx >= 1 && idx <= 24) return 0x70 + (idx - 1);
    }
    // Numpad keys
    const npMatch = /^NUMPAD(\d)$/.exec(upper);
    if (npMatch) {
      return 0x60 + parseInt(npMatch[1], 10);
    }
    const special: Record<string, number> = {
      'NUMPADMULTIPLY': 0x6A, 'NUMPADADD': 0x6B, 'NUMPADSEPARATOR': 0x6C, 'NUMPADSUBTRACT': 0x6D,
      'NUMPADDECIMAL': 0x6E, 'NUMPADDIVIDE': 0x6F,
    };
    if (special[upper] !== undefined) return special[upper];

    // Aliases from UI names
    const aliases: Record<string, string> = {
      'PAGE UP': 'PAGEUP', 'PAGE DOWN': 'PAGEDOWN', 'ARROWLEFT': 'LEFT', 'ARROWRIGHT': 'RIGHT', 'ARROWUP': 'UP', 'ARROWDOWN': 'DOWN',
    };
    const alias = aliases[upper];
    if (alias && vk[alias] !== undefined) return vk[alias];
    if (vk[upper] !== undefined) return vk[upper];
    return null;
  }

  // Show overlay window
  private showOverlay(): void {
    if (this.renderWindow) {
      console.log('Sending IPC overlay:show');
      this.renderWindow.webContents.send('overlay:show');
    } else {
      console.log('Render window not available for show overlay');
    }
  }

  // Hide overlay window
  private hideOverlay(): void {
    if (this.renderWindow) {
      console.log('Sending IPC overlay:hide');
      this.renderWindow.webContents.send('overlay:hide');
    } else {
      console.log('Render window not available for hide overlay');
    }
  }
}
