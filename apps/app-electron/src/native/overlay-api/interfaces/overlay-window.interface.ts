import { IProcessThread } from './process-thread.interface';

export interface IWindow extends IProcessThread {
  windowId: number;
  title?: string;
}
