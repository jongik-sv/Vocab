# Vocab PWA – Feature Pack (Persistence + JSON/PDF Import + Notebook/Chapter + Flip + TTS)

> 이 파일 하나만 보고 **교체/추가**하면 됩니다.
> 요구사항: **1) 영구 저장, 2) JSON 업로드, 3) 단어장/챕터 구조, 4) 카드 앞/뒤 플립, 5) PDF→JSON→DB, 6) TTS 안정화**.

---

## 0) 설치/적용 순서

1. 의존성 추가

```bash
pnpm add pdfjs-dist
```

2. 아래 **파일별 코드**를 프로젝트에 **덮어쓰기/추가**

* 교체: `src/stores/db.ts`, `src/stores/study.ts`, `src/components/FlashCard.vue`, `src/pages/Vocab.vue`, `src/utils/tts.ts`
* 추가: `src/utils/persist.ts`, `src/utils/pdf2json.ts`, `src/vite-env.d.ts`
* 변경: `src/main.ts` 상단에서 `ensurePersistence()` 호출 1줄

3. 개발 서버 재시작

```bash
pnpm dev
```

---

## A) main.ts (1줄 추가)

```ts
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import './styles/tokens.css'
import './pwa'

// ✅ 영구 저장 권한 시도 (가능 브라우저)
import { ensurePersistence } from './utils/persist'
ensurePersistence()

createApp(App).use(createPinia()).use(router).mount('#app')
```

---

## B) persist.ts (신규) — 영구 저장 권한 요청

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

---

## C) db.ts (교체) — sql.js WASM 경로 고정 + IndexedDB 영속

```ts
// src/stores/db.ts
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

## D) tts.ts (교체) — 보이스 로드/취소/언어/속도

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

## E) pdf2json.ts (신규) — PDF→JSON 변환(“사랑영단어”, day 챕터)

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
  html_content: string,      // 뜻/예문 HTML로 묶음
  tags?: string | null
}>

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

## F) study.ts (교체) — 노트/챕터 + JSON/PDF 업로드 + 큐/학습 + TTS

```ts
// src/stores/study.ts
import { defineStore } from 'pinia'
import { getDB } from './db'
import { speak, loadVoices } from '../utils/tts'
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

## G) FlashCard.vue (교체) — 앞면(영어) 클릭 → 뒷면(뜻/예문)

```vue
<!-- src/components/FlashCard.vue -->
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

## H) Vocab.vue (교체) — 단어장/챕터 선택 + JSON/PDF 업로드

```vue
<!-- src/pages/Vocab.vue -->
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

## I) vite-env.d.ts (신규) — Vite의 `?url` 타입 선언

```ts
// src/vite-env.d.ts
declare module '*.wasm?url' { const src: string; export default src }
declare module 'pdfjs-dist/build/pdf.worker.min?url' { const src: string; export default src }
```

---

## J) 사용 팁

* **데이터 저장 위치**: IndexedDB → DB `vocab-db` → Store `files` → Key `vocab.db`
  (Chrome DevTools → Application → IndexedDB에서 확인 가능)
* **PDF 업로드**: `단어장` 화면의 **PDF → JSON → 삽입** 버튼 사용 → 챕터는 `DAY` 헤더를 자동으로 `day01` 형식으로 매핑.
* **TTS**: 카드 앞면의 **🔊 발음** 클릭. (기본 `en-US`, 속도는 `store.ttsRate`로 제어 가능)
* **앞/뒤 플립**: 단어 카드를 **클릭** 또는 **Space** 키.

---

필요하면 `Study.vue`에 **언어/속도 선택 UI**(en-US/en-GB, rate 슬라이더)도 바로 붙여 드릴게요.
