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
