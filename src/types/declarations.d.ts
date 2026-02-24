/**
 * Module declarations for non-TypeScript asset imports
 */

declare module '*.md' {
  const content: string;
  export default content;
}

/**
 * Hermes runtime globals not included in the default RN type set.
 */
declare function btoa(data: string): string;
declare function atob(data: string): string;
