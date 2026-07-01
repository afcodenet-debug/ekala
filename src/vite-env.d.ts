/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '@fontsource/*' {
  const content: string;
  export default content;
}