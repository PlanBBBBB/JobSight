<template>
  <div class="file-uploader">
    <n-upload
      ref="uploadRef"
      :default-upload="false"
      :max="1"
      :multiple="false"
      accept=".csv"
      @change="handleChange"
    >
      <n-button quaternary type="primary" size="small">
        <template #icon><n-icon><UploadOutlined /></n-icon></template>
        上传任务
      </n-button>
    </n-upload>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { UploadInst } from 'naive-ui'
import { UploadOutlined } from '@vicons/antd'
import { useMessage } from 'naive-ui'
import { parseFile } from '@/utils/fileParser'
import type { Task } from '@/types'

const emit = defineEmits<{
  (e: 'loaded', tasks: Task[]): void
  (e: 'file-selected', name: string): void
}>()

const loading = ref(false)
const uploadRef = ref<UploadInst | null>(null)
const message = useMessage()

function handleChange(options: { file: { file?: File; status?: string; name?: string } | null }) {
  const file = options.file?.file
  const name = options.file?.name
  if (!file) return
  if (name) emit('file-selected', name)

  loading.value = true
  parseFile(file)
    .then(tasks => {
      emit('loaded', tasks)
      const invalid = tasks.filter(t => !t.isValid).length
      message.success(`成功导入 ${tasks.length} 个任务${invalid > 0 ? `，其中 ${invalid} 个Cron非法` : ''}`)
    })
    .catch(err => {
      message.error(`文件解析失败：${err.message || err}`)
    })
    .finally(() => {
      loading.value = false
      // 关键：清空 n-upload 内部状态，保证下次点击还能弹出文件选择器
      uploadRef.value?.clear()
    })
}
</script>

<style scoped>
.file-uploader {
  padding: 0;
  display: inline-block;
}
.file-uploader :deep(.n-upload) {
  display: inline-block;
}
.file-uploader :deep(.n-upload-file-list),
.file-uploader :deep(.n-upload-tip) {
  display: none;
}
</style>
