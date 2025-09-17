export interface IHotkey {
  name: string;
  keyCode: number;
  modifiers?: {
    alt?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  passthrough?: boolean;
}
