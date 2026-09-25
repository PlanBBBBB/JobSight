<template>
  <n-modal
    :show="visible"
    preset="card"
    title="热力图点击任务详情"
    style="width: 680px"
    :mask-closable="true"
    @update:show="onClose"
  >
    <div v-if="pointInfo" class="modal-content">
      <div class="point-header">
        <span class="point-time">
          {{ pad(pointInfo.hour) }}:{{ pad(pointInfo.minute) }}
        </span>
        <n-tag :bordered="false" type="info" round size="small">
          共 {{ tasks.length }} 个任务在此时执行
        </n-tag>
      </div>

      <n-data-table
        :columns="columns"
        :data="tasks"
        :bordered="false"
        size="small"
        :max-height="360"
        striped
      />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import type { Task, HeatmapPoint } from '@/types'

const props = defineProps<{
  visible: boolean
  pointInfo: HeatmapPoint | null
  tasks: Task[]
}>()
void props

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

function onClose() {
  emit('update:visible', false)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const columns = computed<DataTableColumns<Task>>(() => [
  {
    title: '编码',
    key: 'code',
    width: 140,
    ellipsis: { tooltip: true }
  },
  {
    title: '名称',
    key: 'name',
    width: 180,
    ellipsis: { tooltip: true }
  },
  {
    title: 'Cron表达式',
    key: 'cron',
    width: 140,
    ellipsis: { tooltip: true }
  },
  {
    title: '说明',
    key: 'naturalText',
    ellipsis: { tooltip: true }
  },
  {
    title: '备注',
    key: 'remark',
    width: 120,
    ellipsis: { tooltip: true }
  }
])
</script>

<style scoped>
.modal-content {
  padding: 8px 0;
}
.point-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.point-time {
  font-size: 24px;
  font-weight: 600;
  color: #18a058;
  font-family: 'Consolas', 'Menlo', monospace;
}
</style>
