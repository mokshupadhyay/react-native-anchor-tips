declare const __DEV__: boolean;
declare const console: { warn(...args: unknown[]): void };

// Metro provides CommonJS `require` in every module.
declare function require(id: string): any;
