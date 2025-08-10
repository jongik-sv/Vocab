// src/types/sqljs-globals.d.ts
// (IDE 타입 경고 제거용 – 실제 런타임에는 영향 없음)

declare global {
  interface Window {
    initSqlJs?: (config?: {
      locateFile?: (file: string, prefix?: string) => string
    }) => Promise<{
      Database: new (data?: Uint8Array) => any
    }>
  }
}

export {}