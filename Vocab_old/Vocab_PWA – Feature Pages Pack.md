# 핵심 요약

* 아래 **하나의 Markdown** = 기능 페이지 + 스토어 + 유틸 **완전체**. 그대로 적용하면
  ① **영구 저장(IndexedDB+SQLite)** ② **JSON/PDF 업로드 → 단어장/챕터 자동삽입**
  ③ **카드형 학습(앞/뒤 플립)** ④ **단어장/챕터별 학습 필터** ⑤ **TTS 안정화** ⑥ **통계(일일/누적)** 가 동작합니다.
* 사용법: 이 파일을 LLM/에이전트에 전달해 **파일별로 덮어쓰기/추가** 지시 → `pnpm dev` 재실행.

---

# 📦 Vocab PWA – Feature Pages Pack (One-File Markdown)

> **교체/추가 대상만** 포함했습니다. *Display-Fix Pack*에서 만든 `index.html`, `App.vue`, `TopBar.vue`, 전역 CSS는 그대로 사용하세요.

---

## 1) `src/router/index.ts` 〈기능 페이지로 라우팅〉

```ts
import { createRouter, createWebHistory } from 'vue-router'

const Dashboard = () => import('../views/Dashboard.vue')
const Study = () => import('../views/Study.vue')
const Vocab = () => import('../views/Vocab.vue')
const Stats = () => import('../views/Stats.vue')
const Settings = () => import('../views/Settings.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/study', component: Study },
    { path: '/vocab', component: Vocab },
    { path: '/stats', component: Stats },
    { path: '/settings', component: Settings },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() { return { top: 0 } }
})

export default router
```

---

## 2) `src/stores/db.ts` 〈SQLite + IndexedDB 영속〉

```ts
import initSqlJs from 'sql.js/dist/sql-wasm.js'   // 브라우저 전용 엔트리
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

## 3) `src/utils/tts.ts` 〈TTS 안정화〉

```ts
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

## 4) `src/utils/pdf2json.ts` 〈PDF → JSON (“사랑영단어”, DAY→챕터)〉

```ts
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

## 5) `src/utils/persist.ts` 〈영구 저장 권한 요청〉

```ts
export async function ensurePersistence() {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return false
  try {
    const persisted = await navigator.storage.persisted()
    return persisted || await navigator.storage.persist()
  } catch { return false }
}
```

> **호출 위치(이미 적용했으면 생략)**: `src/main.ts` 최상단에서
> `import { ensurePersistence } from './utils/persist'; ensurePersistence()`.

---

## 6) `src/stores/study.ts` 〈핵심 로직: 단어장/챕터/학습/업로드/통계/TTS〉

```ts
import { defineStore } from 'pinia'
import { getDB } from './db'
import { speak, loadVoices } from '../utils/tts'
import { pdfToJson, type VocabJson } from '../utils/pdf2json'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

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
    totalLearned: 0,
    statsDaily: [] as Array<{date:string, learned_count:number}>
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

    // ---------- words/queue ----------
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
      // 일일 통계 반영(UPSERT 안전하게)
      const { db, persist } = await getDB()
      const today = todayStr()
      db.run(`INSERT OR IGNORE INTO stats_daily(date, learned_count) VALUES (?, 0)`, [today])
      db.run(`UPDATE stats_daily SET learned_count = learned_count + 1 WHERE date=?`, [today])
      await persist()

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
    },

    // ---------- stats ----------
    async loadStats() {
      const { db } = await getDB()
      const res = db.exec(`SELECT date, learned_count FROM stats_daily ORDER BY date DESC LIMIT 14`)
      this.statsDaily = (res[0]?.values || []).map(r => ({ date: r[0] as string, learned_count: r[1] as number }))
      // totalLearned 근사치(단순 합)
      this.totalLearned = this.statsDaily.reduce((s,x)=>s+x.learned_count,0)
    }
  }
})
```

---

## 7) `src/components/FlashCard.vue` 〈카드형 학습(앞/뒤 플립 + TTS)〉

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

## 8) `src/views/Dashboard.vue` 〈대시보드: 진행/선택/CTA〉

```vue
<template>
  <section class="stackCol">
    <div class="surface" style="padding:24px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
      <div>
        <h2 style="margin:0 0 6px 0;">오늘의 학습</h2>
        <p style="margin:0; color:var(--color-text-muted)">단어장/챕터를 선택하고 학습을 시작하세요.</p>
      </div>
      <router-link class="btn btnPrimary" to="/study">학습 시작 ▶</router-link>
    </div>

    <div class="card" style="padding:16px;">
      <div class="stack" style="justify-content:space-between; flex-wrap: wrap;">
        <div class="stack">
          <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="onFilterChange">
            <option value="all">모든 단어장</option>
            <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
          </select>
          <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="onFilterChange">
            <option value="all">모든 챕터</option>
            <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
        </div>
        <div style="color:var(--color-text-muted)">단어 수: {{ words.length }}</div>
      </div>
      <div class="mt3" style="height:10px; background:#e5e7eb33; border-radius:999px; overflow:hidden;">
        <div :style="{width: store.progressPercent + '%', height:'100%', background:'linear-gradient(90deg, var(--color-brand-400), var(--color-brand))'}"></div>
      </div>
      <small class="mt2" style="display:block; color:var(--color-text-muted)">진행률 {{ store.progressPercent }}%</small>
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
const onFilterChange = () => { store.refreshWords(); store.loadQueue() }
onMounted(async () => { await store.loadMeta(); await store.refreshWords(); await store.loadStats() })
</script>
```

---

## 9) `src/views/Study.vue` 〈학습: 큐/플립/외움〉

```vue
<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap:wrap;">
      <h2 style="margin:0">학습</h2>
      <span style="color:var(--color-text-muted)">진행: {{ store.index + 1 }} / {{ store.queue.length }}</span>
    </div>

    <div class="center">
      <div style="max-width:720px; width:100%">
        <FlashCard
          v-if="current"
          :word="current"
          @next="next"
          @memorized="memorize"
        />
        <div v-else class="card center" style="min-height:200px; padding:16px;">
          학습할 카드가 없습니다.
          <div class="mt3">
            <button class="btn btnPrimary" @click="reload">큐 불러오기</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
