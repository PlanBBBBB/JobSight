# JobSight · 定时任务时分监控

> 用热力图一眼看清一天内每一分钟的定时任务执行密度，快速定位压力集中时段。

![Vue3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.x-646cff?logo=vite)
![ECharts](https://img.shields.io/badge/ECharts-5.x-4f46e5)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 项目背景

后台系统运行着大量定时任务（数据库日结、日志归档、数据同步、报表生成……），这些任务散落在不同系统、不同 Cron 表达式里。一旦多个任务恰好在同一分钟扎堆执行，就会触发 DB 连接池耗尽、CPU 飙升、磁盘 IO 打满等连锁问题。

**JobSight 的核心价值**：把"一堆看不懂的 Cron 表达式"变成**一张人眼一眼就能扫完的热力图**，让运维、DBA、开发同学在发版前、上线后、值班排障时，都能 30 秒内回答这些问题：

- 🔴 最忙的是哪一分钟？那个时刻跑了多少个任务？
- 📉 凌晨低峰期有没有被白白浪费？
- ⚠️ 这次上线新加的定时任务，会不会和已有任务撞车？
- 🧾 老板要我汇报"系统负载分布"，截图一张热力图就搞定。

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| 📄 CSV 导入 | 直接从数据库查询导出 CSV 上传，支持中英文字段名自动识别 |
| 🔥 时分热力图 | 24×60 网格，X 轴小时 00-23，Y 轴分钟 00-59，颜色越深负载越高 |
| 🔝 Top N 排行榜 | 默认收起，展开后显示最高负载 Top 5/10/20 时段，含任务名+进度条 |
| 🔍 点击联动 | 点热力图格子 / 点排行行 → 弹出该分钟所有任务详情 |
| ⚠️ 非法 Cron 高亮 | 整行红色背景 + 波浪下划线，hover 看错误原因 |
| 🌓 深色 / 浅色模式 | 默认深色，双击顶部闪电图标或标题切换，偏好持久化 |
| 📸 导出 PNG | 一键导出当前热力图为 2x 高清 PNG，随主题背景 |
| 📋 任务列表 | 表格 + 搜索 + 分页，可切换显示/隐藏非法 Cron |

## 📥 CSV 文件格式

直接从数据库执行 `SELECT` 查询后导出 CSV 即可。JobSight 会自动识别以下字段（中英文字段名都支持）：

| 含义 | 支持的字段名 |
|------|-------------|
| 任务编码 | `code`, `taskCode`, `编码` |
| 任务名称 | `name`, `taskName`, `名称` |
| Cron 表达式 | `cron`, `Cron`, `cronExpression`, `表达式` |
| 备注 | `remark`, `备注`, `description` |

**示例**：

```csv
code,name,cron,remark
TASK_LOG_ARCHIVE,日志归档任务,0 2 * * *,每天凌晨2点归档
TASK_DB_BACKUP,数据库全量备份,30 2 * * *,每天2:30备份主库
TASK_REPORT_DAILY,每日报表生成,0 0 3 * * ?,每月3号00:00
TASK_CLEAN_TMP,临时文件清理,0 */4 * * *,每4小时清一次
```

**Cron 兼容性**：
- ✅ 标准 5 段（`分 时 日 月 周`）
- ✅ Quartz 6 段（`秒 分 时 日 月 周`）
- ✅ 步长语法 `*/n`、`a-b/n`
- ✅ 枚举 `1,5,10`、范围 `1-30`
- ✅ `?` 通配（Quartz）

> **注意**：热力图只提取**分钟**和**小时**字段，日 / 月 / 周 / 年字段会被忽略——这是有意的简化设计，因为 JobSight 关注的是"一天内的时分分布"，不是"哪天执行"。

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:5173

# 3. 构建生产版本
npm run build

# 4. 本地预览构建产物
npm run preview
```

## 🏗️ 项目结构

```
JobSight/
├── public/
│   ├── favicon.svg           # 绿色闪电图标
│   └── test-tasks-db.csv     # 42 条模拟数据库导出（含 2 条非法 Cron）
├── src/
│   ├── components/
│   │   ├── FileUploader.vue   # CSV 导入（n-upload + clear 防状态残留）
│   │   ├── HeatmapChart.vue   # 热力图核心（ECharts heatmap）
│   │   ├── TopNPanel.vue      # 最高负载排行榜（默认收起）
│   │   ├── TaskList.vue       # 任务列表（表格 + 搜索 + 分页 + 非法高亮）
│   │   └── TaskDetailModal.vue # 点击弹窗看某分钟执行的全部任务
│   ├── utils/
│   │   ├── cronParser.ts      # Cron 解析器（cron-parser 校验 + 手动字段展开）
│   │   ├── fileParser.ts      # papaparse 封装，CSV → Task[]
│   │   └── statistics.ts     # 构建热力图数据 + 统计概览 + Top N 排序
│   ├── types/index.ts         # Task / HeatmapPoint / StatsOverview 类型定义
│   ├── styles/global.css      # 主题 CSS 变量（深浅模式统一入口）
│   ├── App.vue                # 主布局 + 全局状态
│   └── main.ts
├── index.html
├── .gitignore
└── package.json
```

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3（`<script setup>` + Composition API） |
| 语言 | TypeScript 5.x |
| 构建 | Vite 5.x |
| UI | naive-ui 2.x（n-card / n-data-table / n-upload / n-statistic） |
| 图表 | ECharts 5.x（heatmap + custom 主题重建） |
| 图标 | @vicons/antd |
| Cron 解析 | cron-parser（校验）+ cronstrue（自然语言描述） |
| CSV 解析 | papaparse |

## 🔑 几个值得一提的技术细节

### 为什么热力图重建而不是主题热切换？

ECharts 的内置 `'dark'` 主题是在 `echarts.init(el, 'dark')` 时注入的，包含 axis / title / tooltip 等底层配色，切换主题时必须 `dispose()` + 重新 `init()`，无法像 naive-ui 那样 props 热切换。所以监听 `isDark` 变化时直接重建整个图表实例。

### n-upload 的 `clear()` 防状态残留

naive-ui 的 `n-upload` 在 `:max="1"` 后内部会保留上一次上传状态，导致再次点按钮无反应。解法是在 `handleChange.finally` 里强制调用 `uploadRef.value?.clear()`，无论成功失败都重置内部状态。

### Top N 排行联动热力图

用 ECharts `dispatchAction({ type: 'highlight', dataIndex })` 让热力图自动 hover 到对应格子 + 弹出 tooltip，1.8s 后 `downplay` 恢复。`dataIndex` 不是 `hour * 60 + minute`，因为 Map 转数组时不是全部 1440 格都有数据，必须遍历 series.data 找精确匹配项。

### 深色模式持久化

首次访问无 localStorage 记录时**默认深色**（不是跟随系统），双击 header 闪电图标或 JobSight 标题切换，结果写 `localStorage.jobsight-theme`。

## 📝 License

MIT
