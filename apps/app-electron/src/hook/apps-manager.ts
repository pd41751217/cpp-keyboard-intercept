export enum HookAppStatus {
  WAITING = 'waiting',
  INJECTING = 'injecting',
  INJECTED = 'injected',
}

export interface Hook {
  id: string;
  windowName: string;
}

export interface HookApp {
  pid: number;
  id: string;
  windowName: string;
  status?: HookAppStatus;
}

export class AppsManager {
  public apps: Record<string, HookApp> = {};

  public addApp(id: string, windowName: string = '', pid: number = 0, status: HookAppStatus = HookAppStatus.WAITING): HookApp {
    if (this.apps[id]) {
      return this.apps[id];
    }

    this.apps[id] = {
      id,
      windowName,
      pid,
      status,
    };

    return this.apps[id];
  }

  public getAppById(id: string): HookApp {
    return this.apps[id];
  }

  public getAppByStatus(status: HookAppStatus): HookApp[] {
    return Object.values(this.apps).filter((app) => app.status === status);
  }

  public getAppByPid(pid: number): HookApp {
    return Object.values(this.apps).find((app) => app.pid === pid);
  }

  public modifyAppById(id: string, changes: Partial<HookApp>): HookApp {
    this.apps[id] = { ...this.apps[id], ...changes };
    return this.apps[id];
  }

  public modifyAppByPid(pid: number, changes: Partial<HookApp>): HookApp {
    const appFound = this.getAppByPid(pid);
    if (appFound) {
      this.apps[appFound.id] = { ...this.apps[appFound.id], ...changes };
      return appFound;
    }
  }

  public removeAppById(id: string): void {
    delete this.apps[id];
  }
}