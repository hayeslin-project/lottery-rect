# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Vue 3 + TypeScript 的抽奖程序，支持从 CSV 文件导入参与人员数据，并提供多种抽奖模式（普通随机、权重、分组）。

## 常用命令

```bash
# 启动开发服务器（端口 3000，自动打开浏览器）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 类型检查（使用 vue-tsc）
npx vue-tsc --noEmit
```

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **UI 组件库**: Element Plus
- **状态管理**: Pinia
- **构建工具**: Vite
- **语言**: TypeScript
- **数据处理**: PapaParse (CSV), XLSX (Excel)

## 项目结构

```
src/
├── components/          # 组件目录
│   ├── LotteryBoard/    # 抽奖板组件（抽奖动画和控制）
│   ├── SettingsPanel/   # 设置面板（奖项配置、抽奖模式）
│   ├── WinnerList/      # 中奖名单（查看、导出）
│   ├── ParticipantList/ # 参与者列表
│   └── common/          # 通用组件（目前为空）
├── stores/
│   └── lottery.ts       # Pinia 状态管理（核心业务逻辑）
├── utils/
│   ├── csv.ts           # CSV 文件解析和导出
│   └── lottery.ts       # 抽奖算法（普通/权重/分组）
└── App.vue              # 根组件（粒子背景、标签页切换）
```

## 核心架构

### 状态管理 (Pinia Store)

`src/stores/lottery.ts` 是整个应用的核心状态管理，包含：

- **participants**: 参与人员列表
- **winners**: 当前中奖记录
- **history**: 历史记录数组（每次保存结果后的快照）
- **config**: 抽奖配置（模式、奖项、是否允许重复、语音播报）
- **csvData/columnMapping**: CSV 原始数据和列映射配置

数据持久化使用 localStorage，通过 `saveToLocal()` / `loadFromLocal()` 实现。

### 抽奖模式

1. **normal** - 普通随机抽奖：等概率随机抽取
2. **weighted** - 权重抽奖：根据 `Participant.weight` 字段按权重抽取
3. **group** - 分组抽奖：按部门分组，每组独立设置奖项和数量

### 数据流程

1. 用户上传 CSV 文件 → `CsvUploader` 组件解析 → `setCsvData()`
2. 用户配置列映射（如哪列是姓名、哪列是部门）→ `setColumnMapping()`
3. 根据映射转换数据 → `setParticipants()`
4. 用户在 `SettingsPanel` 配置奖项和抽奖模式
5. 用户在 `LotteryBoard` 点击抽奖 → `drawLottery()` 执行抽奖算法
6. 确认结果 → `confirmWinners()` 保存到 winners 列表
7. 可选：`saveToHistory()` 将当前结果保存到历史记录

### 路径别名

- `@/` 指向 `src/` 目录（在 vite.config.ts 中配置）

## 类型定义

核心类型定义在 `src/utils/csv.ts` 和 `src/utils/lottery.ts`：

```typescript
// csv.ts
interface Participant {
  id: string
  name: string
  phone?: string
  department?: string
  weight?: number
}

// lottery.ts
interface Prize {
  id: string
  name: string
  count: number
  color?: string
}

interface Winner {
  participant: Participant
  prizeId: string
  prizeName: string
  timestamp: number
}

type LotteryMode = 'normal' | 'weighted' | 'group'
```

## 语音播报

使用 Web Speech API (`window.speechSynthesis`) 实现语音播报，在 `src/utils/lottery.ts` 的 `speak()` 函数中实现。需要在抽奖配置中开启 `enableVoice`。
