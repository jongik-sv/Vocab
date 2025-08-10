# 핵심 요약

* 지금 빈 화면/경고는 `db.ts`가 **여전히 `sql.js/dist/sql-wasm.js`를 default import** 하면서 발생해요.
* 해결법: **`import initSqlJs from 'sql.js'`** 로 바꾸고, 타입 오류(ts7016)는 **간단한 d.ts** 추가로 처리.
* 아래 **한 개의 Markdown 번들**에 필요한 파일을 모두 넣었습니다. 이대로 덮어쓰기만 하면 됩니다.

---

# 🔧 SQL.js Import & Types – One-File Fix Pack

> 이 문서의 각 섹션을 **파일별로 복사/덮어쓰기** 하세요.
> 완료 후 `pnpm dev` 재시작 + (PWA 사용 시) SW 캐시 Unregister.

---

## 1) `src/stores/db.ts` 〈정상 import + WASM 경로 고정〉

```ts
// src/stores/db.ts
// ✅ 반드시 루트 모듈에서 import
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

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
  // ✅ WASM 파일 경로 고정
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const bin = await idbGet(DB_KEY)
  const db = new SQL.Database(bin || undefined)

  // 스키마(idempotent)
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

## 2) `src/types/sqljs.d.ts` 〈TS7016 타입 경고 제거〉

```ts
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
```

---

## 3) `src/vite-env.d.ts` 〈이미 있다면 유지, 없다면 추가〉

```ts
// src/vite-env.d.ts
declare module '*.wasm?url' { const src: string; export default src }
declare module 'pdfjs-dist/build/pdf.worker.min?url' { const src: string; export default src }
```

---

## 4) 체크리스트 (반드시 확인)

* `db.ts` **1\~3행**이 정확히 아래와 같은지 재확인:

  * `import initSqlJs from 'sql.js'`
  * `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'`
* 프로젝트에 `src/types/sqljs.d.ts` 파일이 **생성**되어 있는지. (TS가 자동 인식)
* 에디터/TS 서버 캐시가 남았으면 **IDE 재시작** 또는 **TypeScript: Restart TS Server**.
* 개발 서버를 완전 재시작:

  ```bash
  rm -rf .vite dist
  pnpm dev
  ```
* PWA 사용 중이면 브라우저 **DevTools → Application → Service Workers → Unregister** 후 강력 새로고침.

---

## 5) 참고 (왜 이런 에러가 났나?)

* `sql.js/dist/sql-wasm.js`는 **default export가 없는 ESM**이어서 `import initSqlJs from ...` 형태가 실패합니다.
* 올바른 진입점은 \*\*패키지 루트(`'sql.js'`)\*\*의 default export이고, **WASM 파일 경로만 `?url`** 로 넘겨주면 브라우저에서 잘 동작합니다.
* 타입 패키지(`@types/sql.js`)는 공식 제공이 없어 간단한 `d.ts`로 해결하는 게 가장 깔끔합니다.

---

필요하면 이 Fix Pack을 **기능 번들**과 합쳐서 “완전 통합 번들”로 다시 만들어 드릴게요. 지금 적용해보고 결과만 알려주세요!
