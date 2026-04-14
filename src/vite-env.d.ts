/// <reference types="vite/client" />

interface ImportMeta {
  readonly glob: (pattern: string, options?: any) => Record<string, any>;
}
