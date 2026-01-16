import type { Participant } from './csv'

/**
 * 奖项接口
 */
export interface Prize {
  id: string
  name: string
  count: number
  color?: string
}

/**
 * 中奖记录接口
 */
export interface Winner {
  participant: Participant
  prizeId: string
  prizeName: string
  timestamp: number
}

/**
 * 抽奖模式
 */
export type LotteryMode = 'normal' | 'weighted' | 'group'

/**
 * 自动完成停止方式
 */
export type AutoCompleteStopMode = 'smooth' | 'instant' | 'dramatic'

/**
 * 自动完成速度
 */
export type AutoCompleteSpeed = 'slow' | 'normal' | 'fast' | 'very-fast'

/**
 * 抽奖配置接口
 */
export interface LotteryConfig {
  mode: LotteryMode
  prizes: Prize[]
  allowRepeat: boolean
  enableVoice: boolean
  enableAutoComplete: boolean
  autoCompleteDuration: number
  autoCompleteSpeed: AutoCompleteSpeed
  autoCompleteStopMode: AutoCompleteStopMode
  groupSettings?: { [department: string]: { prizeId: string; count: number }[] }
}

/**
 * 普通随机抽奖
 * @param participants 参与人员列表
 * @param count 抽取数量
 * @param excludeIds 排除的人员ID列表
 */
export function normalLottery(
  participants: Participant[],
  count: number,
  excludeIds: Set<string> = new Set()
): Participant[] {
  const candidates = participants.filter((p) => !excludeIds.has(p.id))
  if (candidates.length === 0) return []

  const winners: Participant[] = []
  const indices = new Set<number>()

  while (winners.length < count && winners.length < candidates.length) {
    const randomIndex = Math.floor(Math.random() * candidates.length)
    if (!indices.has(randomIndex)) {
      indices.add(randomIndex)
      winners.push(candidates[randomIndex])
    }
  }

  return winners
}

/**
 * 权重抽奖
 * @param participants 参与人员列表
 * @param count 抽取数量
 * @param excludeIds 排除的人员ID列表
 */
export function weightedLottery(
  participants: Participant[],
  count: number,
  excludeIds: Set<string> = new Set()
): Participant[] {
  const candidates = participants.filter((p) => !excludeIds.has(p.id))
  if (candidates.length === 0) return []

  const winners: Participant[] = []
  let remainingIndices = candidates.map((_, i) => i)
  let remainingWeights = candidates.map((p) => p.weight || 1)
  let totalWeight = remainingWeights.reduce((sum, w) => sum + w, 0)

  while (winners.length < count && remainingIndices.length > 0) {
    let random = Math.random() * totalWeight
    let selectedIndex = 0

    for (let i = 0; i < remainingWeights.length; i++) {
      random -= remainingWeights[i]
      if (random <= 0) {
        selectedIndex = i
        break
      }
    }

    const winnerIndex = remainingIndices[selectedIndex]
    winners.push(candidates[winnerIndex])

    // 移除已中奖的人
    remainingIndices.splice(selectedIndex, 1)
    const removedWeight = remainingWeights.splice(selectedIndex, 1)[0]
    totalWeight -= removedWeight
  }

  return winners
}

/**
 * 分组抽奖
 * @param participants 参与人员列表
 * @param groupSettings 分组设置 { 部门名: [{ prizeId, count }] }
 * @param excludeIds 排除的人员ID列表
 */
export function groupLottery(
  participants: Participant[],
  groupSettings: { [department: string]: { prizeId: string; count: number }[] },
  excludeIds: Set<string> = new Set()
): { department: string; winners: Winner[] }[] {
  const result: { department: string; winners: Winner[] }[] = []

  for (const [department, settings] of Object.entries(groupSettings)) {
    const departmentParticipants = participants.filter(
      (p) => (p.department || '未分组') === department && !excludeIds.has(p.id)
    )

    const groupWinners: Winner[] = []

    for (const setting of settings) {
      const count = setting.count
      const candidates = departmentParticipants.filter(
        (p) => !groupWinners.some((w) => w.participant.id === p.id)
      )

      let selected: Participant[] = []
      if (count === 1) {
        // 单个抽取，使用随机
        selected = normalLottery(candidates, 1)
      } else {
        selected = normalLottery(candidates, count)
      }

      groupWinners.push(
        ...selected.map((p) => ({
          participant: p,
          prizeId: setting.prizeId,
          prizeName: '', // 需要外部映射
          timestamp: Date.now(),
        }))
      )
    }

    if (groupWinners.length > 0) {
      result.push({ department, winners: groupWinners })
    }
  }

  return result
}

/**
 * Fisher-Yates 洗牌算法
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 用于抽奖动画的随机名字生成器
 */
export function createAnimationGenerator(participants: Participant[]): () => Participant {
  let index = 0
  const shuffled = shuffle([...participants])

  return () => {
    const participant = shuffled[index % shuffled.length]
    index++
    return participant
  }
}

/**
 * 语音播报
 */
export function speak(text: string): void {
  if (!window.speechSynthesis) return

  // 停止当前正在播放的语音
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}
