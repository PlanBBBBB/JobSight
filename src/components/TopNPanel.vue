<template>
  <n-card :bordered="false" class="topn-card">
    <template #header>
      <div class="card-header">
        <div class="card-header-left">
          <span class="card-title">🔥 最高负载 Top {{ topN }}</span>
          <span v-if="!collapsed" class="card-hint">点击任一行可定位热力图并查看任务详情</span>
          <span v-else class="card-hint">
            最高负载 <b>{{ topNData.maxCount }}</b> 个任务 · 点击展开
          </span>
        </div>
        <div class="card-header-right">
          <n-radio-group v-if="!collapsed" v-model:value="topN" size="small" class="topn-switch">
            <n-radio-button :value="5">Top 5</n-radio-button>
            <n-radio-button :value="10">Top 10</n-radio-button>
            <n-radio-button :value="20">Top 20</n-radio-button>
          </n-radio-group>
          <n-button
            quaternary
            type="primary"
            size="small"
            @click="collapsed = !collapsed"
          >
            <template #icon>
              <n-icon><UpOutlined v-if="!collapsed" /><DownOutlined v-else /></n-icon>
            </template>
            {{ collapsed ? '展开' : '收起' }}
          </n-button>
        </div>
      </div>
    </template>

    <!-- 排行列表 -->
    <div v-if="!collapsed">
      <div v-if="topNData.items.length > 0" class="topn-list">
        <div
          v-for="item in topNData.items"
          :key="`${item.hour}:${item.minute}`"
          class="topn-row"
          @click="handleClick(item)"
        >
          <!-- 排名徽章 -->
          <span :class="['rank-badge', getRankClass(item.rank)]">
            {{ item.rank <= 3 ? medalEmoji(item.rank) : item.rank }}
          </span>

          <!-- 时间 -->
          <span class="rank-time">
            {{ pad(item.hour) }}:{{ pad(item.minute) }}
          </span>

          <!-- 进度条 -->
          <div class="rank-bar-wrap">
            <div
              class="rank-bar"
              :class="getRankClass(item.rank)"
              :style="{ width: barWidth(item.count) + '%' }"
            />
          </div>

          <!-- 数量 -->
          <span class="rank-count">
            <b>{{ item.count }}</b> 个任务
          </span>

          <!-- 任务名 -->
          <span class="rank-names">
            <span
              v-for="(name, i) in item.taskNames"
              :key="i"
              class="rank-name-tag"
            >{{ name }}</span>
            <span v-if="item.totalTaskNames > item.taskNames.length" class="rank-more">
              +{{ item.totalTaskNames - item.taskNames.length }}
            </span>
          </span>
        </div>
      </div>

      <div v-else class="empty-hint">暂无活跃时段数据</div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UpOutlined, DownOutlined } from '@vicons/antd'
import { getTopNHeatmap } from '@/utils/statistics'
import type { TopHeatmapItem } from '@/utils/statistics'
import type { Task, HeatmapPoint } from '@/types'

const props = defineProps<{
  tasks: Task[]
  heatmapData: Map<string, HeatmapPoint>
}>()

const emit = defineEmits<{
  (e: 'row-click', point: HeatmapPoint): void
}>()

const topN = ref(10)
const collapsed = ref(true)

const topNData = computed(() =>
  getTopNHeatmap(props.tasks, props.heatmapData, topN.value)
)

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function medalEmoji(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
}

function getRankClass(rank: number) {
  if (rank === 1) return 'rank-1'
  if (rank === 2) return 'rank-2'
  if (rank === 3) return 'rank-3'
  return 'rank-other'
}

function barWidth(count: number) {
  const max = topNData.value.maxCount || 1
  return Math.max(4, Math.round((count / max) * 100))
}

function handleClick(item: TopHeatmapItem) {
  const key = `${item.hour}:${item.minute}`
  const point = props.heatmapData.get(key)
  if (point) {
    emit('row-click', point)
  }
}
</script>

<style scoped>
.topn-card {
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
.card-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-hint {
  font-size: 11px;
  color: var(--text-muted);
}
.topn-switch {
  flex-shrink: 0;
}

.topn-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.topn-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.topn-row:hover {
  background: rgba(24, 160, 88, 0.08);
}

.rank-badge {
  width: 26px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-badge.rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; }
.rank-badge.rank-2 { background: linear-gradient(135deg, #d1d5db, #9ca3af); color: #fff; }
.rank-badge.rank-3 { background: linear-gradient(135deg, #fdba74, #c2794a); color: #fff; }
.rank-badge.rank-other { background: var(--app-bg); color: var(--text-secondary); }

.rank-time {
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
  width: 46px;
}

.rank-bar-wrap {
  flex: 1;
  height: 8px;
  background: var(--app-bg);
  border-radius: 4px;
  overflow: hidden;
  min-width: 60px;
}
.rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.rank-bar.rank-1 { background: linear-gradient(90deg, #fbbf24, #ef4444); }
.rank-bar.rank-2 { background: linear-gradient(90deg, #d1d5db, #9ca3af); }
.rank-bar.rank-3 { background: linear-gradient(90deg, #fdba74, #c2794a); }
.rank-bar.rank-other { background: linear-gradient(90deg, #3b82f6, #18a058); opacity: 0.85; }

.rank-count {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 80px;
}
.rank-count b {
  color: var(--brand-color);
  font-size: 14px;
  font-weight: 700;
}

.rank-names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.rank-name-tag {
  display: inline-block;
  padding: 1px 6px;
  background: var(--app-bg);
  border-radius: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-more {
  display: inline-block;
  padding: 1px 6px;
  background: rgba(24, 160, 88, 0.1);
  border-radius: 3px;
  font-size: 11px;
  color: var(--brand-color);
  font-weight: 600;
}

.empty-hint {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
