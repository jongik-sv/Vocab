# MVP Wireframes & Vite Template

> 스펙 기준: Vue 3 + Vite + Pinia + Vue Router + CSS Modules + Design Tokens + **sql.js(웹용 SQLite WASM, IndexedDB 영속)** + Web Speech API + vite-plugin-pwa.\
> 목적: 바로 `pnpm i && pnpm dev`로 실행 가능한 최소 제품 + 향후 OPFS 전환 여지 남김.

---

## 1) MVP 화면 와이어프레임 (ASCII)

### A. 대시보드 (`/`)

```
┌──────────────────────────────────────────────┐
│  TopBar: [Vocab PWA]     [목표: 30] [진행률 40%]  │
├──────────────────────────────────────────────┤
│  [오늘 학습 시작 ▶]   [단어장 선택 ▾]  [통계 보기]   │
│                                              │
│  오늘 학습 요약                               │
│  - 완료: 12 / 30                              │
│  - 스트릭: 3일                                │
│                                              │
└──────────────────────────────────────────────┘
```

### B. 학습 화면 (`/study`)

```
┌──────────────────────────────────────────────┐
│ TopBar: [뒤로]  [단어장 ▾]   [진행률: 12/50]       │
├──────────────────────────────────────────────┤
│                ┌───────────────────────┐     │
│                │        front          │     │
│                │   "abandon"           │     │
│                │  [🔊 en-US | 1.0x]    │     │
│                └───────────────────────┘     │
│         [카드 뒤집기 ␣/탭]  [다음 →]  [외웠어요 ✓]  │
│  힌트/예문: (뒷면에서 노출)                      │
└──────────────────────────────────────────────┘
```

### C. 단어장 관리 (`/vocab`)

```
┌──────────────────────────────────────────────┐
│ [단어장 ▾][챕터 ▾][검색 🔍] [+ 추가]               │
├──────────────────────────────────────────────┤
│ headword | phonetic | html_content (리치)  |…  │
│ [edit]   [delete]                           │
└──────────────────────────────────────────────┘
```

### D. 통계 (`/stats`)

```
┌──────────────────────────────────────────────┐
│ [일] [주] [월]   목표: 30 (편집)                 │
├──────────────────────────────────────────────┤
│   (차트 자리 – v1.0에서 라이브러리 연결)          │
│   오늘: 12  / 누적: 120                          │
└──────────────────────────────────────────────┘
```

### E. 설정 (`/settings`)

```
┌──────────────────────────────────────────────┐
│ 테마: [시스템/라이트/다크]  | 언어: [KO/EN]        │
│ 알림 권한 요청 [요청]  | TTS 보이스/속도 설정     │
│ 데이터: [백업(JSON)] [복원(JSON)]                │
└──────────────────────────────────────────────┘
```

---

## 2) 프로젝트 구조 (파일 트리)

```
VocabPWA/
├─ index.html
├─ vite.config.ts
├─ package.json
├─ public/
│  ├─ icons/manifest-icon-192.png (placeholder)
│  └─ icons/manifest-icon-512.png (placeholder)
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ router/index.ts
│  ├─ stores/
│  │  ├─ db.ts           (sql.js 초기화, IndexedDB 영속)
│  │  └─ study.ts        (학습 로직 Pinia)
│  ├─ utils/tts.ts       (Web Speech API 래퍼)
│  ├─ components/
│  │  ├─ TopBar.vue
│  │  ├─ FlashCard.vue
│  │  ├─ ProgressBar.vue
│  │  └─ NotebookPicker.vue
│  ├─ pages/
│  │  ├─ Dashboard.vue
│  │  ├─ Study.vue
│  │  ├─ Vocab.vue
│  │  ├─ Stats.vue
│  │  └─ Settings.vue
│  ├─ styles/
│  │  ├─ tokens.css
│  │  └─ base.css
│  └─ pwa.ts            (서비스워커 등록)
└─ .eslintrc.cjs (선택), .stylelintrc.json (선택)
```

