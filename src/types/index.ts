// 定时任务定义
export interface Task {
  id: string | number
  code: string          // 任务编码
  name: string          // 任务名称
  cron: string          // Cron表达式
  remark?: string       // 备注
  isValid: boolean      // Cron是否合法
  errorMsg?: string     // Cron解析错误信息
  naturalText?: string  // Cron自然语言描述
}

// 热力图数据点（一个分钟格子）
export interface HeatmapPoint {
  hour: number          // 0-23
  minute: number        // 0-59
  count: number         // 该分钟执行的任务数
  taskIds: string[]     // 该分钟执行的任务ID列表
}

// 统计概览
export interface StatsOverview {
  totalTasks: number           // 总任务数
  validTasks: number           // 合法任务数
  invalidTasks: number         // 非法任务数
  peakMinute: string           // 最高负载时间（如"09:15"）
  peakCount: number            // 最高负载任务数
  avgCountPerMinute: number    // 平均每分钟任务数（只统计有任务的分钟）
  activeMinutes: number        // 有任务的分钟数
}

// 文件导入后的原始行
export interface RawRow {
  id?: string | number
  code?: string
  name?: string
  cron?: string
  remark?: string
  [key: string]: unknown
}
