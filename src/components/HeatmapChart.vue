<template>
  <div class="heatmap-wrapper">
    <div ref="chartRef" class="chart-container"></div>
    <div v-if="!hasData" class="empty-tip">
      <n-icon size="48" depth="3"><SearchOutlined /></n-icon>
      <p>暂无数据，请先导入定时任务文件</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart, ScatterChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  DataZoomComponent,
  ToolboxComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { SearchOutlined } from '@vicons/antd'
import type { HeatmapPoint } from '@/types'

echarts.use([
  HeatmapChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  DataZoomComponent,
  ToolboxComponent,
  CanvasRenderer
])

const props = defineProps<{
  heatmapData: Map<string, HeatmapPoint>
  isDark: boolean
}>()

const emit = defineEmits<{
  (e: 'cell-click', point: HeatmapPoint): void
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const hasData = computed(() => props.heatmapData.size > 0)

// 生成X轴分类（24小时）
const xCategories = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}`)
// 生成Y轴分类（60分钟）
const yCategories = Array.from({ length: 60 }, (_, i) => `${String(i).padStart(2, '0')}`)

function handleResize() {
  chartInstance?.resize()
}

function ensureChartInstance() {
  if (!chartRef.value) return
  if (!chartInstance) {
    // 传 'dark' 让 ECharts 内置深色主题接管 axis/title/tooltip 等颜色
    chartInstance = echarts.init(chartRef.value, props.isDark ? 'dark' : undefined)
    chartInstance.on('click', handleChartClick)
  }
}

function disposeChart() {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
}

function rebuildChart() {
  disposeChart()
  nextTick(() => {
    ensureChartInstance()
    updateChartOption()
  })
}

function updateChartOption() {
  if (!chartInstance) return

  const data: number[][] = []
  let maxCount = 0

  props.heatmapData.forEach(point => {
    data.push([point.hour, point.minute, point.count])
    if (point.count > maxCount) maxCount = point.count
  })

  const visualMax = Math.max(maxCount, 1)
  const palette = getThemePalette(props.isDark)

  // label 字号：按 count 分级，避免所有格子都是一样大小的数字挤在一起
  // 只给 count >= 3 的格子标数字——低负载格子靠颜色就能看出来，标了反而变成数字海
  function dynamicLabelStyle(p: any) {
    const count = p.data?.[2]
    if (typeof count !== 'number' || count < 3) return null
    // 字号随 count 递增，保证大数字醒目、小数字不拥挤
    const fontSize = count >= 10 ? 14 : count >= 6 ? 12 : 10
    // 大数字用粗体
    const weight = count >= 6 ? 700 : 600
    return { fontSize, fontWeight: weight, color: palette.labelText }
  }

  const option: echarts.EChartsCoreOption = {
    // 四周留白加大，确保轴标签完整显示
    grid: { top: 36, left: 60, right: 30, bottom: 24 },
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: palette.textPrimary, fontSize: 13 },
      formatter: function (params: any) {
        if (params.data && typeof params.data[0] === 'number') {
          const hour = String(params.data[0]).padStart(2, '0')
          const minute = String(params.data[1]).padStart(2, '0')
          const count = params.data[2]
          const levelLabel = count === 0
            ? '<span style="color:#888">无任务</span>'
            : count <= 2 ? '<span style="color:#888">低负载</span>'
            : count <= 6 ? '<span style="color:#f59e0b">中等负载</span>'
            : '<span style="color:#ef4444;font-weight:700">⚠ 高负载</span>'
          return `<div style="margin-bottom:4px;font-weight:600">${hour}:${minute}</div>
                  <div>任务数：<b style="color:${palette.accent};font-size:15px">${count}</b> 个</div>
                  <div style="margin-top:2px">${levelLabel}</div>`
        }
        return ''
      }
    },
    xAxis: {
      type: 'category',
      data: xCategories,
      position: 'top',
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 13, interval: 1, color: palette.textMuted, fontWeight: 500 }
    },
    yAxis: {
      type: 'category',
      data: yCategories,
      inverse: true,     // ← 关键！让 00分 在顶部（左上角 00:00 为起点）
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 12, interval: 2, color: palette.textMuted, fontWeight: 500 }
    },
    visualMap: {
      show: false,
      min: 0,
      max: visualMax,
      inRange: { color: palette.heatColors }
    },
    series: [
      {
        name: '任务数',
        type: 'heatmap',
        data,
        // 数字标签：只给 count≥3 的格子标，字号整体放大一级
        label: {
          show: true,
          color: palette.labelText,
          formatter: function (p: any) {
            const count = p.data?.[2]
            if (typeof count !== 'number' || count < 3) return ''
            const level = count >= 10 ? 'l4' : count >= 6 ? 'l3' : 'l2'
            return `{${level}|${count}}`
          },
          rich: {
            l2: { fontSize: 12, fontWeight: 600, color: palette.labelText },
            l3: { fontSize: 14, fontWeight: 700, color: palette.labelText },
            l4: { fontSize: 16, fontWeight: 800, color: palette.labelHighlight }
          }
        },
        // 格子之间留白：border 用 canvas 背景色，每个格子独立成块
        itemStyle: {
          borderColor: palette.gridBorder,
          borderWidth: 2,
          gapWidth: 1.5
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 18,
            shadowColor: props.isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            borderWidth: 2,
            borderColor: props.isDark ? '#fbbf24' : '#f59e0b'
          },
          label: {
            show: true
          }
        }
      }
    ]
  }

  // 把动态 label 样式函数挂上去（ECharts rich 已覆盖，这个兜底）
  void dynamicLabelStyle

  chartInstance.setOption(option, true)
}

/**
 * 主题配色 palette — 单一可信的颜色来源
 * 经验：把所有图表硬编码色集中抽象，避免分散在各处难以维护
 */
function getThemePalette(isDark: boolean) {
  if (isDark) {
    // 深色模式：蓝→青阶跃 + 琥珀警示
    // canvas 背景 ≈ #1a1a28，count=0 格子用视觉化渐变最低阶
    return {
      // 热力图颜色阶：L0 是 count=0，L1-L5 是 count≥1 的递增
      heatColors: [
        '#2a2a3a',   // L0 count=0（和 canvas 背景有可感知的区别）
        '#3b4a6b',   // L1 count=1-2 低负载
        '#2e6ea8',   // L2 中等蓝
        '#1588c7',   // L3 亮蓝
        '#22d3ee',   // L4 亮青（醒目中间色）
        '#06b6d4',   // L5 深青（高负载）
        '#fbbf24'    // L6 琥珀色（极端警示）
      ],
      // 导出 PNG 用的纯填充色
      emptyCell: '#22222e',
      emptyCellBorder: '#2a2a38',
      // 文字
      textPrimary: '#e0e0e0',
      textSecondary: '#b0b0b0',
      textMuted: '#808080',
      labelText: '#ffffff',
      labelHighlight: '#fde68a',
      accent: '#22c55e',
      gridLine: '#3a3a4d',
      gridBorder: '#1a1a28',     // 格子间隙颜色（和 canvas 背景同色，形成分块）
      splitArea: ['#1e1e2a', '#242433'],
      tooltipBg: '#2a2a33',
      tooltipBorder: '#444455',
      exportBg: '#2a2a33'
    }
  }
  // 浅色模式：纯蓝阶渐变
  return {
    heatColors: [
      '#e8edf5',   // L0 count=0（比 canvas 背景 #f5f7fa 稍深，形成可感知区别）
      '#dbeafe',   // L1 count=1-2 极浅蓝
      '#93c5fd',   // L2 浅蓝
      '#3b82f6',   // L3 标准蓝
      '#2563eb',   // L4 中蓝
      '#1d4ed8',   // L5 深蓝
      '#0c2a6e'    // L6 深海蓝
    ],
    emptyCell: '#f2f4f8',
    emptyCellBorder: '#e5e7eb',
    textPrimary: '#1f1f1f',
    textSecondary: '#666666',
    textMuted: '#999999',
    labelText: '#1f2937',
    labelHighlight: '#92400e',
    accent: '#18a058',
    gridLine: '#e5e7eb',
    gridBorder: '#f5f7fa',       // 和 canvas 背景同色
    splitArea: ['#ffffff', '#f7f9fc'],
    tooltipBg: '#ffffff',
    tooltipBorder: '#e0e0e0',
    exportBg: '#ffffff'
  }
}

function handleChartClick(params: any) {
  if (!params.data || typeof params.data[0] !== 'number') return

  const hour = params.data[0] as number
  const minute = params.data[1] as number
  const key = `${hour}:${minute}`
  const point = props.heatmapData.get(key)

  if (point) {
    emit('cell-click', point)
  }
}

// === 导出 PNG ===
function downloadPNG() {
  if (!chartInstance) return null
  const palette = getThemePalette(props.isDark)
  return chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: palette.exportBg,
    excludeComponents: ['toolbox']
  })
}

function triggerDownload() {
  const dataURL = downloadPNG()
  if (!dataURL) return

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  const filename = `jobsight-heatmap_${ts}.png`

  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * 让热力图自动 hover 到指定格子（用于 Top N 排行点击联动）
 * 先 highlight + showTip，再短暂延迟恢复，避免 tooltip 一直挂着
 */
function highlightCell(hour: number, minute: number) {
  if (!chartInstance) return
  const opt = chartInstance.getOption() as any
  const seriesData: any[] | undefined = opt.series?.[0]?.data
  if (!seriesData) return
  const idx = seriesData.findIndex(
    (d: any) => Array.isArray(d) && d[0] === hour && d[1] === minute
  )
  if (idx < 0) return
  chartInstance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx })
  chartInstance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: idx })
  setTimeout(() => {
    if (chartInstance) {
      chartInstance.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      chartInstance.dispatchAction({ type: 'hideTip' })
    }
  }, 1800)
}

defineExpose({ triggerDownload, highlightCell })

// === 监听主题变化：必须 dispose + 重新 init 才能让 ECharts 切换内置深色主题 ===
watch(
  () => props.isDark,
  () => {
    rebuildChart()
  }
)

// === 数据变化：只更新 option ===
watch(
  () => props.heatmapData,
  () => {
    nextTick(() => {
      ensureChartInstance()
      updateChartOption()
    })
  },
  { deep: false }
)

onMounted(() => {
  nextTick(() => {
    ensureChartInstance()
    updateChartOption()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  disposeChart()
})
</script>

<style scoped>
.heatmap-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  /* 60 行分钟 × 约15px/行 + 轴/边距，让每个格子足够放下 12-16px 的数字 */
  min-height: 1050px;
}
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 1050px;
}
.empty-tip {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 12px;
}
.empty-tip p {
  margin: 0;
  font-size: 14px;
}
</style>