---

## 3) 코드 (복붙용)

### 3.1 `package.json`

```json
{
  "name": "vocab-pwa",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "pinia": "^2.1.7",
    "sql.js": "^1.9.0",
    "vue": "^3.4.21",
    "vue-router": "^4.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.20.0",
    "typescript": "^5.4.0"
  }
}
```

### 3.2 `vite.config.ts`

```ts
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
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        icons: [
          { src: '/icons/manifest-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/manifest-icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] }
    })
  ],
  css: { modules: { localsConvention: 'camelCaseOnly' } }
})
```

### 3.3 `index.html`

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vocab PWA</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 3.4 `src/main.ts`

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import './styles/tokens.css'
import './pwa'

createApp(App).use(createPinia()).use(router).mount('#app')
```

### 3.5 `src/pwa.ts`

```ts
// vite-plugin-pwa가 자동으로 SW를 생성/등록
// 추가 로직이 필요하면 여기서 처리
```

### 3.6 `src/router/index.ts`

```ts
import { createRouter, createWebHistory } from 'vue-router'

import Dashboard from '../pages/Dashboard.vue'
import Study from '../pages/Study.vue'
import Vocab from '../pages/Vocab.vue'
import Stats from '../pages/Stats.vue'
import Settings from '../pages/Settings.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/study', component: Study },
    { path: '/vocab', component: Vocab },
    { path: '/stats', component: Stats },
    { path: '/settings', component: Settings }
  ]
})

export default router
```

### 3.7 `src/styles/tokens.css`

```css
:root {
  --color-primary: #4f46e5;
  --color-text: #111827;
  --radius-md: 12px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --font-size-base: 14px;
}
@media (prefers-color-scheme: dark) {
  :root { --color-text: #e5e7eb; }
}
```

### 3.8 `src/styles/base.css`

```css
* { box-sizing: border-box; }
html, body, #app { height: 100%; }
body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--color-text); }

