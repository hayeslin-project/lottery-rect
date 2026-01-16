import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Participant } from '@/utils/csv'
import type { Prize, Winner, LotteryConfig, LotteryMode } from '@/utils/lottery'
import { normalLottery, weightedLottery, groupLottery, speak } from '@/utils/lottery'

export const useLotteryStore = defineStore('lottery', () => {
  // 参与人员列表
  const participants = ref<Participant[]>([])

  // 中奖记录
  const winners = ref<Winner[]>([])

  // 历史记录
  const history = ref<Winner[][]>([])

  // CSV 原始数据
  const csvData = ref<string[][]>([])

  // CSV 列名
  const csvHeaders = ref<string[]>([])

  // 列映射配置
  const columnMapping = ref({
    id: '',
    name: '',
    phone: '',
    department: '',
    weight: '',
  })

  // 分组抽奖设置
  const groupSettingsEnabled = ref<Record<string, boolean>>({})
  const groupCounts = ref<Record<string, Record<string, number>>>({})

  // 抽奖配置
  const config = ref<LotteryConfig>({
    mode: 'normal',
    prizes: [
      { id: 'prize1', name: '一等奖', count: 1, color: '#f56c6c' },
      { id: 'prize2', name: '二等奖', count: 5, color: '#e6a23c' },
      { id: 'prize3', name: '三等奖', count: 20, color: '#409eff' },
    ],
    allowRepeat: false,
    enableVoice: false,
  })

  // 当前选择的奖项
  const currentPrizeId = ref<string>('prize1')

  // 抽奖状态
  const isRunning = ref(false)
  const isAnimating = ref(false)

  // 当前抽奖动画显示的名字
  const animationNames = ref<string[]>([])

  // 计算属性
  const currentPrize = computed(() => {
    return config.value.prizes.find((p) => p.id === currentPrizeId.value)
  })

  const winnerIds = computed(() => new Set(winners.value.map((w) => w.participant.id)))

  const departments = computed(() => {
    const depts = new Set(participants.value.map((p) => p.department || '未分组'))
    return Array.from(depts).filter((d) => d !== '未分组')
  })

  const stats = computed(() => ({
    total: participants.value.length,
    winnerCount: winners.value.length,
    remainingCount: participants.value.length - winners.value.length,
  }))

  // 按奖项统计中奖人数
  const prizeStats = computed(() => {
    const result: { [prizeId: string]: number } = {}
    for (const prize of config.value.prizes) {
      result[prize.id] = winners.value.filter((w) => w.prizeId === prize.id).length
    }
    return result
  })

  // Actions
  function setParticipants(data: Participant[]) {
    participants.value = data
  }

  function setCsvData(data: string[][]) {
    csvData.value = data
    csvHeaders.value = data[0] || []
  }

  function setColumnMapping(mapping: typeof columnMapping.value) {
    columnMapping.value = { ...mapping }
  }

  function addPrize(prize: Prize) {
    config.value.prizes.push(prize)
  }

  function updatePrize(prizeId: string, updates: Partial<Prize>) {
    const index = config.value.prizes.findIndex((p) => p.id === prizeId)
    if (index >= 0) {
      config.value.prizes[index] = { ...config.value.prizes[index], ...updates }
    }
  }

  function removePrize(prizeId: string) {
    config.value.prizes = config.value.prizes.filter((p) => p.id !== prizeId)
  }

  function updateConfig(updates: Partial<LotteryConfig>) {
    config.value = { ...config.value, ...updates }
  }

  function setCurrentPrize(prizeId: string) {
    currentPrizeId.value = prizeId
  }

  /**
   * 执行抽奖
   */
  function drawLottery(): Participant[] {
    const prize = currentPrize.value
    if (!prize) return []

    const count = prize.count
    const excludeIds = config.value.allowRepeat ? new Set<string>() : winnerIds.value

    let selected: Participant[] = []

    switch (config.value.mode) {
      case 'normal':
        selected = normalLottery(participants.value, count, excludeIds)
        break
      case 'weighted':
        selected = weightedLottery(participants.value, count, excludeIds)
        break
      case 'group':
        // 分组抽奖在 separateDrawGroup 中处理
        break
    }

    return selected
  }

  /**
   * 确认中奖结果
   */
  function confirmWinners(selectedParticipants: Participant[]): Winner[] {
    const prize = currentPrize.value
    if (!prize) return []

    const newWinners: Winner[] = selectedParticipants.map((p) => ({
      participant: p,
      prizeId: prize.id,
      prizeName: prize.name,
      timestamp: Date.now(),
    }))

    winners.value = [...winners.value, ...newWinners]

    // 语音播报
    if (config.value.enableVoice) {
      const names = newWinners.map((w) => w.participant.name).join('、')
      speak(`恭喜${prize.name}获得者：${names}`)
    }

    return newWinners
  }

  /**
   * 保存当前结果到历史
   */
  function saveToHistory() {
    if (winners.value.length > 0) {
      history.value.push([...winners.value])
      winners.value = []
    }
  }

  /**
   * 加载历史记录
   */
  function loadFromHistory(index: number) {
    winners.value = [...history.value[index]]
  }

  /**
   * 清除当前结果
   */
  function clearCurrent() {
    winners.value = []
  }

  /**
   * 重置所有状态
   */
  function resetAll() {
    winners.value = []
    history.value = []
    isRunning.value = false
    isAnimating.value = false
    animationNames.value = []
  }

  /**
   * 删除中奖记录
   */
  function removeWinner(winnerId: string) {
    winners.value = winners.value.filter((w) => w.participant.id !== winnerId)
  }

  /**
   * 分组抽奖
   */
  function drawGroupLottery(
    groupSettings: { [department: string]: { prizeId: string; count: number }[] }
  ) {
    const excludeIds = config.value.allowRepeat ? new Set<string>() : winnerIds.value
    const results = groupLottery(participants.value, groupSettings, excludeIds)

    // 将结果合并到 winners
    for (const group of results) {
      for (const winner of group.winners) {
        const prize = config.value.prizes.find((p) => p.id === winner.prizeId)
        if (prize) {
          winner.prizeName = prize.name
        }
      }
      winners.value.push(...group.winners)
    }

    // 语音播报
    if (config.value.enableVoice) {
      const allNames = results.flatMap((g) =>
        g.winners.map((w) => `${w.participant.name}`)
      )
      if (allNames.length > 0) {
        speak(`恭喜获奖者：${allNames.join('、')}`)
      }
    }

    return results
  }

  /**
   * 本地存储操作
   */
  function saveToLocal() {
    const data = {
      participants: participants.value,
      config: config.value,
    }
    localStorage.setItem('lottery-data', JSON.stringify(data))
  }

  function loadFromLocal() {
    const saved = localStorage.getItem('lottery-data')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        participants.value = data.participants || []
        if (data.config) {
          config.value = { ...config.value, ...data.config }
        }
      } catch (e) {
        console.error('Failed to load from local storage:', e)
      }
    }
  }

  function clearLocal() {
    localStorage.removeItem('lottery-data')
  }

  return {
    // State
    participants,
    winners,
    history,
    csvData,
    csvHeaders,
    columnMapping,
    groupSettingsEnabled,
    groupCounts,
    config,
    currentPrizeId,
    isRunning,
    isAnimating,
    animationNames,

    // Computed
    currentPrize,
    winnerIds,
    departments,
    stats,
    prizeStats,

    // Actions
    setParticipants,
    setCsvData,
    setColumnMapping,
    addPrize,
    updatePrize,
    removePrize,
    updateConfig,
    setCurrentPrize,
    drawLottery,
    confirmWinners,
    saveToHistory,
    loadFromHistory,
    clearCurrent,
    resetAll,
    removeWinner,
    drawGroupLottery,
    saveToLocal,
    loadFromLocal,
    clearLocal,
  }
})
