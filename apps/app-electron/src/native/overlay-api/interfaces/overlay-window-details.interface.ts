import { IRectangle } from './rectangle.interface';

export interface IOverlayWindowDetails {
  name: string;
  transparent: boolean;
  resizable: boolean;
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
  rect: IRectangle;
  nativeHandle: number;
  dragBorderWidth?: number;
  caption?: {
    left: number;
    right: number;
    top: number;
    height: number;
  };
}