import FlashCard from '../components/FlashCard.vue'
const store = useStudyStore()
const current = computed(() => store.queue[store.index])
const next = () => store.next()
const memorize = () => store.memorizeCurrent()
const reload = () => store.loadQueue()
onMounted(async () => { if (!store.queue.length) await store.loadQueue() })
</script>
```

---

## 10) `src/views/Vocab.vue` 〈단어장/챕터 + JSON/PDF 업로드/삽입〉

```vue
<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between; flex-wrap: wrap; gap:12px;">
      <h2 style="margin:0">단어장</h2>
      <div class="stack">
        <input class="input" placeholder="새 단어장명" v-model="nbName" style="max-width:180px" />
        <button class="btn" @click="createNotebook">단어장 추가</button>
        <input class="input" placeholder="새 챕터명(day01 등)" v-model="chName" style="max-width:180px" />
        <button class="btn" @click="createChapter">챕터 추가</button>
      </div>
    </div>

    <div class="card" style="padding:12px;">
      <div class="stack" style="flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <select class="input" style="min-width:160px" v-model="store.activeNotebook" @change="reload">
          <option value="all">모든 단어장</option>
          <option v-for="n in store.notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
        </select>
        <select class="input" style="min-width:140px" v-model="store.activeChapter" @change="reload">
          <option value="all">모든 챕터</option>
          <option v-for="c in chaptersFiltered" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>

        <label class="btn">
          JSON 업로드
          <input type="file" accept=".json,application/json" hidden @change="onJson"/>
        </label>
        <label class="btn btnPrimary">
          PDF → JSON → 삽입
          <input type="file" accept="application/pdf" hidden @change="onPdf"/>
        </label>

        <button class="btn" @click="addSample">샘플 추가</button>
        <button class="btn" @click="backup">백업(JSON)</button>
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
import { onMounted, computed, ref } from 'vue'
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
const words = computed(() => store.words)
const nbName = ref(''); const chName = ref('')
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

