import { exec } from 'child_process';
import { BrowserWindow } from 'electron';
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
  height: 1080,
  width: 1920,
  frame: false,
  show: false,
  transparent: true,
  resizable: false,
  webPreferences: {
    // TODO: Comment this to use the shared texture
    offscreen: true,
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

  public async init(): Promise<void> {
    if (!this.isStarted) {
      this.startOverlay();

      await this.createRenderWindow();

      this.setCallbackEvents();

      this.isStarted = true;
    }
  }

  public startOverlay(): void {
    this.overlayApi = overlayApiLib;
    this.overlayApi.start();
  }

  public deinit(): void {}

  public startIntercept(): void {
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
        payload: Partial<{
          windowId?: number;
          focusWindowId?: number;
          message?: string;
          pid?: number;
          width?: number;
          height?: number;
          keyCode?: number;
          modifiers?: number;
          originalKey?: number;
          isDown?: boolean;
        }>,
      ) => {
        console.log(`overlay: event ${event} payload ${JSON.stringify(payload)}`);
        if (event === 'game.input') {
          if (payload.windowId) {
            console.log('input', payload.windowId);
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
          if (payload.focusWindowId) {
            console.log('focus', payload.focusWindowId);
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
          }
        } else if (event === 'graphics.fps') {
          console.log('graphics.fps', payload);
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
      const appAdded = this.appsManager.addApp(hook.id, hook.windowName);

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

    return window;
  }

  private addOverlayWindow(
    name: string,
    window: Electron.BrowserWindow,
    dragborder: number = 0,
    captionHeight: number = 0,
    transparent: boolean = false,
  ): BrowserWindow {
    this.overlayApi.addWindow(window.id, {
      name,
      transparent,
      resizable: window.isResizable(),
      maxWidth: 2000,
      maxHeight: 2000,
      minWidth: 20,
      minHeight: 20,
      nativeHandle: window.getNativeWindowHandle().readUInt32LE(0),
      rect: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      },
      caption: {
        left: dragborder,
        right: dragborder,
        top: dragborder,
        height: captionHeight,
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

    window.on('closed', () => {
      this.overlayApi.closeWindow(window.id);
      const windowRef = this.windows[window.id];
      if (windowRef) {
        windowRef.ref.close();
      }
    });

    return window;
  }

  public async createRenderWindow(): Promise<void> {
    try {
      const window = this.createWindow(AppWindows.MAIN_WINDOW, WindowDefaultOptions);
      await window.loadURL('http://localhost:4100');

      this.renderWindow = this.addOverlayWindow(WindowsPlacement.MAIN_WINDOW, window, 0, 20);
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
      this.overlayApi.sendCommand({
        command: 'keyboard.remap',
        mappings: mappings,
      });
    }

    // Send blocked keys
    if (this.blockedKeys.size > 0) {
      this.overlayApi.sendCommand({
        command: 'keyboard.block',
        blockedKeys: Array.from(this.blockedKeys),
      });
    }
  }
}
