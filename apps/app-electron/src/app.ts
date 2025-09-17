import { app, BrowserWindow } from 'electron';

export class Application {
  public mainWindow: BrowserWindow;

  public init(): void {
    app.on('ready', () => {
      this.createWindow();
      this.onReady();
    });
  }

  public createWindow(): void {
    this.mainWindow = new BrowserWindow({
      resizable: true,
      frame: true,
      show: true,
      backgroundColor: '#19191c',
    });

    this.mainWindow.loadURL('about:blank');
  }

  public onReady(): void {}
}
