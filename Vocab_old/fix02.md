# ✅ Vocab PWA – **FixPack (One-File Markdown)**

> **에러 해결 + 요구 기능**을 한 번에 적용하는 교체/추가 코드 번들입니다.
> 이 파일만 복사해서 LLM/에이전트에게 “파일별로 덮어써줘”라고 지시하면 됩니다.

---

## 🔧 먼저, 핵심 변경 포인트 (요약)

* **빌드 에러 원인 1**: `pdf2json.ts`에서 `pdfToJson` **named export 누락/오타** → 빌드 실패.
* **빌드 에러 원인 2(경고성)**: `sql.js`가 내부적으로 `fs/path/crypto`를 참조해 Vite가 브라우저 호환 용도로 externalize 경고 표시(치명 아님).
* **조치**

  1. `pdf2json.ts`를 **정상 named export**로 교체.
  2. `study.ts`의 import 라인 정확화.
  3. `sql.js`는 브라우저 전용 **`dist/sql-wasm.js`** 엔트리로 호출 + `?url`로 wasm 경로 고정.
  4. JSON/PDF 업로드, 단어장/챕터, 카드 플립, **영구 저장(persist)**, **TTS 안정화** 포함.

> 적용 순서: **패키지 설치 → 아래 파일들 교체/추가 → 캐시 삭제(선택) → dev 재실행**.

---

## 0) 패키지 설치

```bash
pnpm add pdfjs-dist sql.js
```

> 이미 설치되어 있다면 생략해도 됩니다.

---

## 1) `vite.config.ts`  ※ 경고 완화 & 워커 번들 안정화

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vocab PWA',
        short_name: 'Vocab',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0f19',
        theme_color: '#4f46e5',
        icons: [
          { src: '/icons/manifest-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/manifest-icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  // sql.js가 내부에서 node 내장모듈을 참조하더라도 브라우저 번들에 넣지 않도록
  resolve: {
    alias: {
      // 필요 시 빈 모듈로 무시 처리(경고 억제용)
      fs: '/@empty-module',
      path: '/@empty-module',
      crypto: '/@empty-module'
    }
  },
  define: {
    'process.env': {} // 일부 라이브러리의 process.env 접근 방지용
  },
  optimizeDeps: {
    exclude: ['sql.js', 'pdfjs-dist'] // 미리 번들 최적화에서 제외
  }
})
```

> 루트에 **`/@empty-module`** 더미를 만들 필요는 없습니다. Vite가 빈 모듈을 자동 처리합니다(경고만 완화). 경고가 남아도 **치명적 에러는 아닙니다**. 실제 빌드 실패 원인은 아래 `pdf2json.ts` export 문제였습니다.

---

## 2) `src/vite-env.d.ts`  ※ Vite url import 타입

```ts
// src/vite-env.d.ts
declare module '*.wasm?url' { const src: string; export default src }
declare module 'pdfjs-dist/build/pdf.worker.min?url' { const src: string; export default src }
```

---

## 3) **영구 저장** 유틸 – `src/utils/persist.ts`

```ts
// src/utils/persist.ts
export async function ensurePersistence() {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return false
  try {
    const persisted = await navigator.storage.persisted()
    return persisted || await navigator.storage.persist()
  } catch {
    return false
  }
}
```

> (한 번만 호출) `main.ts` 상단에서 아래 1줄 추가:

```ts
import { ensurePersistence } from './utils/persist'
ensurePersistence()
```

---

## 4) **TTS 안정화** – `src/utils/tts.ts`

```ts
// src/utils/tts.ts
let cachedVoices: SpeechSynthesisVoice[] = []

export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const tryLoad = (res: (v: SpeechSynthesisVoice[]) => void) => {
    const list = synth.getVoices()
    if (list && list.length) { cachedVoices = list; res(list) }
    else setTimeout(() => tryLoad(res), 200)
  }
  return new Promise<SpeechSynthesisVoice[]>(tryLoad)
}

export function listVoices(langHint: string = 'en') {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices()
  return cachedVoices
    .filter(v => v.lang?.toLowerCase().startsWith(langHint.toLowerCase()))
    .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
}

