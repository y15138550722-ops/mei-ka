/// <reference types="vite/client" />

declare module '*.zip?url' {
  const src: string;
  export default src;
}
