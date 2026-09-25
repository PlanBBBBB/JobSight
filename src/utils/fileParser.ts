import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Task, RawRow } from '@/types'
import { parseCronExpression } from './cronParser'

/**
 * 从原始行数组中标准化出Task列表
 */
export function rowsToTasks(rows: RawRow[]): Task[] {
  const tasks: Task[] = []
  let idCounter = 1

  for (const row of rows) {
    // 字段兼容：不管是中文表头还是英文表头都能识别
    const code = String(row.code ?? row.编码 ?? row.taskCode ?? '')
    const name = String(row.name ?? row.名称 ?? row.taskName ?? '')
    const cron = String(row.cron ?? row.Cron ?? row.cronExpression ?? row.表达式 ?? '')
    const remark = row.remark ?? row.备注 ?? row.description ?? ''

    // 跳过全空行
    if (!code && !name && !cron) continue

    const parseResult = parseCronExpression(cron)

    tasks.push({
      id: row.id ?? idCounter++,
      code: code.trim(),
      name: name.trim() || code.trim(),
      cron: cron.trim(),
      remark: remark ? String(remark).trim() : '',
      isValid: parseResult.isValid,
      errorMsg: parseResult.isValid ? undefined : parseResult.errorMsg,
      naturalText: parseResult.isValid ? parseResult.naturalText : undefined
    })
  }

  return tasks
}

/**
 * 解析CSV文件
 */
export function parseCsv(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const tasks = rowsToTasks(results.data as RawRow[])
          resolve(tasks)
        } catch (e) {
          reject(e)
        }
      },
      error(err) {
        reject(err)
      }
    })
  })
}

/**
 * 解析Excel文件
 */
export function parseExcel(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })
        const tasks = rowsToTasks(rows)
        resolve(tasks)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 解析JSON文件
 */
export function parseJson(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const data = JSON.parse(text)
        // 兼容数组和 { tasks: [...] } 两种JSON结构
        const rows: RawRow[] = Array.isArray(data) ? data : (data.tasks || data.jobs || [])
        const tasks = rowsToTasks(rows)
        resolve(tasks)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * 根据文件扩展名选择解析器
 */
export async function parseFile(file: File): Promise<Task[]> {
  const name = file.name.toLowerCase()
  
  if (name.endsWith('.csv')) {
    return parseCsv(file)
  }
  throw new Error(`不支持的文件格式：${file.name}（仅支持从数据库导出的 .csv 文件）`)
}
