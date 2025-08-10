// src/utils/sqljs-loader.ts
// 핵심: sql.js의 UMD 번들을 "스크립트"로 로드해 window.initSqlJs 사용
// 빌드/브라우저 호환성이 높고, Vite가 dist/sql-wasm.js를 ESM으로 해석하지 않습니다.

import sqlJsLoaderUrl from 'sql.js/dist/sql-wasm.js?url' // 🔗 JS 파일도 ?url로 "자산 URL"로 가져오기

declare global {
  interface Window { initSqlJs?: (cfg?: any) => Promise<any> }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 로드되었는지 검사
    if (window.initSqlJs) return resolve()
    const exist = Array.from(document.scripts).some(s => s.src === src)
    if (exist) { 
      // 이미 붙어있으면 onload를 기다릴 수 없으니 약간 대기 후 해결
      const chk = () => window.initSqlJs ? resolve() : setTimeout(chk, 50)
      return chk()
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = (e) => reject(new Error('Failed to load sql.js loader script: ' + src))
    document.head.appendChild(s)
  })
}

/**
 * sql.js 메인 객체를 반환.
 * @param config initSqlJs에 넘길 설정 (예: { locateFile: () => wasmUrl })
 */
export async function getSQL(config?: any): Promise<any> {
  if (!window.initSqlJs) {
    await loadScriptOnce(sqlJsLoaderUrl)
  }
  if (!window.initSqlJs) throw new Error('initSqlJs not available after script load')
  return await window.initSqlJs(config)
}