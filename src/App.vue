<template>
  <n-config-provider :theme="naiveTheme">
    <n-message-provider>
      <div class="app-container">
      <!-- 顶部标题栏 -->
      <header class="app-header">
        <div class="header-left">
          <n-icon size="20" class="logo-icon" title="双击切换深色模式" @dblclick="toggleDark">
            <ThunderboltOutlined />
          </n-icon>
          <h1 title="双击切换深色模式" @dblclick="toggleDark">JobSight <span class="subtitle">· 定时任务时分监控</span></h1>
        </div>
        <div class="header-right">
          <span v-if="uploadedFileName" class="file-name" :title="uploadedFileName">{{ uploadedFileName }}</span>
          <FileUploader @loaded="handleTasksLoaded" @file-selected="handleFileSelected" />
        </div>
      </header>

      <!-- 主内容区 -->
      <main class="app-main">
        <!-- 空状态 -->
        <div v-if="heatmapData.size === 0" class="empty-state">
          <n-result status="info" title="欢迎使用 JobSight">
            <template #icon>
              <n-icon size="72" depth="3" class="empty-logo"><ThunderboltOutlined /></n-icon>
            </template>
            请在右上角上传从数据库导出的定时任务 CSV 文件，即可查看
            <b>一天内每一分钟的任务执行密度热力图</b>，快速定位压力集中时段。
          </n-result>
        </div>

        <!-- 有数据时：紧凑统计行 + 热力图 -->
        <template v-else>
          <!-- 统计卡片 -->
          <section class="stats-row">
            <n-card :bordered="false" class="stat-card">
              <n-statistic label="总任务数" :value="stats.totalTasks" />
            </n-card>
            <n-card :bordered="false" class="stat-card">
              <n-statistic label="合法任务" :value="stats.validTasks">
                <template #suffix>
                  <span class="valid-rate">（{{ validRate }}%）</span>
                </template>
              </n-statistic>
            </n-card>
            <n-card :bordered="false" class="stat-card">
              <n-statistic label="最高负载时段" :value="stats.peakMinute">
                <template #suffix>
                  <span class="peak-count">{{ stats.peakCount }}个任务</span>
                </template>
              </n-statistic>
            </n-card>
            <n-card :bordered="false" class="stat-card">
              <n-statistic label="活跃分钟数" :value="stats.activeMinutes" />
            </n-card>
            <n-card :bordered="false" class="stat-card">
              <n-statistic label="平均每分钟任务" :value="stats.avgCountPerMinute" />
            </n-card>
          </section>

          <!-- Top N 排行 -->
          <section class="topn-section">
            <TopNPanel
              :tasks="tasks"
              :heatmap-data="heatmapData"
              @row-click="handleTopNRowClick"
            />
          </section>

          <!-- 热力图 -->
          <section class="heatmap-section">
            <n-card :bordered="false" class="heatmap-card">
              <template #header>
                <div class="card-header">
                  <div class="card-header-left">
                    <span class="card-title">任务时分热力图</span>
                    <span class="card-hint">X轴：小时 (00-23) · Y轴：分钟 (00-59)</span>
                  </div>
                  <n-button
                    v-if="heatmapData.size > 0"
                    quaternary
                    type="primary"
                    size="small"
                    :loading="downloading"
                    @click="handleDownloadPNG"
                  >
                    <template #icon><n-icon><DownloadOutlined /></n-icon></template>
                    导出 PNG
                  </n-button>
                </div>
              </template>
              <HeatmapChart
                ref="heatmapRef"
                :heatmap-data="heatmapData"
                :is-dark="isDark"
                @cell-click="handleCellClick"
              />
            </n-card>
          </section>
          <section class="task-section">
            <n-card :bordered="false" title="任务列表" class="task-card">
              <TaskList :tasks="tasks" />
            </n-card>
          </section>
        </template>
      </main>

      <!-- 点击热力图弹出的详情 -->
      <TaskDetailModal
        v-model:visible="modalVisible"
        :point-info="clickedPoint"
        :tasks="clickedTasks"
      />
    </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { darkTheme } from 'naive-ui'
