<template>
  <div class="task-list">
    <div class="toolbar">
      <n-input
        v-model:value="searchText"
        placeholder="按编码/名称搜索..."
        clearable
        size="small"
        style="width: 240px"
      >
        <template #prefix><n-icon><SearchOutlined /></n-icon></template>
      </n-input>

      <n-checkbox
        v-model:checked="showInvalid"
        size="small"
      >
        显示非法Cron
      </n-checkbox>

      <span class="count-info">
        共 {{ filteredTasks.length }} / {{ props.tasks.length }} 个
      </span>
    </div>

    <n-data-table
      :columns="columns"
      :data="filteredTasks"
      :bordered="false"
      :max-height="maxHeight"
      size="small"
      striped
      :pagination="paginationState"
      :row-class-name="rowClassName"
      remote
      @update:page="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SearchOutlined } from '@vicons/antd'
import type { DataTableColumns } from 'naive-ui'
import type { Task } from '@/types'

const props = defineProps<{
  tasks: Task[]
  highlightedTaskId?: string | number | null
  maxHeight?: number | string
}>()

const searchText = ref('')
const showInvalid = ref(true)  // 默认显示非法Cron，方便一眼排查

const paginationState = ref({
  page: 1,
  pageSize: 20,
  itemCount: props.tasks.length
})

watch(() => props.tasks, (tasks) => {
  paginationState.value.itemCount = tasks.length
  paginationState.value.page = 1
})

function handlePageChange(page: number) {
  paginationState.value.page = page
}

function rowClassName(row: Task) {
  return row.isValid ? '' : 'row-invalid'
}

const filteredTasks = computed(() => {
  let arr = props.tasks

  // 非法过滤
  if (!showInvalid.value) {
    arr = arr.filter(t => t.isValid)
  }

  // 搜索过滤
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    arr = arr.filter(t =>
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.cron.toLowerCase().includes(q)
    )
  }

  // 分页切片
  const { page, pageSize } = paginationState.value
  const start = (page - 1) * pageSize
  return arr.slice(start, start + pageSize)
})

const columns = computed<DataTableColumns<Task>>(() => [
  {
    title: '状态',
    key: 'isValid',
    width: 56,
    render(row) {
      return row.isValid
        ? h(nTag, { bordered: false, type: 'success', size: 'tiny' }, { default: () => '✓' })
        : h(nTag, { bordered: false, type: 'error', size: 'tiny' }, { default: () => '✗' })
    }
  },
  {
    title: '编码',
    key: 'code',
    minWidth: 160,
    ellipsis: { tooltip: true }
  },
  {
    title: '名称',
    key: 'name',
    minWidth: 140,
    ellipsis: { tooltip: true }
  },
  {
    title: 'Cron表达式',
    key: 'cron',
    width: 160,
    ellipsis: { tooltip: true },
    render(row) {
      if (row.isValid) return row.cron
      return h('span', { class: 'cron-invalid', title: row.errorMsg || 'Cron表达式非法' }, row.cron || '(空)')
    }
  },
  {
    title: '说明',
    key: 'naturalText',
    minWidth: 240,
    ellipsis: { tooltip: true }
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 140,
    ellipsis: { tooltip: true }
  }
])

// naive-ui 需要单独引入 h 和 nTag
import { h } from 'vue'
import { NTag } from 'naive-ui'
const nTag = NTag
</script>

<style scoped>
.task-list {
  padding: 4px 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.count-info {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}
/* 非法行整体红色高亮 */
:deep(.row-invalid td) {
  background-color: rgba(239, 68, 68, 0.08) !important;
}
:deep(.row-invalid:hover td) {
  background-color: rgba(239, 68, 68, 0.14) !important;
}
/* 非法 Cron 表达式：红色 + 波浪下划线 + hover 显示错误原因 */
.cron-invalid {
  color: #ef4444;
  text-decoration: underline wavy #ef4444;
  cursor: help;
}
</style>
