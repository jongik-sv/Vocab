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