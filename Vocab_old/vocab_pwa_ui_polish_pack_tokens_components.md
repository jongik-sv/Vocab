# UI Polish Pack

다음 파일들을 **덮어쓰기** 하면 즉시 더 예쁜 UI가 적용됩니다. (Gradient 배경, 글래스 상단바, 카드/버튼/테이블 디자인, 다크모드 대응)

## 1) styles

### `src/styles/tokens.css`

```css
:root {
  /* Colors */
  --color-brand: #4f46e5;
  --color-brand-600: #4f46e5;
  --color-brand-500: #6366f1;
  --color-brand-400: #818cf8;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-text-muted: #475569;
  --color-border: #e2e8f0;
  --color-success: #16a34a;
  --color-danger: #dc2626;

  /* Radius / Space / Shadow */
  --radii-sm: 10px;
  --radii-md: 14px;
  --radii-lg: 20px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --shadow-sm: 0 2px 10px rgba(2,6,23,0.06);
  --shadow-md: 0 8px 24px rgba(2,6,23,0.08);
  --shadow-lg: 0 20px 48px rgba(2,6,23,0.10);

  /* Typography */
  --font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif;
  --fs-xs: 12px; --fs-sm: 13px; --fs-md: 15px; --fs-lg: 18px; --fs-xl: 24px; --fs-2xl: 32px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0b0f19;
    --color-surface: #101626;
    --color-text: #e5e7eb;
    --color-text-muted: #9ca3af;
    --color-border: #1f2937;
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.4);
    --shadow-md: 0 12px 28px rgba(0,0,0,0.45);
    --shadow-lg: 0 28px 56px rgba(0,0,0,0.5);
  }
}
```

### `src/styles/base.css`

```css
* { box-sizing: border-box; }
html, body, #app { height: 100%; }
body {
  margin: 0; font-family: var(--font-family); color: var(--color-text);
  background: radial-gradient(1200px 600px at 80% -10%, rgba(99,102,241,.12), transparent),
              linear-gradient(180deg, var(--color-bg), var(--color-bg));
}

.container { max-width: 1040px; margin: 0 auto; padding: var(--space-6); }

/* Surface / Card */
.surface { background: var(--color-surface); border-radius: var(--radii-lg); box-shadow: var(--shadow-md); border: 1px solid var(--color-border); }
.card { background: var(--color-surface); border-radius: var(--radii-lg); box-shadow: var(--shadow-sm); border: 1px solid var(--color-border); }

/* Buttons */
.btn { appearance: none; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
  padding: 10px 14px; border-radius: var(--radii-md); font-weight: 600; letter-spacing: .2px; transition: all .15s ease; }
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.btnPrimary { background: var(--color-brand); border-color: var(--color-brand); color: #fff; }
.btnPrimary:hover { filter: brightness(1.05); }
.btnGhost { background: transparent; }

/* Inputs */
.input, select { width: 100%; padding: 10px 12px; border-radius: var(--radii-sm); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
.label { font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: 6px; display:block; }

/* Table */
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border); }
.table thead th { text-align: left; font-size: var(--fs-sm); color: var(--color-text-muted); }

/* Utils */
.stack { display: flex; gap: var(--space-3); align-items: center; }
.stackCol { display: flex; flex-direction: column; gap: var(--space-3); }
.center { display:grid; place-items:center; }
.mt2{ margin-top: var(--space-2);} .mt3{ margin-top: var(--space-3);} .mt4{ margin-top: var(--space-4);} .mt6{ margin-top: var(--space-6);}
```

## 2) components

### `src/components/TopBar.vue`

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
.wrap { position: sticky; top:0; z-index:10; display:flex; gap:20px; align-items:center; padding:14px 20px; backdrop-filter: saturate(140%) blur(8px);
  background: color-mix(in oklab, var(--color-surface) 85%, transparent); border-bottom:1px solid var(--color-border); }
.title { margin:0; font-size:20px; color: var(--color-brand); letter-spacing:.2px; }
.nav { display:flex; gap:14px; }
.nav :global(a) { text-decoration:none; color: var(--color-text-muted); padding:8px 10px; border-radius: 10px; }
.nav :global(a.router-link-active) { color:#fff; background: var(--color-brand); }
</style>
```

### `src/components/ProgressBar.vue`

```vue
<template>
  <div class="wrap">
    <div class="bar" :style="{ width: percent + '%' }" />
    <span class="label">{{ percent }}%</span>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ percent: number }>()