button { cursor: pointer; }
.container { max-width: 960px; margin: 0 auto; padding: var(--space-4); }
.card { border-radius: var(--radius-md); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.flex { display: flex; }
.center { display: grid; place-items: center; }
```

### 3.9 `src/App.vue`

```vue
<template>
  <div>
    <TopBar />
    <main class="container">
      <router-view />
    </main>
  </div>
</template>
<script setup lang="ts">
import TopBar from './components/TopBar.vue'
</script>
<style scoped>
main { padding-top: var(--space-4); }
</style>
```

### 3.10 `src/components/TopBar.vue`

```vue
<template>
  <header class="wrap">
    <h1 class="title">Vocab PWA</h1>
    <nav class="nav">
      <router-link to="/">대시보드</router-link>
      <router-link to="/study">학습</router-link>
      <router-link to="/vocab">단어장</router-link>
      <router-link to="/stats">통계</router-link>
      <router-link to="/settings">설정</router-link>
    </nav>
  </header>
</template>
<style module>
.wrap { display:flex; gap:16px; align-items:center; padding:12px 16px; border-bottom:1px solid #eee; }
.title { margin:0; font-size:18px; color: var(--color-primary); }
.nav { display:flex; gap:12px; }
.nav :global(a) { text-decoration:none; color:inherit; }
.nav :global(a.router-link-active) { color: var(--color-primary); font-weight: 600; }
</style>
```

### 3.11 `src/components/ProgressBar.vue`

```vue
<template>
  <div class="wrap">
    <div class="bar" :style="{ width: percent + '%' }" />
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ percent: number }>()
</script>
<style module>
.wrap { height: 8px; background:#eee; border-radius:8px; overflow:hidden; }
.bar { height:100%; background: var(--color-primary); transition: width .2s ease; }
</style>
```

### 3.12 `src/components/NotebookPicker.vue`

```vue
<template>
  <select v-model="model" @change="$emit('change', model)">
    <option value="all">전체</option>
    <option v-for="n in notebooks" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
  </select>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useStudyStore } from '../stores/study'

const store = useStudyStore()
const notebooks = computed(() => store.notebooks)
const model = defineModel<string>({ default: 'all' })
</script>
```

### 3.13 `src/components/FlashCard.vue`

```vue
<template>
  <div class="wrap card" @click="flip = !flip" @keyup.space.prevent="flip = !flip" tabindex="0">
    <div class="inner" :class="{ flipped: flip }">
      <section class="face front">
        <div class="head">{{ word.headword }}</div>
        <button @click.stop="speak(word.headword)">🔊</button>
      </section>
      <section class="face back" v-html="word.html_content"></section>
    </div>
  </div>
  <div class="actions">
    <button @click="$emit('next')">다음 →</button>
    <button @click="$emit('memorized')">외웠어요 ✓</button>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { speak } from '../utils/tts'
const props = defineProps<{ word: any }>()
const flip = ref(false)
watch(() => props.word?.id, () => { flip.value = false })
</script>
<style module>
.wrap { perspective: 1000px; padding: 16px; }
.inner { position: relative; transform-style: preserve-3d; transition: transform .4s ease; }
.flipped { transform: rotateY(180deg); }
.face { backface-visibility: hidden; min-height: 200px; padding: 24px; border-radius: var(--radius-md); background:#fff; }
.back { transform: rotateY(180deg); }
.head { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
.actions { display:flex; gap: 8px; margin-top: 12px; }
</style>
```

### 3.14 `src/pages/Dashboard.vue`

```vue
<template>
  <section>
    <h2>대시보드</h2>
    <NotebookPicker @change="onChange" />
    <div style="margin:12px 0;">
      <ProgressBar :percent="progress" />
    </div>
    <button @click="$router.push('/study')">오늘 학습 시작 ▶</button>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useStudyStore } from '../stores/study'
import NotebookPicker from '../components/NotebookPicker.vue'
import ProgressBar from '../components/ProgressBar.vue'

const store = useStudyStore()
const progress = computed(() => store.progressPercent)
const onChange = (id: string) => store.setActiveNotebook(id)
</script>
```

### 3.15 `src/pages/Study.vue`

```vue
<template>
  <section>
    <h2>학습</h2>
    <div v-if="current">
      <FlashCard :word="current" @next="next" @memorized="memorize" />
      <p>진행: {{ store.index + 1 }} / {{ store.queue.length }}</p>
    </div>
    <div v-else>학습할 카드가 없습니다.</div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStudyStore } from '../stores/study'
import FlashCard from '../components/FlashCard.vue'

const store = useStudyStore()
const current = computed(() => store.queue[store.index])

onMounted(() => { if (!store.queue.length) store.loadQueue() })
const next = () => store.next()
const memorize = () => store.memorizeCurrent()
</script>
```

### 3.16 `src/pages/Vocab.vue`

```vue
<template>
  <section>
    <h2>단어장</h2>
    <button @click="addSample">샘플 추가</button>
    <table>
      <thead><tr><th>영어</th><th>내용</th><th></th></tr></thead>
      <tbody>
        <tr v-for="w in words" :key="w.id">
          <td>{{ w.headword }}</td>
          <td><div v-html="w.html_content" /></td>
          <td><button @click="del(w.id)">삭제</button></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStudyStore } from '../stores/study'

const store = useStudyStore()
const words = computed(() => store.words)

onMounted(store.refreshWords)
const addSample = () => store.addSample()
const del = (id:number) => store.deleteWord(id)
</script>
```

### 3.17 `src/pages/Stats.vue`

```vue
<template>
  <section>
    <h2>통계</h2>
    <p>오늘 학습한 단어: {{ store.todayLearned }}</p>
    <p>누적 학습: {{ store.totalLearned }}</p>
    <small>v1.0에서 차트 연결 예정</small>
  </section>
