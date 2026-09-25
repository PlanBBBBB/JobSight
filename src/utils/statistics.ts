import type { Task, HeatmapPoint, StatsOverview } from '@/types'
import { parseCronExpression } from './cronParser'

/**
 * 从任务列表生成热力图数据
 * 返回 Map<"hour:minute", HeatmapPoint>
 */
export function buildHeatmapData(tasks: Task[]): Map<string, HeatmapPoint> {
  const map = new Map<string, HeatmapPoint>()

  for (const task of tasks) {
    if (!task.isValid) continue

    const parseResult = parseCronExpression(task.cron)
    if (!parseResult.isValid) continue

    for (const h of parseResult.hours) {
      for (const m of parseResult.minutes) {
        const key = `${h}:${m}`
        const existing = map.get(key)
        if (existing) {
          existing.count++
          existing.taskIds.push(String(task.id))
        } else {
          map.set(key, {
            hour: h,
            minute: m,
            count: 1,
            taskIds: [String(task.id)]
          })
        }
      }
    }
  }

  return map
}

/**
 * 从热力图数据生成概览统计
 */
export function computeStats(tasks: Task[], heatmap: Map<string, HeatmapPoint>): StatsOverview {
  const validTasks = tasks.filter(t => t.isValid).length
  const invalidTasks = tasks.length - validTasks

  let peakMinute = '--:--'
  let peakCount = 0
  let totalCount = 0

  for (const point of heatmap.values()) {
    totalCount += point.count
    if (point.count > peakCount) {
      peakCount = point.count
      peakMinute = `${String(point.hour).padStart(2, '0')}:${String(point.minute).padStart(2, '0')}`
    }
  }

  return {
    totalTasks: tasks.length,
    validTasks,
    invalidTasks,
    peakMinute,
    peakCount,
    avgCountPerMinute: heatmap.size > 0 ? Math.round(totalCount / heatmap.size * 10) / 10 : 0,
    activeMinutes: heatmap.size
  }
}

/**
 * 热力图 Top N 排行项
 */
export interface TopHeatmapItem {
  rank: number        // 1-based
  hour: number
  minute: number
  count: number
  taskNames: string[] // 该时段执行的任务名（前 5 个，用于排行展示）
  totalTaskNames: number // 该时段执行的任务总数（taskNames.length 可能被截断）
}

/**
 * 从热力图数据取 Top N，按 count 降序、同时刻按 minute/hour 升序稳定排序
 * 顺带把每个时段的任务名也挖出来，避免组件层再查一遍
 */
export function getTopNHeatmap(
  tasks: Task[],
  heatmap: Map<string, HeatmapPoint>,
  n = 10
): { items: TopHeatmapItem[]; maxCount: number } {
  const points = Array.from(heatmap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.minute !== b.minute) return a.minute - b.minute
    return a.hour - b.hour
  })

  const topN = points.slice(0, n)
  const idSet = new Set(tasks.map(t => String(t.id)))

  const items: TopHeatmapItem[] = topN.map((p, idx) => {
    const names = p.taskIds
      .filter(id => idSet.has(id))
      .map(id => tasks.find(t => String(t.id) === id)?.name ?? '')
      .filter(Boolean)
    return {
      rank: idx + 1,
      hour: p.hour,
      minute: p.minute,
      count: p.count,
      taskNames: names.slice(0, 5),
      totalTaskNames: names.length
    }
  })

  const maxCount = points[0]?.count ?? 0
  return { items, maxCount }
}

/**
 * 查找在指定 (hour, minute) 执行的所有任务
 */
export function findTasksAtMinute(
  tasks: Task[],
  heatmap: Map<string, HeatmapPoint>,
  hour: number,
  minute: number
): Task[] {
  const key = `${hour}:${minute}`
  const point = heatmap.get(key)
  if (!point) return []

  const idSet = new Set(point.taskIds)
  return tasks.filter(t => idSet.has(String(t.id)))
}
