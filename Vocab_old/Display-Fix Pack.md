# 핵심 요약

* 화면이 “깜깜”한 건 보통 **라우터/마운트/서비스워커/엔트리 경로** 때문에 생깁니다.
* 아래 **“Display-Fix Pack.md”** 한 파일에 들어있는 **5개 파일만 교체**하면 기본 화면(대시보드)이 즉시 떠요.
* 또한 **라우터 폴백(404→/), TopBar, 컨테이너, CSS 임포트, persist 호출**을 정리했고, **서비스 워커 캐시**로 인한 빈화면을 방지합니다.

---

# Display-Fix Pack.md  (이 파일 그대로 적용)

> 아래 파일들만 덮어쓰기(또는 생성) 하세요. 나머지 `db.ts / study.ts / pdf2json.ts` 등은 그대로 두셔도 됩니다.

---

## 1) `index.html`

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width,initial-scale=1,viewport-fit=cover"
    />
    <title>Vocab PWA</title>
  </head>
  <body>
    <!-- 반드시 있어야 합니다 -->
    <div id="app"></div>

    <!-- 엔트리: main.ts 사용 중이면 .ts, main.js면 .js 로 맞추세요 -->
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

## 2) `src/main.ts`

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 전역 스타일(순서 유지)
import './styles/tokens.css'
import './styles/base.css'

// 영구 저장 시도(가능 브라우저)
import { ensurePersistence } from './utils/persist'
ensurePersistence()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

> **주의:** 프로젝트가 JS 기반이면 파일명을 `main.js`로 하고 import 구문도 JS로 그대로 사용해도 됩니다. 중요한 건 **index.html의 엔트리 경로와 일치**하는 것입니다.

---

## 3) `src/router/index.ts`

```ts
import { createRouter, createWebHistory } from 'vue-router'

// 가벼운 확인용 화면들
const Dashboard = () => import('../views/Dashboard.vue')
const Study = () => import('../views/Study.vue')
const Vocab = () => import('../views/Vocab.vue')    // 기존 파일명이 Manage면 경로 맞춰주세요
const Stats = () => import('../views/Stats.vue')
const Settings = () => import('../views/Settings.vue').catch(() => Dashboard())

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/study', component: Study },
    { path: '/vocab', component: Vocab },
    { path: '/stats', component: Stats },
    { path: '/settings', component: Settings },
    // 폴백: 어떤 경우에도 빈 화면이 아닌 루트로 보냄
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() { return { top: 0 } }
})

export default router
```

---

## 4) `src/App.vue`

```vue
<template>
  <div>
    <TopBar />
    <main class="container">
      <!-- 라우트가 매칭 안 돼도 폴백 덕에 '/'로 옵니다 -->
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import TopBar from './components/TopBar.vue'
</script>
```

---

## 5) `src/components/TopBar.vue`

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

<style scoped>
.wrap{
  position: sticky; top: 0; z-index: 10;
  display: flex; gap: 20px; align-items: center;
  padding: 14px 20px;
  backdrop-filter: saturate(140%) blur(8px);
  background: color-mix(in oklab, var(--color-surface) 85%, transparent);
  border-bottom: 1px solid var(--color-border);
}
.title{ margin:0; font-size: 18px; font-weight: 800; color: var(--color-brand); }
.nav{ display:flex; gap: 12px; }
.nav a{ padding: 8px 10px; border-radius: 10px; color: var(--color-text-muted); text-decoration: none; }
.nav a.router-link-active{ color: #fff; background: var(--color-brand); }
</style>
```

---

## 6) `src/views/Dashboard.vue`  (필수: 여기까지 보이면 성공)

```vue
<template>
  <section class="stackCol">
    <div class="surface" style="padding:24px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
      <div>
        <h2 style="margin:0 0 6px 0;">오늘의 학습</h2>
        <p style="margin:0; color:var(--color-text-muted)">화면이 보이면 라우팅/마운트 OK</p>
      </div>
      <router-link class="btn btnPrimary" to="/study">학습 시작 ▶</router-link>
    </div>
  </section>
</template>
```

---

## 7) `src/views/Study.vue`  (간단 더미)

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">학습</h2>
    <p style="color:var(--color-text-muted)">여기까지 나오면 라우팅 정상</p>
  </section>
</template>
```

---

## 8) `src/views/Vocab.vue`  (간단 더미 — 나중에 기능 페이지로 교체)

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">단어장</h2>
    <p style="color:var(--color-text-muted)">이 페이지가 보이면 최소 렌더링 OK</p>
  </section>
</template>
```

---

## 9) `src/views/Stats.vue`  (간단 더미)

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">통계</h2>
  </section>
</template>
```

---

## 10) `src/views/Settings.vue`  (간단 더미)

```vue
<template>
  <section class="stackCol">
    <h2 style="margin:0">설정</h2>
  </section>
</template>
```

---

# 체크리스트 (중요)

1. **엔트리 경로 일치**: `index.html`의 `<script type="module" src="/src/main.ts">` 가 실제 파일명(`main.ts`/`main.js`)과 **완전히 일치**해야 합니다.
2. **라우터 폴백**: 위 `/:pathMatch(.*)*` 리다이렉트가 없으면 빈 화면이 나오는 경우가 있습니다(히스토리 라우터 초기 경로 미스매치).
3. **서비스워커 캐시 초기화**(PWA 사용 시):

   * DevTools → Application → Service Workers → **Unregister** → **Clear storage**(특히 “Unregister service workers” 체크) → 새로고침(하드 리로드).
   * 또는 개발 중엔 `vite.config`에서 PWA 플러그인을 잠깐 주석 처리해도 됩니다.
4. **스타일 불러오기**: `main.ts`에서 `tokens.css`, `base.css`를 임포트해야 내용이 “투명 배경에 글자 안 보이는” 문제를 피합니다.
5. **파일 경로 대소문자**: Windows/웹서버 환경 차이로 대소문자 틀리면 빈 화면이 날 수 있어요. `views`/`pages` 폴더 명칭 일관 확인.

---

## 다음 단계

* 위 Display-Fix Pack으로 **우선 화면이 보이게** 만든 뒤,
  원하시면 이전에 드린 \*\*기능팩(영구 저장/JSON·PDF 업로드/단어장·챕터/플립/TTS)\*\*을 그대로 얹을 수 있게 **페이지별로 합쳐드릴게요.**
* 지금 화면이 뜨면 알려주세요. 그 상태 기준으로 기능 페이지를 다시 **하나의 마크다운**으로 묶어 드립니다.