const createNotebook = async () => {
  if (!nbName.value.trim()) return
  await store.upsertNotebook(nbName.value.trim())
  nbName.value = ''; await store.loadMeta()
}
const createChapter = async () => {
  if (store.activeNotebook === 'all' || !chName.value.trim()) return
  await store.upsertChapter(Number(store.activeNotebook), chName.value.trim())
  chName.value = ''; await store.loadMeta()
}
</script>
```

---

## 11) `src/views/Stats.vue` 〈통계(일일/누적)〉

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">통계</h2>

    <div class="stack" style="gap:16px; flex-wrap:wrap;">
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">오늘 학습</div>
        <div style="font-size:24px; font-weight:800;">{{ todayCount }}</div>
      </div>
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">누적 학습(최근 14일 합)</div>
        <div style="font-size:24px; font-weight:800;">{{ store.totalLearned }}</div>
      </div>
    </div>

    <div class="card mt3" style="padding:16px;">
      <div class="label">최근 14일</div>
      <div style="display:flex; align-items:flex-end; gap:8px; height:120px;">
        <div v-for="d in store.statsDaily.slice().reverse()" :key="d.date" style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          <div :title="d.learned_count + '개'" :style="{
               width:'20px',
               height: Math.max(4, d.learned_count*8) + 'px',
               background: 'linear-gradient(180deg, var(--color-brand-400), var(--color-brand))',
               borderRadius: '8px'
             }"></div>
          <small style="color:var(--color-text-muted)">{{ d.date.slice(5) }}</small>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStudyStore } from '../stores/study'
function todayStr(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const store = useStudyStore()
const todayCount = computed(() => store.statsDaily.find(x=>x.date===todayStr())?.learned_count || 0)
onMounted(store.loadStats)
</script>
```

---

## 12) `src/views/Settings.vue` 〈TTS(언어/속도) + 백업/복원〉

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">설정</h2>

    <div class="card" style="padding:16px;">
      <div class="stack" style="gap:12px; flex-wrap:wrap;">
        <label class="label">TTS 언어</label>
        <select class="input" style="max-width:200px" v-model="store.ttsLang">
          <option value="en-US">미국 영어(en-US)</option>
          <option value="en-GB">영국 영어(en-GB)</option>
        </select>

        <label class="label">속도: {{ store.ttsRate.toFixed(1) }}</label>
        <input class="input" type="range" min="0.8" max="1.2" step="0.1" v-model.number="store.ttsRate"/>
        <button class="btn" @click="test">테스트 🔊</button>
      </div>
    </div>

    <div class="card mt3" style="padding:16px;">
      <div class="stack" style="gap:8px; flex-wrap:wrap;">
        <button class="btn" @click="backup">백업(JSON)</button>
        <label class="btn btnPrimary">복원(JSON)
          <input type="file" accept=".json,application/json" hidden @change="restore"/>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
const test = () => store.speakNow('dictionary')
const backup = () => store.backupJSON()
const restore = (e:any) => { const f = e.target.files?.[0]; if (f) store.restoreJSON(f) }
</script>
```

---

## 13) `src/vite-env.d.ts` 〈Vite url import 타입〉

```ts
declare module '*.wasm?url' { const src: string; export default src }
declare module 'pdfjs-dist/build/pdf.worker.min?url' { const src: string; export default src }
```

---

# 적용 방법 (요약)

1. 위 마크다운을 LLM/에이전트에 넘겨 **파일별로 덮어쓰기/추가**.
2. `pnpm dev` 재실행 → **대시보드/학습/단어장/통계/설정** 기능 페이지 동작 확인.
3. PDF 업로드는 **단어장 페이지**의 “PDF → JSON → 삽입”에서 사용. 챕터는 PDF의 **DAY → day01** 형식으로 자동 매핑.

# 다음 단계(선택)

* **정확도 향상**: PDF 파서(정규식) 튜닝, 예문/품사/뜻 컬러링.
* **대용량 최적화**: OPFS(SQLite WASM + Origin Private FS)로 마이그레이션.
* **차트 라이브러리 연동**: Recharts/Chart.js로 통계 시각화 업그레이드.

문제 생기면 **파일명/경로/대소문자**와 브라우저 **서비스워커 캐시**(개발 중에는 Unregister)부터 확인해 주세요. 필요하면 로그 캡처 주시면 바로 고쳐드릴게요!
