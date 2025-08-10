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