import { ThunderboltOutlined, DownloadOutlined } from '@vicons/antd'
import { buildHeatmapData, computeStats, findTasksAtMinute } from '@/utils/statistics'
import FileUploader from '@/components/FileUploader.vue'
import HeatmapChart from '@/components/HeatmapChart.vue'
import TaskList from '@/components/TaskList.vue'
import TopNPanel from '@/components/TopNPanel.vue'
import TaskDetailModal from '@/components/TaskDetailModal.vue'
import type { Task, HeatmapPoint, StatsOverview } from '@/types'

// === 深色模式 ===
const isDark = ref(false)

onMounted(() => {
  // 1. 优先读取用户上次保存的偏好
  const saved = localStorage.getItem('jobsight-theme')
  if (saved === 'light') {
    isDark.value = false
  } else if (saved === 'dark') {
    isDark.value = true
  } else {
    // 2. 没保存过 → 默认暗色模式
    isDark.value = true
  }
})

watch(isDark, (val) => {
  document.documentElement.classList.toggle('dark', val)
  localStorage.setItem('jobsight-theme', val ? 'dark' : 'light')
}, { immediate: true })

function toggleDark() {
  isDark.value = !isDark.value
}

const naiveTheme = computed(() => (isDark.value ? darkTheme : null))

// === 状态 ===
const tasks = ref<Task[]>([])
const heatmapData = ref<Map<string, HeatmapPoint>>(new Map())
const uploadedFileName = ref('')

// 热力图实例引用（用于导出PNG）
const heatmapRef = ref<InstanceType<typeof HeatmapChart> | null>(null)
const downloading = ref(false)

// 详情弹窗状态
const modalVisible = ref(false)
const clickedPoint = ref<HeatmapPoint | null>(null)
const clickedTasks = ref<Task[]>([])

// === 计算属性 ===
const stats = computed<StatsOverview>(() =>
  computeStats(tasks.value, heatmapData.value)
)

const validRate = computed(() => {
  if (tasks.value.length === 0) return '0'
  const v = Math.round((stats.value.validTasks / tasks.value.length) * 100)
  return String(v)
})

// === 事件处理 ===
function handleTasksLoaded(loaded: Task[]) {
  tasks.value = loaded
  heatmapData.value = buildHeatmapData(loaded)
}

function handleFileSelected(name: string) {
  uploadedFileName.value = name
}

function handleCellClick(point: HeatmapPoint) {
  clickedPoint.value = point
  clickedTasks.value = findTasksAtMinute(tasks.value, heatmapData.value, point.hour, point.minute)
  modalVisible.value = true
}

function handleTopNRowClick(point: HeatmapPoint) {
  // 1. 热力图自动 hover 高亮 + 弹出 tooltip，1.8s 后恢复
  heatmapRef.value?.highlightCell(point.hour, point.minute)
  // 2. 紧接着打开任务详情弹窗
  handleCellClick(point)
}

function handleDownloadPNG() {
  downloading.value = true
  // 用 requestAnimationFrame 让 loading 状态先渲染，再执行下载
  requestAnimationFrame(() => {
    try {
      heatmapRef.value?.triggerDownload()
    } catch (e) {
      console.error('导出失败:', e)
    } finally {
      downloading.value = false
    }
  })
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 16px;
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  gap: 12px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}
.logo-icon {
  color: var(--brand-color);
  cursor: pointer;
  user-select: none;
}
.header-left h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}
.header-left .subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: 2px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-name {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-main {
  flex: 1;
  padding: 8px 16px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 80px;
}
.empty-logo {
  color: var(--brand-color);
}

/* === 统计卡片 === */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat-card {
  border-radius: 8px;
  box-shadow: var(--card-shadow);
  background: var(--card-bg);
}
.valid-rate {
  color: #18a058;
  font-size: 12px;
}
.peak-count {
  color: #f0a020;
  font-size: 12px;
}

.heatmap-section {
  margin-bottom: 16px;
}
.topn-section {
  margin-bottom: 12px;
}
.heatmap-card {
  border-radius: 8px;
  box-shadow: var(--card-shadow);
  background: var(--card-bg);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.card-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.task-card {
  border-radius: 8px;
  box-shadow: var(--card-shadow);
  background: var(--card-bg);
}
</style>
