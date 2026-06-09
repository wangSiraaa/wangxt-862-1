<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @mousedown.self="$emit('close')"
      data-testid="create-task-modal"
    >
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl slide-in-right">
        <div class="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            🎯 新建布控任务
          </h2>
          <button
            class="text-slate-400 hover:text-white text-xl"
            data-testid="close-create-task"
            @click="$emit('close')"
          >✕</button>
        </div>
        <form class="p-6 space-y-4" @submit.prevent="submitForm">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="text-xs text-slate-400 block mb-1">任务标题 <span class="text-red-400">*</span></label>
              <input
                v-model="form.title"
                type="text"
                required
                minlength="3"
                placeholder="简明扼要描述事件..."
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                data-testid="create-title"
              />
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">严重等级 <span class="text-red-400">*</span></label>
              <select
                v-model="form.severity"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                data-testid="create-severity"
              >
                <option value="critical">🔴 紧急（30分钟内处置）</option>
                <option value="high">🟠 高（2小时内处置）</option>
                <option value="medium">🟡 中（6小时内处置）</option>
                <option value="low">🟢 低（24小时内处置）</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">所属网格 <span class="text-red-400">*</span></label>
              <select
                v-model="form.gridId"
                required
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                data-testid="create-grid"
              >
                <option value="">请选择...</option>
                <option v-for="g in store.grids" :key="g.id" :value="g.id">{{ g.name }} · {{ g.area }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="text-xs text-slate-400 block mb-1">具体地址</label>
              <input
                v-model="form.address"
                type="text"
                placeholder="详细地址或地标..."
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                data-testid="create-address"
              />
            </div>
            <div class="col-span-2">
              <label class="text-xs text-slate-400 block mb-1">详细描述</label>
              <textarea
                v-model="form.description"
                rows="4"
                placeholder="时间、规模、涉及人员、是否激化、已采取措施等..."
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                data-testid="create-description"
              ></textarea>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-700 flex items-center justify-between">
            <div class="text-xs text-slate-500">
              创建后状态为：<span class="text-slate-300 font-semibold">待研判</span>，需派发才能进入处理流程
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-sm border border-slate-600 text-slate-300 hover:bg-slate-800"
                @click="$emit('close')"
              >取消</button>
              <button
                type="submit"
                class="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/30"
                data-testid="create-submit"
              >🚀 创建布控任务</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useMainStore } from '@/stores/main'
import type { EventSeverity } from '@/types'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useMainStore()

const form = reactive({
  title: '',
  severity: 'high' as EventSeverity,
  gridId: '',
  address: '',
  description: ''
})

function submitForm() {
  if (!form.title || form.title.trim().length < 3) {
    store.showError('任务标题至少 3 个字符')
    return
  }
  if (!form.gridId) {
    store.showError('请选择所属网格')
    return
  }
  const created = store.createTask({ ...form })
  if (created) {
    form.title = ''
    form.severity = 'high'
    form.gridId = ''
    form.address = ''
    form.description = ''
    emit('close')
  }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