</script>
<style module>
.wrap { position: relative; height: 10px; background: #e5e7eb33; border-radius: 999px; overflow: hidden; }
.bar { height:100%; background: linear-gradient(90deg, var(--color-brand-400), var(--color-brand)); transition: width .25s ease; }
.label { position:absolute; right: 8px; top: -22px; font-size: var(--fs-sm); color: var(--color-text-muted); }
</style>
```

### `src/components/FlashCard.vue`

```vue
<template>
  <div class="wrap" @click="flip = !flip" @keyup.space.prevent="flip = !flip" tabindex="0">
    <div class="inner" :class="{ flipped: flip }">
      <section class="face front">
        <div class="head">{{ word.headword }}</div>
        <button class="btn btnGhost" @click.stop="speak(word.headword)">🔊 발음</button>
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
import { ref, watch } from 'vue'
import { speak } from '../utils/tts'
const props = defineProps<{ word: any }>()
const flip = ref(false)
watch(() => props.word?.id, () => { flip.value = false })
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

## 3) pages

### `src/pages/Dashboard.vue`

```vue
<template>
  <section class="stackCol">
    <div class="surface" style="padding:24px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
      <div>
        <h2 style="margin:0 0 6px 0; font-size: var(--fs-2xl);">오늘의 학습</h2>
        <p style="margin:0; color:var(--color-text-muted);">목표를 달성해 보세요!</p>
      </div>
      <button class="btn btnPrimary" @click="$router.push('/study')">오늘 학습 시작 ▶</button>
    </div>
    <div class="card" style="padding:16px;">
      <div class="stack" style="justify-content:space-between;">
        <strong>진행률</strong>
        <span style="color:var(--color-text-muted);">{{ progress }}%</span>
      </div>
      <div class="mt3"><ProgressBar :percent="progress" /></div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useStudyStore } from '../stores/study'
import ProgressBar from '../components/ProgressBar.vue'

const store = useStudyStore()
const progress = computed(() => store.progressPercent)
</script>
```

### `src/pages/Study.vue`

```vue
<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between;">
      <h2 style="margin:0">학습</h2>
      <span style="color:var(--color-text-muted)">진행: {{ store.index + 1 }} / {{ store.queue.length }}</span>
    </div>
    <div class="center">
      <div style="max-width:720px; width:100%">
        <FlashCard v-if="current" :word="current" @next="next" @memorized="memorize" />
        <div v-else class="card center" style="min-height:200px">학습할 카드가 없습니다.</div>
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

onMounted(() => { if (!store.queue.length) store.loadQueue() })
const next = () => store.next()
const memorize = () => store.memorizeCurrent()
</script>
```

### `src/pages/Vocab.vue`

```vue
<template>
  <section class="stackCol">
    <div class="stack" style="justify-content:space-between;">
      <h2 style="margin:0">단어장</h2>
      <button class="btn" @click="addSample">샘플 추가</button>
    </div>
    <div class="card" style="padding:12px;">
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

onMounted(store.refreshWords)
const addSample = () => store.addSample()
const del = (id:number) => store.deleteWord(id)
</script>
```

### `src/pages/Stats.vue`

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">통계</h2>
    <div class="stack" style="gap:16px; flex-wrap:wrap;">
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">오늘 학습</div>
        <div style="font-size:var(--fs-xl); font-weight:800;">{{ store.todayLearned }}</div>
      </div>
      <div class="card" style="padding:16px; min-width:260px;">
        <div class="label">누적 학습</div>
        <div style="font-size:var(--fs-xl); font-weight:800;">{{ store.totalLearned }}</div>
      </div>
    </div>
    <small style="color:var(--color-text-muted)">v1.0에서 차트 연결 예정</small>
  </section>
</template>
<script setup lang="ts">
import { useStudyStore } from '../stores/study'
const store = useStudyStore()
</script>
```

## 4) vite manifest 색상(선택)

`vite.config.ts`의 `background_color`를 `#0b0f19`로, `theme_color`는 브랜드 컬러로 설정했습니다. 필요 시 바꿔도 됩니다.

## 5) 적용 방법

1. 문서의 각 파일을 프로젝트에 **덮어쓰기**
2. `pnpm dev` 재실행
3. 안 예쁘면 `--color-brand`만 먼저 조정해 보세요 😉

