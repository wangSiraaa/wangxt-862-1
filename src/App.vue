<template>
  <div class="app-root">
    <router-view />
    <GlobalToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useMainStore } from '@/stores/main'
import GlobalToast from '@/components/GlobalToast.vue'

const store = useMainStore()

onMounted(() => {
  store.initializeFromURLAndStorage()
})
</script>

<style>
.app-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #07121f;
}
</style>
