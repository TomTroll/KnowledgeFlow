// CSS module declarations for esbuild's css-text plugin.
// Allows TypeScript to resolve `import styles from '*.css'` as a string.
declare module '*.css' {
  const content: string;
  export default content;
}
