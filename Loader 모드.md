# 핵심 요약

* 에러의 근본원인: **ESM로 `sql.js`를 import**할 때 Vite가 내부 `dist/sql-wasm.js`로 해석 → **default export 없음**으로 크래시.
* 해결 전략: **모듈 import 대신 “스크립트로 로드(UMD)”** 하는 **호환 로더**를 도입해 `window.initSqlJs`를 사용.
* 장점: Vite/버전 상관없이 안정, 타입 경고(ts7016)도 같이 해결.
* 아래 **한 개의 마크다운**만 적용하면 됩니다(파일 3개 교체/추가).

---

# 🩹 SQL.js “Loader 모드” Fix Pack (One-File)

> 이 파일 내용대로 덮어쓰면 **콘솔 에러가 사라지고** 화면이 정상 렌더링됩니다.
> 핵심은 `db.ts`가 더 이상 `sql.js`를 ESM으로 import하지 않고, **로더 유틸**을 통해 전역 `initSqlJs`를 쓰는 것입니다.
> (문제의 메시지: “does not provide an export named 'default'”)

---

## 1) 교체: `src/stores/db.ts`

```ts
// src/stores/db.ts
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url' // wasm은 URL로 고정(자산 처리)
import { getSQL } from '../utils/sqljs-loader'      // ✅ 새 로더 사용

const DB_KEY = 'vocab.db'
const IDB_NAME = 'vocab-db'
const STORE = 'files'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await openIDB()
  return await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const getReq = store.get(key)
    getReq.onsuccess = () => {
      const v = getReq.result
      if (!v) return resolve(null)
      if (v instanceof Uint8Array) return resolve(v)
      if (v instanceof ArrayBuffer) return resolve(new Uint8Array(v))
      try { return resolve(new Uint8Array(v)) } catch { return resolve(null) }
    }
    getReq.onerror = () => resolve(null)
  })
}

async function idbPut(key: string, data: Uint8Array): Promise<void> {
  const db = await openIDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getDB() {
  // ✅ 전역 initSqlJs를 로드한 뒤, wasm 경로를 locateFile로 전달
  const SQL = await getSQL({ locateFile: () => wasmUrl })

  const bin = await idbGet(DB_KEY)
  const db = new SQL.Database(bin || undefined)

  db.run(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS notebooks(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chapters(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER REFERENCES notebooks(id) ON DELETE CASCADE,
      name TEXT,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS words(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER REFERENCES notebooks(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
      headword TEXT NOT NULL,
      phonetic TEXT,
      html_content TEXT,
      tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS word_status(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER REFERENCES words(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'NEW',
      last_reviewed_at TEXT,
      next_due_at TEXT
    );
    CREATE TABLE IF NOT EXISTS stats_daily(
      date TEXT PRIMARY KEY,
      learned_count INTEGER DEFAULT 0
    );
  `)

  const persist = async () => { await idbPut(DB_KEY, db.export()) }
  return { db, persist }
}
```

---

## 2) 추가: `src/utils/sqljs-loader.ts`

```ts
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
```

---

## 3) 추가: `src/types/sqljs-globals.d.ts`

```ts
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
```

---

## 적용 체크리스트

1. **프로젝트 전체에서** `import ... from 'sql.js'` 또는 `from 'sql.js/dist/sql-wasm.js'` **참조가 남아 있지 않은지** 확인해 주세요.

   * 이제는 `db.ts`가 **오직 `getSQL()`** 만 사용합니다.
2. 개발 서버 재시작 후, 브라우저 **Service Worker Unregister → 하드 리로드**(PWA 캐시 회피).
3. 여전히 동일 에러가 보이면, 브라우저 콘솔에서 **해당 에러의 파일/행번호**가 새 `db.ts`를 가리키는지 확인(이전 번들이 캐시되면 과거 코드가 실행될 수 있어요).

---

## 왜 이 방법이 안전한가?

* `sql.js` 패키지는 버전에 따라 **루트/배포 엔트리의 ESM export 형태가 바뀌거나** 번들러가 **dist 파일을 ESM으로 잘못 해석**하는 경우가 있습니다.
* “자산 URL + `<script>` 주입”은 UMD 스크립트를 그대로 실행시켜 **항상 `window.initSqlJs`** 를 제공하기 때문에, **Vite의 ESM 해석 경로를 완전히 우회**합니다.
* WASM은 여전히 `?url`로 번들되어 **캐시/경로 안정적**입니다.

---

## 다음(선택)

* PWA로 배포 시에는 CDN 대신 **로컬 호스팅**을 권장합니다. 지금 구성은 이미 로컬(node\_modules 경유)이며, 더 확실히 하려면 `public/vendor/sql.js/`로 복사해서 `sqlJsLoaderUrl`을 그 경로로 바꿀 수 있어요.
* 원하시면 이 “Loader 모드”를 포함해 **전체 템플릿을 다시 한 파일로** 정리해서 드릴게요.

문제 재현되면 **최신 콘솔 로그(파일/행번호 포함)** 캡처만 보내 주세요. 바로 이어서 잡아드릴게요!