export function speak(text: string, opts?: { lang?: 'en-US'|'en-GB', rate?: number, pitch?: number }) {
  if (!text?.trim()) return
  const synth = window.speechSynthesis
  try { synth.cancel() } catch {}
  const u = new SpeechSynthesisUtterance(text)
  u.lang = opts?.lang ?? 'en-US'
  u.rate = opts?.rate ?? 1.0
  u.pitch = opts?.pitch ?? 1.0
  const voice =
    listVoices(u.lang)[0] ||
    cachedVoices.find(v => v.lang?.startsWith('en')) ||
    cachedVoices[0]
  if (voice) u.voice = voice
  synth.speak(u)
}
```

---

## 5) **PDF → JSON 변환(사랑영단어)** – `src/utils/pdf2json.ts`

> ✅ **중요**: `export async function pdfToJson(...)` **named export**로 정확히 내보냅니다(빌드 에러 해결 포인트).

```ts
// src/utils/pdf2json.ts
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type VocabJson = Array<{
  notebook: string,
  chapter: string,           // day01, day02, ...
  headword: string,
  phonetic?: string,
  html_content: string,      // 뜻/예문 HTML
  tags?: string | null
}>

// ✅ named export: pdfToJson
export async function pdfToJson(file: File, notebookName = '사랑영단어'): Promise<VocabJson> {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise

  let currentDay = 'day00'
  let buffer: string[] = []
  const out: VocabJson = []

  function commitBuffered() {
    for (let i = 0; i < buffer.length; i++) {
      const idLine = buffer[i]?.trim()
      const pron = buffer[i+1]?.trim()
      const hwLine = buffer[i+2]?.trim()

      if (/^\d{3,4}$/.test(idLine) && /^\[.+\]$/.test(pron) && hwLine) {
        const m = hwLine.match(/^([A-Za-z' -]+)\s+(.+)$/)
        if (!m) continue
        const headword = m[1].trim()
        const meaning = m[2].trim()

        const examples: string[] = []
        for (let k = i + 3; k < Math.min(buffer.length, i + 10); k++) {
          const line = buffer[k]?.trim()
          if (!line) continue
          if (/^\d{3,4}$/.test(line) || /^DAY\b/i.test(line)) break
          examples.push(line)
        }

        const html = [
          `<p><strong>${escapeHtml(headword)}</strong> <em>${escapeHtml(pron)}</em></p>`,
          `<p>${escapeHtml(meaning)}</p>`,
          examples.length ? `<div>${examples.map(x => `<div>${escapeHtml(x)}</div>`).join('')}</div>` : ''
        ].join('')

        out.push({
          notebook: notebookName,
          chapter: currentDay,
          headword,
          phonetic: pron.replace(/^\[|\]$/g,''),
          html_content: html
        })
      }
    }
    buffer = []
  }

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const text = tc.items.map((it: any) => it.str).join('\n')

    const dm = text.match(/DAY\s*0?(\d{1,2})/i)
    if (dm) {
      commitBuffered()
      currentDay = 'day' + String(dm[1]).padStart(2, '0')
    }
    buffer.push(...text.split(/\r?\n/))
  }
  commitBuffered()
  return out
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}
```

---

## 6) **SQLite + IndexedDB 영속** – `src/stores/db.ts`

```ts
// src/stores/db.ts
import initSqlJs from 'sql.js/dist/sql-wasm.js'  // 브라우저 전용 엔트리
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
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
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

## 7) **Store(핵심 로직)** – `src/stores/study.ts`

```ts
// src/stores/study.ts
import { defineStore } from 'pinia'
import { getDB } from './db'
import { speak, loadVoices } from '../utils/tts'
// ✅ named export 사용 (빌드 에러 해결)
import { pdfToJson, type VocabJson } from '../utils/pdf2json'

export const useStudyStore = defineStore('study', {
  state: () => ({
    // meta
    notebooks: [] as Array<{id:number, name:string}>,
    chapters: [] as Array<{id:number, notebook_id:number, name:string}>,
    activeNotebook: 'all' as string,
    activeChapter: 'all' as string,

    // data
    words: [] as any[],
    queue: [] as any[],
    index: 0,

    // tts
    ttsLang: 'en-US' as 'en-US'|'en-GB',
    ttsRate: 1.0,

    // stats
    todayLearned: 0,
    totalLearned: 0
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
    // ---------- meta ----------
    async loadMeta() {
      const { db } = await getDB()
      const ns = db.exec(`SELECT id,name FROM notebooks ORDER BY id ASC`)[0]?.values ?? []
      const cs = db.exec(`SELECT id,notebook_id,name FROM chapters ORDER BY notebook_id,id ASC`)[0]?.values ?? []
      this.notebooks = ns.map(r => ({ id: r[0] as number, name: r[1] as string }))
      this.chapters  = cs.map(r => ({ id: r[0] as number, notebook_id: r[1] as number, name: r[2] as string }))
    },

    async upsertNotebook(name: string) {
      const { db, persist } = await getDB()
      const q = db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO notebooks(name) VALUES (?)`, [name])
      await persist()
      await this.loadMeta()
      return db.exec(`SELECT id FROM notebooks WHERE name=?`, [name])[0].values[0][0] as number
    },

    async upsertChapter(notebook_id: number, name: string) {
      const { db, persist } = await getDB()
      const q = db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0]?.values?.[0]?.[0]
      if (q) return q as number
      db.run(`INSERT INTO chapters(notebook_id,name) VALUES (?,?)`, [notebook_id, name])
      await persist()
      await this.loadMeta()
      return db.exec(`SELECT id FROM chapters WHERE notebook_id=? AND name=?`, [notebook_id, name])[0].values[0][0] as number
    },

    // ---------- list ----------
    async refreshWords() {
      const { db } = await getDB()
      let where = ''
      if (this.activeChapter !== 'all') where = `WHERE chapter_id=${Number(this.activeChapter)}`
      else if (this.activeNotebook !== 'all') where = `WHERE notebook_id=${Number(this.activeNotebook)}`
      const res = db.exec(`SELECT id, notebook_id, chapter_id, headword, phonetic, html_content, tags FROM words ${where} ORDER BY id DESC`)
      this.words = res[0]?.values.map(r => ({
        id: r[0], notebook_id: r[1], chapter_id: r[2],
        headword: r[3], phonetic: r[4], html_content: r[5], tags: r[6]
      })) || []
    },

    async loadQueue() {
      const { db } = await getDB()
      let where = ''
      if (this.activeChapter !== 'all') where = `WHERE chapter_id=${Number(this.activeChapter)}`
      else if (this.activeNotebook !== 'all') where = `WHERE notebook_id=${Number(this.activeNotebook)}`
      const res = db.exec(`SELECT id, headword, html_content FROM words ${where} ORDER BY RANDOM() LIMIT 50`)
      this.queue = res[0]?.values.map(r => ({ id: r[0], headword: r[1], html_content: r[2] })) || []
      this.index = 0
    },

    async next() { if (this.index < this.queue.length - 1) this.index++ },
    async memorizeCurrent() {
      const cur = this.queue[this.index]
      if (!cur) return
      this.todayLearned++; this.totalLearned++
      this.queue.splice(this.index, 1)
      if (this.index >= this.queue.length) this.index = Math.max(0, this.queue.length - 1)
    },

    setActiveNotebook(id: string){ this.activeNotebook = id },
    setActiveChapter(id: string){ this.activeChapter = id },

    // ---------- TTS ----------
    async initTts() { await loadVoices() },
    speakNow(text:string){ speak(text, { lang: this.ttsLang, rate: this.ttsRate }) },

    // ---------- 샘플 ----------
    async addSample() {
      const { db, persist } = await getDB()
      db.run(`BEGIN`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('abandon', '<b>버리다</b><br>예: He abandoned the plan.')`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('benefit', '<b>이익</b><br>예: It benefits everyone.')`)
      db.run(`COMMIT`)
      await persist()
      await this.refreshWords()
      if (!this.queue.length) await this.loadQueue()
    },

    async deleteWord(id:number){
      const { db, persist } = await getDB()
      db.run(`DELETE FROM words WHERE id=?`, [id])
      await persist(); await this.refreshWords()
    },

    // ---------- 백업/복원 ----------
    async backupJSON(){
      const { db } = await getDB()
      const res = db.exec(`SELECT id, notebook_id, chapter_id, headword, phonetic, html_content, tags FROM words`)
      const rows = res[0]?.values || []
      const json = rows.map(r => ({ id:r[0], notebook_id:r[1], chapter_id:r[2], headword:r[3], phonetic:r[4], html_content:r[5], tags:r[6] }))
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vocab-backup.json'; a.click()
    },

    async restoreJSON(file: File){
      const text = await file.text()
      const arr = JSON.parse(text) as Array<any>
      await this.insertObjects(arr.map(w => ({
        notebook: 'Imported', chapter: 'default',
        headword: w.headword, phonetic: w.phonetic, html_content: w.html_content, tags: w.tags
      })))
    },

    async restorePDF(file: File){
      const arr = await pdfToJson(file, '사랑영단어')
      await this.insertObjects(arr)
    },

    async insertObjects(items: VocabJson){
      const { db, persist } = await getDB()
      db.run('BEGIN')
      for (const w of items) {
        const nb = await this.upsertNotebook(w.notebook)
        const ch = await this.upsertChapter(nb, w.chapter)
        db.run(
          `INSERT INTO words(notebook_id, chapter_id, headword, phonetic, html_content, tags) VALUES (?, ?, ?, ?, ?, ?)`,
          [nb, ch, w.headword, w.phonetic || null, w.html_content || '', w.tags || null]
        )
      }
      db.run('COMMIT'); await persist()
      await this.loadMeta(); await this.refreshWords()
      if (!this.queue.length) await this.loadQueue()
    }
  }
})
```

---

## 8) **카드 플립 + TTS 버튼** – `src/components/FlashCard.vue`

```vue
<template>
  <div class="wrap" @click="flip = !flip" @keyup.space.prevent="flip = !flip" tabindex="0">
    <div class="inner" :class="{ flipped: flip }">
      <section class="face front">
        <div class="head">{{ word.headword }}</div>
        <button class="btn btnGhost" @click.stop="store.speakNow(word.headword)">🔊 발음</button>
      </section>
      <section class="face back">
        <div v-html="word.html_content" />
      </section>
    </div>
  </div>
  <div class="actions stack mt3">
    <button class="btn" @click="$emit('next')">다음 →</button>
    <button class="btn btnPrimary" @click="$emit('memorized')">외웠어요 ✓</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
