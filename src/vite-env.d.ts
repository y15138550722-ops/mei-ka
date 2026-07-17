/// <reference types="vite/client" />

declare module '*.zip?url' {
  const src: string;
  export default src;
}

declare module '*.xlsx?url' {
  const src: string;
  export default src;
}
