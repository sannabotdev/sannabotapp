/**
 * Module declarations for non-TypeScript asset imports
 */

declare module '*.md' {
  const content: string;
  export default content;
}
