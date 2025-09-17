/// <reference types="vite/client" />

interface ImportMeta {
  readonly hot?: {
    readonly data: Record<string, any>;
    accept(): void;
    accept(cb: (mod: any) => void): void;
    dispose(cb: (data: any) => void): void;
  };
  readonly env: Record<string, string>;
}