</template>
<script setup lang="ts">
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
</script>
```

### 3.18 `src/pages/Settings.vue`

```vue
<template>
  <section>
    <h2>설정</h2>
    <label> TTS 속도
      <input type="range" min="0.8" max="1.2" step="0.1" v-model.number="store.ttsRate" />
    </label>
    <button @click="backup">백업(JSON)</button>
    <input type="file" @change="restore" />
  </section>
</template>
<script setup lang="ts">
import { useStudyStore } from '../stores/study'
const store = useStudyStore()

const backup = () => store.backupJSON()
const restore = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.restoreJSON(file)
}
</script>
```

### 3.19 `src/utils/tts.ts`

```ts
export function speak(text: string, rate = 1.0, voice?: SpeechSynthesisVoice) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
```

### 3.20 `src/stores/db.ts` (sql.js + IndexedDB 영속)

```ts
import initSqlJs from 'sql.js'

const DB_KEY = 'vocab.db'

async function loadArrayBuffer(): Promise<Uint8Array | null> {
  const req = indexedDB.open('vocab-db', 1)
  return await new Promise((resolve) => {
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readonly')
      const store = tx.objectStore('files')
      const getReq = store.get(DB_KEY)
      getReq.onsuccess = () => resolve(getReq.result || null)
      getReq.onerror = () => resolve(null)
    }
    req.onerror = () => resolve(null)
  })
}

async function saveArrayBuffer(data: Uint8Array) {
  const req = indexedDB.open('vocab-db', 1)
  await new Promise<void>((resolve) => {
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readwrite')
      tx.objectStore('files').put(data, DB_KEY)
      tx.oncomplete = () => resolve()
    }
  })
}

export async function getDB() {
  const SQL = await initSqlJs({ locateFile: (f) => `/${f}` })
  const bin = await loadArrayBuffer()
  const db = new SQL.Database(bin || undefined)
  // 스키마 생성
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

  const persist = () => saveArrayBuffer(db.export())
  return { db, persist }
}
```

### 3.21 `src/stores/study.ts`

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
      return state.queue.length ? Math.round(((state.index) / state.queue.length) * 100) : 0
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
      // 간단 카운트만 증가 (상태 테이블 연동은 v1.0)
      this.todayLearned++
      this.totalLearned++
      // 큐에서 제외
      this.queue.splice(this.index, 1)
      if (this.index >= this.queue.length) this.index = Math.max(0, this.queue.length - 1)
    },
    setActiveNotebook(id: string){ this.activeNotebook = id },
    async addSample() {
      const { db, persist } = await getDB()
      db.run(`INSERT INTO words(headword, html_content) VALUES ('abandon', '<b>버리다</b> / 예: He abandoned the plan.')`)
      db.run(`INSERT INTO words(headword, html_content) VALUES ('benefit', '<b>이익</b> / 예: It benefits everyone.')`)
      persist()
      await this.refreshWords()
    },
    async deleteWord(id:number){
      const { db, persist } = await getDB()
      const stmt = db.prepare(`DELETE FROM words WHERE id=?`)
      stmt.run([id])
      stmt.free()
      persist()
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
      persist()
      await this.refreshWords()
    }
  }
})
```

---

## 4) 사용 방법

1. 새 폴더 생성 후 위 파일 구조대로 저장
2. `pnpm i` (또는 `npm i`)
3. `pnpm dev` 실행 → [http://localhost:5173](http://localhost:5173)
4. 단어장 화면에서 **샘플 추가** 버튼으로 데이터 주입 → 학습 시작

> 참고: `sql.js`는 `sql-wasm.wasm` 파일을 자동 로드합니다. Vite 루트(`/`)에서 접근하므로 배포 시 정적 경로를 유지해 주세요.

---

## 5) 다음 단계(v1.0 로드맵)

- `word_status`와 연동한 **학습 상태**(NEW/LEARNING/MEMORIZED) 반영
- **챕터/단어장** 선택 필터 + 큐 구성 고도화
- **차트 라이브러리** 연결(Chart.js 또는 ECharts)
- **OPFS** 기반 영속 저장 전환(브라우저 지원 시)