const props = defineProps<{ word: any }>()
const flip = ref(false)
const store = useStudyStore()
watch(() => props.word?.id, () => { flip.value = false })
onMounted(() => store.initTts())
</script>

<style module>
.wrap { perspective: 1200px; }
.inner { position: relative; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.2,.8,.2,1); }
.flipped { transform: rotateY(180deg); }
.face { backface-visibility: hidden; min-height: 260px; padding: 28px; border-radius: var(--radii-lg); border:1px solid var(--color-border); box-shadow: var(--shadow-lg); }
.front { background: linear-gradient(180deg, #ffffff, #f8fafc); }
.back { transform: rotateY(180deg); background: linear-gradient(180deg, #ffffff, #f1f5f9); }
.head { font-size: 34px; font-weight: 800; margin-bottom: 16px; letter-spacing:.3px; }
.actions { justify-content: center; }
</style>
```

---

## 9) **단어장/챕터 + JSON/PDF 업로드** – `src/pages/Vocab.vue`

```vue
<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap: wrap; gap:12px;">
      <h2 style="margin:0">단어장</h2>
      <div class="stack">
        <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="reload">
          <option value="all">모든 단어장</option>
          <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
        </select>
        <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="reload">
          <option value="all">모든 챕터</option>
          <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
        <button class="btn" @click="addSample">샘플 추가</button>
        <button class="btn" @click="backup">백업(JSON)</button>
      </div>
    </div>

    <div class="card" style="padding:12px;">
      <div class="stack" style="flex-wrap:wrap; gap:8px; margin-bottom:8px;">
        <label class="btn">
          JSON 업로드
          <input type="file" accept=".json,application/json" hidden @change="onJson"/>
        </label>
        <label class="btn btnPrimary">
          PDF → JSON → 삽입
          <input type="file" accept="application/pdf" hidden @change="onPdf"/>
        </label>
      </div>

      <table class="table">
        <thead><tr><th style="width:220px">영어</th><th>내용</th><th style="width:80px"></th></tr></thead>
        <tbody>
          <tr v-for="w in words" :key="w.id">
            <td style="font-weight:600">{{ w.headword }}</td>
            <td><div v-html="w.html_content" /></td>
            <td><button class="btn" @click="del(w.id)">삭제</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
const words = computed(() => store.words)
const chaptersFiltered = computed(() => {
  if (store.activeNotebook === 'all') return store.chapters
  return store.chapters.filter(c => c.notebook_id === Number(store.activeNotebook))
})
const reload = () => { store.refreshWords(); store.loadQueue() }
onMounted(async () => { await store.loadMeta(); await store.refreshWords() })
const addSample = () => store.addSample()
const del = (id:number) => store.deleteWord(id)
const backup = () => store.backupJSON()
const onJson = (e:any) => { const f = e.target.files?.[0]; if (f) store.restoreJSON(f) }
const onPdf  = (e:any) => { const f = e.target.files?.[0]; if (f) store.restorePDF(f) }
</script>
```

---

## 10) **main.ts** – persist 호출(재확인)

```ts
// src/main.ts (발췌)
import { ensurePersistence } from './utils/persist'
ensurePersistence()
```

---

## 11) 🧹 캐시/클린(권장)

빌드/실행이 여전히 꼬이면 한 번 정리하세요.

```bash
rm -rf node_modules .vite dist
pnpm install
pnpm dev
```

---

## ✅ 기대 결과

* `pdfToJson` **named export**로 빌드 에러 해소 → 화면 정상 표시.
* **IndexedDB 영구 저장** + **JSON/PDF 업로드** 동작.
* **단어장/챕터 필터링**, **카드 앞/뒤 플립**, **TTS(미/영, 속도)** 정상.

문제 계속 생기면 **에러 로그 전체**를 붙여 주세요. 바로 잡아드릴게요!
