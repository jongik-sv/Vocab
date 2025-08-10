# Hotfix – 샘플 추가 안됨 해결 (sql.js WASM 경로 + IndexedDB 변환)

> 증상: **샘플 추가 버튼이 작동하지 않음**. 원인 추정: `sql.js`의 **WASM 로드 경로** 문제 또는 IndexedDB에서 꺼낸 값이 **ArrayBuffer → Uint8Array 미변환**. 해결: `?url`로 WASM 경로를 고정하고, IndexedDB 읽기 시 **Uint8Array로 변환**.

아래 **교체/추가 파일만** 적용하세요.

---

## 1) 교체: `src/stores/db.ts`

```ts
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
      // Safari 등에서 객체로 저장된 경우
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
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const bin = await idbGet(DB_KEY)
  const db = new SQL.Database(bin || undefined)

  // 스키마 (idempotent)
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

## 2) 교체(권장): `src/stores/study.ts` – 샘플 추가 후 즉시 반영 보장

```ts
import { defineStore } from 'pinia'
import { getDB } from './db'

export const useStudyStore = defineStore('study', {
  state: () => ({
    notebooks: [] as any[],
    words: [] as any[],
    queue: [] as any[],
    index: 0,
    ttsRate: 1.0,
    todayLearned: 0,
    totalLearned: 0,
    activeNotebook: 'all'
  }),
  getters: {
    progressPercent(state) {
      if (!state.queue.length) return 0
      const p = Math.round((state.index / state.queue.length) * 100)
      return Math.max(0, Math.min(100, p))
    },
    current(state) { return state.queue[state.index] }
  },
  actions: {
    async refreshWords() {
      const { db } = await getDB()
      const res = db.exec(`SELECT * FROM words ORDER BY id DESC`)
      this.words = res[0]?.values.map(r => ({
        id: r[0], notebook_id: r[1], chapter_id: r[2], headword: r[3], phonetic: r[4], html_content: r[5], tags: r[6]
      })) || []
    },
    async loadQueue() {
      const { db } = await getDB()
      const where = this.activeNotebook==='all' ? '' : `WHERE notebook_id=${Number(this.activeNotebook)}`
      const res = db.exec(`SELECT * FROM words ${where} ORDER BY RANDOM() LIMIT 50`)
      this.queue = res[0]?.values.map(r => ({ id: r[0], headword: r[3], html_content: r[5] })) || []
      this.index = 0
    },
    async next() { if (this.index < this.queue.length - 1) this.index++ },
    async memorizeCurrent() {
      const cur = this.queue[this.index]
      if (!cur) return
      this.todayLearned++
      this.totalLearned++
      this.queue.splice(this.index, 1)
      if (this.index >= this.queue.length) this.index = Math.max(0, this.queue.length - 1)
    },
    setActiveNotebook(id: string){ this.activeNotebook = id },

    // ✅ 샘플 추가: WASM/IDB 정상화 후 즉시 반영
    async addSample() {
      const { db, persist } = await getDB()
      db.run(`BEGIN`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('abandon', '<b>버리다</b> / 예: He abandoned the plan.')`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('benefit', '<b>이익</b> / 예: It benefits everyone.')`)
      db.run(`COMMIT`)
      await persist()
      await this.refreshWords()
      if (!this.queue.length) await this.loadQueue()
    },

    async deleteWord(id:number){
      const { db, persist } = await getDB()
      const stmt = db.prepare(`DELETE FROM words WHERE id=?`)
      stmt.run([id])
      stmt.free()
      await persist()
      await this.refreshWords()
    },

    async backupJSON(){
      const { db } = await getDB()
      const res = db.exec(`SELECT * FROM words`)
      const rows = res[0]?.values || []
      const json = rows.map(r => ({ id:r[0], notebook_id:r[1], chapter_id:r[2], headword:r[3], phonetic:r[4], html_content:r[5], tags:r[6] }))
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'vocab-backup.json'
      a.click()
    },

    async restoreJSON(file: File){
      const text = await file.text()
      const arr = JSON.parse(text)
      const { db, persist } = await getDB()
      const insert = db.prepare(`INSERT INTO words(id, notebook_id, chapter_id, headword, phonetic, html_content, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      db.run('BEGIN')
      for (const w of arr){ insert.run([w.id||null, w.notebook_id||null, w.chapter_id||null, w.headword, w.phonetic||null, w.html_content||'', w.tags||null]) }
      db.run('COMMIT')
      insert.free()
      await persist()
      await this.refreshWords()
    }
  }
})
```

---

## 3) 추가(타입 선언): `src/vite-env.d.ts`

```ts
declare module '*.wasm?url' { const src: string; export default src }
```

---

## 4) 적용 순서

1. 위 **3개 파일**을 프로젝트에 반영 (덮어쓰기 + 새 파일 추가)
2. 개발 서버 재시작: `pnpm dev`
3. **단어장 → 샘플 추가** 눌러서 리스트에 2개 항목이 바로 나타나는지 확인

문제 지속 시, 브라우저 콘솔 오류 메시지를 알려주세요. (특히 `sql-wasm.wasm` 404, IndexedDB 에러 여부)

