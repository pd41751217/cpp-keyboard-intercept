import { app } from 'electron';
import { Application } from './app';
import { OverlayApiLib } from './native/overlay-api/overlay-api.lib';
import { GAME_TO_HOOK } from './GAME_TO_HOOK';

// Force GPU acceleration, ignoring blacklist, enabling rasterization and force high performance GPU
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

export const args = process.argv.slice(1);
export const isProduction = !args.some((val) => val === '--serve');
export const mainApp = new Application();
export const overlayApiLib = new OverlayApiLib();

mainApp.init();
mainApp.onReady = async (): Promise<void> => {
  await overlayApiLib.init();
  overlayApiLib.addHook([GAME_TO_HOOK]);
  overlayApiLib.startInjectInterval();
};
