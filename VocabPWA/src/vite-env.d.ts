// src/vite-env.d.ts
declare module '*.wasm?url' { const src: string; export default src }
declare module 'pdfjs-dist/build/pdf.worker.min?url' { const src: string; export default src }