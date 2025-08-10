// src/types/sqljs.d.ts
declare module 'sql.js' {
  export type LocateFile = (file: string) => string
  export interface InitSqlJsConfig { locateFile?: LocateFile }

  // 최소 타입만 선언(간단히 any로 둬서 빌드 방해 X)
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => any
  }

  const initSqlJs: (config?: InitSqlJsConfig) => Promise<SqlJsStatic>
  export default initSqlJs
}

// WASM url import 타입
declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const src: string
  export default src
}