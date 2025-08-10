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
