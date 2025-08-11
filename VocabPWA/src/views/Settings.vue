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
import { onMounted } from 'vue'
import { useStudyStore } from '../stores/study'

const store = useStudyStore()

const test = async () => {
  try {
    console.log('Settings: TTS 테스트 시작')
    await store.speakNow('Dictionary pronunciation test. This is working correctly.')
  } catch (error) {
    console.error('Settings: TTS 테스트 실패:', error)
    alert('음성 테스트 실패: ' + error.message)
  }
}

const backup = () => store.backupJSON()

const restore = async (e:any) => {
  const f = e.target.files?.[0]
  if (f) {
    try {
      console.log('JSON 파일 선택됨:', f.name)
      await store.restoreJSON(f)
      // 파일 입력 필드 초기화
      e.target.value = ''
    } catch (error) {
      console.error('JSON 복원 실패:', error)
    }
  }
}

onMounted(async () => {
  console.log('Settings: TTS 초기화 시작')
  await store.initTts()
  console.log('Settings: TTS 초기화 완료')
})
</script>