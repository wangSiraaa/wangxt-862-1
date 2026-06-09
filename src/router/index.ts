import { createRouter, createWebHashHistory } from 'vue-router'
import CommandCenter from '@/views/CommandCenter.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'CommandCenter',
      component: CommandCenter
    }
  ]
})

export default router
