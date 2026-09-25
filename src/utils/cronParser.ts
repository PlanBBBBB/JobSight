import { parseExpression } from 'cron-parser'
import cronstrue from 'cronstrue/i18n'

export interface CronParseResult {
  isValid: boolean
  errorMsg?: string
  hours: number[]      // 合法的小时集合（去重排序）
  minutes: number[]    // 合法的分钟集合（去重排序）
  naturalText: string  // 自然语言描述
  fieldCount: number   // Cron段数（5=标准, 6=Quartz, 7=Quartz带年）
}

/**
 * 判断Cron是Quartz还是标准Linux crontab
 * Quartz: 6段或7段（秒 分 时 日 月 周 [年]），支持 ? L W # 等特殊语法
 * 标准: 5段（分 时 日 月 周）
 */
export function detectCronDialect(expr: string): 'quartz' | 'standard' {
  const trimmed = expr.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length >= 6) {
    // 6段或7段 → Quartz
    return 'quartz'
  }
  // 5段 → 标准
  return 'standard'
}

/**
 * 解析Cron表达式，提取合法的小时和分钟值
 * 核心逻辑：
 *   - 对于热力图，日/月/周字段不影响「时分组合」（只影响该Cron在哪天执行）
 *   - 我们只关心「这个Cron在一天内的哪些(hour, minute)会触发」
 */
export function parseCronExpression(expr: string): CronParseResult {
  const result: CronParseResult = {
    isValid: false,
    hours: [],
    minutes: [],
    naturalText: '',
    fieldCount: 0
  }

  if (!expr || !expr.trim()) {
    result.errorMsg = 'Cron表达式为空'
    return result
  }

  try {
    const trimmed = expr.trim()
    const parts = trimmed.split(/\s+/)
    result.fieldCount = parts.length

    if (parts.length < 5 || parts.length > 7) {
      result.errorMsg = `段数错误：需要5/6/7段，实际${parts.length}段`
      return result
    }

    // 用cron-parser校验合法性（只验证，不使用返回值）
    try {
      void parseExpression(trimmed)
    } catch (e) {
      // 尝试只取前5段（如果用户写了6段但用的是标准语法）
      if (parts.length >= 6) {
        const stdExpr = parts.slice(1, 6).join(' ') // 跳过秒字段
        try {
          void parseExpression(stdExpr)
        } catch (e2) {
          result.errorMsg = (e as Error).message
          return result
        }
      } else {
        result.errorMsg = (e as Error).message
        return result
      }
    }

    // cron-parser 没有直接暴露小时/分钟字段，我们用自然语言和手动解析相结合
    // 方案：直接从表达式里提取 hour 和 minute 字段
    // 标准5段: 分 时 日 月 周 → index 0=分, 1=时
    // Quartz6段: 秒 分 时 日 月 周 → index 1=分, 2=时
    // Quartz7段: 秒 分 时 日 月 周 年 → index 1=分, 2=时
    
    const dialect = detectCronDialect(trimmed)
    let minuteFieldIdx = 0
    let hourFieldIdx = 1
    let cronForLib = trimmed

    if (dialect === 'quartz') {
      minuteFieldIdx = 1
      hourFieldIdx = 2
      // cronstrue 处理 Quartz 需要去掉秒字段
      cronForLib = parts.slice(1).join(' ')
    }

    // 手动解析 hour/minute 字段，得到所有可能值
    result.minutes = resolveField(parts[minuteFieldIdx], 0, 59)
    result.hours = resolveField(parts[hourFieldIdx], 0, 23)

    result.isValid = true
    result.naturalText = cronstrue.toString(cronForLib, { locale: 'zh_CN' })

    return result
  } catch (e) {
    result.errorMsg = (e as Error).message
    return result
  }
}

/**
 * 解析单个Cron字段，展开为所有合法值
 * 支持的语法:
 *   - * : 全范围
 *   - n : 单个值
 *   - a-b : 范围
 *   - a,b,c : 枚举
 *   - 星号/步长 或 a-b/步长 : 步长语法
 */
function resolveField(field: string, min: number, max: number): number[] {
  const values = new Set<number>()
  const clampedMin = Math.max(min, 0)

  // 按逗号拆分（枚举）
  const parts = field.split(',')
  
  for (const part of parts) {
    const trimmed = part.trim()
    
    // 检查步长语法: */n 或 a-b/n
    if (trimmed.includes('/')) {
      const [rangePart, stepStr] = trimmed.split('/')
      const step = parseInt(stepStr, 10)
      if (isNaN(step) || step <= 0) continue

      let rangeStart: number
      let rangeEnd: number

      if (rangePart === '*') {
        rangeStart = clampedMin
        rangeEnd = max
      } else if (rangePart.includes('-')) {
        const [s, e] = rangePart.split('-')
        rangeStart = parseInt(s, 10)
        rangeEnd = parseInt(e, 10)
      } else {
        rangeStart = parseInt(rangePart, 10)
        rangeEnd = max
      }

      if (isNaN(rangeStart) || isNaN(rangeEnd)) continue

      for (let v = rangeStart; v <= rangeEnd; v += step) {
        if (v >= clampedMin && v <= max) {
          values.add(v)
        }
      }
    }
    // 范围语法: a-b
    else if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-')
      const start = parseInt(s, 10)
      const end = parseInt(e, 10)
      if (isNaN(start) || isNaN(end)) continue

      for (let v = start; v <= end; v++) {
        if (v >= clampedMin && v <= max) {
          values.add(v)
        }
      }
    }
    // 全通配
    else if (trimmed === '*' || trimmed === '?') {
      for (let v = clampedMin; v <= max; v++) {
        values.add(v)
      }
    }
    // 单个值
    else {
      const val = parseInt(trimmed, 10)
      if (!isNaN(val) && val >= clampedMin && val <= max) {
        values.add(val)
      }
    }
  }

  return Array.from(values).sort((a, b) => a - b)
}

/**
 * 根据解析结果生成所有 (hour, minute) 组合
 */
export function expandTimePairs(parseResult: CronParseResult): Array<{ hour: number; minute: number }> {
  if (!parseResult.isValid) return []
  
  const pairs: Array<{ hour: number; minute: number }> = []
  for (const h of parseResult.hours) {
    for (const m of parseResult.minutes) {
      pairs.push({ hour: h, minute: m })
    }
  }
  return pairs
}
