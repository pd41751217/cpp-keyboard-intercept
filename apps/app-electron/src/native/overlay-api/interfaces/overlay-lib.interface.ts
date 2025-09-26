import { FpsPosition } from './fps-position.enum';
import { IHotkey } from './hot-key.interface';
import { IInjectResult } from './inject-result.interface';
import { IOverlayWindowDetails } from './overlay-window-details.interface';
import { IWindow } from './overlay-window.interface';
import { IRectangle } from './rectangle.interface';

export interface OverlayNodeApi {
  getTopWindows(includeMinimized?: boolean): IWindow[];
  injectProcess(process: IWindow): IInjectResult;
  start(): void;
  stop(): void;
  setEventCallback(cb: (event: string, ...args: any[]) => void): void;
  setHotkeys(hotkeys: IHotkey[]): void;
  sendCommand(arg: { command: 'cursor'; cursor: string }): void;
  sendCommand(arg: { command: 'fps'; showfps: boolean; position: FpsPosition }): void;
  sendCommand(arg: { command: 'input.intercept'; intercept: boolean }): void;
  sendCommand(arg: { command: 'keyboard.remap'; mappings: Record<number, number> }): void;
  sendCommand(arg: { command: 'keyboard.block'; blockedKeys: number[] }): void;
  sendCommand(arg: { command: 'keyboard.pass'; passedKeys: number[] }): void;
  sendCommand(arg: { command: 'keyboard.mode'; mode: 'block_and_replace' | 'block_only' | 'monitor' | 'selective_remap' }): void;
  sendCommand(arg: { command: 'keyboard.inject'; keyCode: number; modifiers?: number; isDown: boolean }): void;
  sendCommand(arg: { command: 'hotkey.info'; hotkeys: Array<{ name: string; keyCode: number; ctrl: boolean; shift: boolean; alt: boolean; passthrough: boolean }> }): void;
  addWindow(windowId: number, details: IOverlayWindowDetails): void;
  startGameInputIntercept(): void;
  stopGameInputIntercept(): void;
  closeWindow(windowId: number): void;
  sendWindowBounds(windowId: number, details: { rect: IRectangle }): void;
  sendFrameBuffer(windowId: number, buffer: Buffer, width: number, height: number): void;
  translateInputEvent(event: { windowId: number; msg: number; wparam: number; lparam: number }): any;
}
