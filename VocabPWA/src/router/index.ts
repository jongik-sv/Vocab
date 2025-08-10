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
    // 폴백: 어떤 경우에도 빈 화면이 아닌 루트로 보냄
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() { return { top: 0 } }
})

export default router