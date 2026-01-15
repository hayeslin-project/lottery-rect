<template>
  <div class="lottery-board">
    <!-- 当前奖项信息 -->
    <div class="current-prize">
      <div class="prize-badge">🎉 {{ currentPrize?.name || '请选择奖项' }}</div>
      <div class="prize-count">
        <span class="count-number">{{ currentPrize?.count || 0 }}</span>
        <span class="count-label">人</span>
      </div>
    </div>

    <!-- 抽奖展示区域 -->
    <div class="lottery-display">
      <!-- 等待开始状态 -->
      <div v-if="!isRunning && !isAnimating" class="waiting-state">
        <div class="waiting-icon">🎲</div>
        <p class="waiting-text">点击"开始抽奖"</p>
        <p class="waiting-hint">准备开始新一期抽奖</p>
      </div>

      <!-- 滚动动画状态 -->
      <div v-else class="rolling-state">
        <div class="rolling-container">
          <div
            v-for="(name, index) in displayNames"
            :key="`${name}-${index}`"
            class="rolling-card"
            :style="getRollingStyle(index)"
          >
            <div class="card-inner">
              <div class="card-front">
                <div class="card-icon">?</div>
              </div>
              <div class="card-back">
                <span class="winner-name">{{ name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="control-buttons">
      <template v-if="!isRunning">
        <button
          v-if="!isAnimating"
          class="btn btn-primary"
          :class="{ disabled: !canStart }"
          :disabled="!canStart"
          @click="startLottery"
        >
          <span class="btn-icon">▶</span>
          <span>开始抽奖</span>
        </button>
        <button
          v-else
          class="btn btn-danger"
          @click="stopLottery"
        >
          <span class="btn-icon">⏸</span>
          <span>停止</span>
        </button>
      </template>
      <div v-else class="confirm-actions">
        <button class="btn btn-secondary" @click="cancelLottery">
          <span>取消</span>
        </button>
        <button
          class="btn btn-success"
          @click="confirmResult"
        >
          <span class="btn-icon">✓</span>
          <span>确认结果</span>
        </button>
      </div>
    </div>

    <!-- 分组抽奖按钮 -->
    <button
      v-if="config.mode === 'group'"
      class="group-lottery-btn"
      :class="{ disabled: !canStartGroupLottery }"
      :disabled="!canStartGroupLottery"
      @click="startGroupLottery"
    >
      <span class="btn-icon">👥</span>
      <span>分组抽奖</span>
    </button>

    <!-- 快速切换奖项 -->
    <div v-if="config.prizes.length > 1" class="prize-selector">
      <button
        v-for="prize in config.prizes"
        :key="prize.id"
        :class="['prize-tag', { active: currentPrizeId === prize.id }]"
        :style="currentPrizeId === prize.id ? { borderColor: prize.color, background: `${prize.color}20` } : {}"
        @click="selectPrize(prize.id)"
      >
        {{ prize.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useLotteryStore } from '@/stores/lottery'
import { createAnimationGenerator } from '@/utils/lottery'

const store = useLotteryStore()
const emit = defineEmits(['result', 'groupResult'])

const currentPrize = computed(() => store.currentPrize)
const currentPrizeId = computed({
  get: () => store.currentPrizeId,
  set: (val) => store.setCurrentPrize(val),
})
const config = computed(() => store.config)
const isRunning = computed(() => store.isRunning)
const isAnimating = computed(() => store.isAnimating)
const participants = computed(() => store.participants)
const winnerIds = computed(() => store.winnerIds)

// 显示的名字列表（用于动画）
const displayNames = ref<string[]>([])
// 动画定时器
let animationTimer: number | null = null
// 临时抽奖结果
const tempWinners = ref<any[]>([])

// 是否可以开始抽奖
const canStart = computed(() => {
  if (!currentPrize.value || participants.value.length === 0) return false
  if (config.value.allowRepeat) return true
  return participants.value.length > winnerIds.value.size
})

// 是否可以开始分组抽奖
const canStartGroupLottery = computed(() => {
  return config.value.mode === 'group' && participants.value.length > 0
})

// 监听中奖名单变化，更新显示
watch(tempWinners, (winners) => {
  displayNames.value = winners.map((w) => w.name || w)
})

function startLottery() {
  if (!currentPrize.value) {
    ElMessage.warning('请先选择奖项')
    return
  }

  const count = currentPrize.value.count
  const excludeIds = config.value.allowRepeat ? new Set<string>() : winnerIds.value
  const candidates = participants.value.filter((p) => !excludeIds.has(p.id))

  if (candidates.length < count) {
    ElMessage.warning(`参与人数不足，还差 ${count - candidates.length} 人`)
    return
  }

  // 初始化显示
  displayNames.value = Array(count).fill('???')
  tempWinners.value = Array(count).fill({})

  // 设置动画状态
  store.isAnimating = true

  // 创建动画生成器
  const generator = createAnimationGenerator(candidates)

  // 开始滚动动画
  animationTimer = window.setInterval(() => {
    for (let i = 0; i < count; i++) {
      const participant = generator()
      displayNames.value[i] = participant.name
      tempWinners.value[i] = participant
    }
  }, 50)

  // 自动抽奖：2.5秒后自动停止并确认结果
  setTimeout(() => {
    autoStopAndConfirm()
  }, 2500)
}

// 自动停止并确认结果
function autoStopAndConfirm() {
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  // 执行真正的抽奖
  const selected = store.drawLottery()

  if (selected.length > 0) {
    displayNames.value = selected.map((p) => p.name)
    tempWinners.value = selected
    store.isAnimating = false

    // 自动确认结果
    store.confirmWinners(tempWinners.value)
    emit('result', tempWinners.value)

    // 清空状态，准备下一轮
    setTimeout(() => {
      displayNames.value = []
      tempWinners.value = []
    }, 100)
  } else {
    ElMessage.error('抽奖失败，请重试')
    store.isAnimating = false
  }
}

function stopLottery() {
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  // 执行真正的抽奖
  const selected = store.drawLottery()

  if (selected.length > 0) {
    displayNames.value = selected.map((p) => p.name)
    tempWinners.value = selected
    store.isRunning = true
    store.isAnimating = false
  } else {
    ElMessage.error('抽奖失败，请重试')
    store.isAnimating = false
  }
}

function cancelLottery() {
  store.isRunning = false
  displayNames.value = []
  tempWinners.value = []
}

function confirmResult() {
  store.confirmWinners(tempWinners.value)
  emit('result', tempWinners.value)

  store.isRunning = false
  displayNames.value = []
  tempWinners.value = []
}

function startGroupLottery() {
  const groupSettings: Record<string, any> = {}

  const enabledDepts = Object.keys(groupSettings).filter(
    (dept) => (window as any).groupSettingsEnabled?.[dept]
  )

  if (enabledDepts.length === 0) {
    ElMessage.warning('请先选择要抽奖的分组')
    return
  }

  const counts = (window as any).groupCounts || {}

  for (const dept of enabledDepts) {
    const deptCounts: any[] = []
    const prizeSettings = counts[dept] || {}

    for (const prize of config.value.prizes) {
      const count = prizeSettings[prize.id] || 0
      if (count > 0) {
        deptCounts.push({
          prizeId: prize.id,
          count,
        })
      }
    }

    if (deptCounts.length > 0) {
      groupSettings[dept] = deptCounts
    }
  }

  if (Object.keys(groupSettings).length === 0) {
    ElMessage.warning('请设置各组抽取人数')
    return
  }

  const results = store.drawGroupLottery(groupSettings)
  emit('groupResult', results)
}

function selectPrize(prizeId: string) {
  store.setCurrentPrize(prizeId)
}

function getRollingStyle(index: number) {
  const delay = index * 0.05
  return {
    animationDelay: `${delay}s`,
  }
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (animationTimer) {
    clearInterval(animationTimer)
  }
})
</script>

<style scoped>
.lottery-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  position: relative;
}

/* 当前奖项 - Cyberpunk */
.current-prize {
  text-align: center;
  margin-bottom: 40px;
}

.prize-badge {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, rgba(0, 255, 249, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%);
  border: 2px solid #00fff9;
  border-radius: 4px;
  font-size: 20px;
  font-weight: 600;
  color: #00fff9;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 30px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
  margin-bottom: 16px;
  animation: prize-glow 2s ease-in-out infinite alternate;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: relative;
}

.prize-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00fff9, transparent);
  animation: scan-line 2s linear infinite;
}

@keyframes scan-line {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes prize-glow {
  from {
    box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
  }
  to {
    box-shadow: 0 0 40px rgba(0, 255, 249, 0.6), 0 0 60px rgba(255, 0, 255, 0.3), inset 0 0 30px rgba(0, 255, 249, 0.2);
  }
}

.prize-count {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.count-number {
  font-size: 56px;
  font-weight: 800;
  background: linear-gradient(180deg, #00fff9 0%, #ff00ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  font-family: 'Orbitron', monospace;
  text-shadow: 0 0 30px rgba(0, 255, 249, 0.5);
  animation: number-flicker 3s infinite;
}

@keyframes number-flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.7; }
  94% { opacity: 1; }
}

.count-label {
  font-size: 16px;
  color: #ff00ff;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
}

/* 抽奖展示区域 */
.lottery-display {
  flex: 1;
  width: 100%;
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.waiting-state {
  text-align: center;
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.waiting-icon {
  font-size: 80px;
  margin-bottom: 24px;
  animation: cyber-bounce 2s infinite;
  filter: drop-shadow(0 0 20px #00fff9);
}

@keyframes cyber-bounce {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
    filter: drop-shadow(0 0 20px #00fff9);
  }
  50% {
    transform: translateY(-15px) rotate(5deg);
    filter: drop-shadow(0 0 30px #ff00ff);
  }
}

.waiting-text {
  font-size: 24px;
  font-weight: 600;
  color: #00fff9;
  margin: 0 0 8px 0;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 3px;
  text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
}

.waiting-hint {
  font-size: 14px;
  color: #8a8a9a;
  margin: 0;
  font-family: 'Share Tech Mono', monospace;
}

/* 滚动状态 - Cyberpunk */
.rolling-state {
  width: 100%;
}

.rolling-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
  padding: 20px;
}

.rolling-card {
  width: 200px;
  height: 140px;
  perspective: 1000px;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.rolling-card:hover .card-inner {
  transform: rotateY(10deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-front {
  background: linear-gradient(135deg, rgba(0, 255, 249, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%);
  border: 2px solid rgba(0, 255, 249, 0.5);
  backdrop-filter: blur(10px);
  animation: card-pulse 1s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
}

@keyframes card-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(0, 255, 249, 0.5), 0 0 50px rgba(255, 0, 255, 0.3), inset 0 0 25px rgba(0, 255, 249, 0.2);
  }
}

.card-icon {
  font-size: 48px;
  color: #00fff9;
  font-family: 'Orbitron', monospace;
  text-shadow: 0 0 20px rgba(0, 255, 249, 0.8);
  animation: icon-glitch 2s infinite;
}

@keyframes icon-glitch {
  0%, 90%, 100% { transform: translate(0); }
  92% { transform: translate(-2px, 2px); color: #ff00ff; }
  94% { transform: translate(2px, -2px); color: #00fff9; }
  96% { transform: translate(-1px, -1px); }
}

.card-back {
  background: linear-gradient(135deg, #0a0a0f 0%, #151520 100%);
  border: 2px solid #ff00ff;
  transform: rotateY(180deg);
  box-shadow: 0 0 40px rgba(255, 0, 255, 0.5), inset 0 0 30px rgba(255, 0, 255, 0.1);
}

.winner-name {
  font-size: 28px;
  font-weight: 700;
  color: #ff00ff;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  text-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
}

/* 控制按钮 - Cyberpunk */
.control-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 40px;
  border: 2px solid;
  border-radius: 4px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn:hover::before {
  left: 100%;
}

.btn:hover:not(.disabled) {
  transform: translateY(-3px);
}

.btn:active:not(.disabled) {
  transform: translateY(-1px);
}

.btn:disabled,
.btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: rgba(0, 255, 249, 0.1);
  border-color: #00fff9;
  color: #00fff9;
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
}

.btn-primary:hover:not(.disabled) {
  box-shadow: 0 0 30px rgba(0, 255, 249, 0.5), 0 0 60px rgba(0, 255, 249, 0.3), inset 0 0 30px rgba(0, 255, 249, 0.2);
  text-shadow: 0 0 10px #00fff9;
}

.btn-danger {
  background: rgba(255, 0, 255, 0.1);
  border-color: #ff00ff;
  color: #ff00ff;
  box-shadow: 0 0 20px rgba(255, 0, 255, 0.3), inset 0 0 20px rgba(255, 0, 255, 0.1);
}

.btn-danger:hover:not(.disabled) {
  box-shadow: 0 0 30px rgba(255, 0, 255, 0.5), 0 0 60px rgba(255, 0, 255, 0.3), inset 0 0 30px rgba(255, 0, 255, 0.2);
  text-shadow: 0 0 10px #ff00ff;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
  color: #8a8a9a;
}

.btn-secondary:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

.btn-success {
  background: rgba(0, 255, 100, 0.1);
  border-color: #00ff64;
  color: #00ff64;
  box-shadow: 0 0 20px rgba(0, 255, 100, 0.3), inset 0 0 20px rgba(0, 255, 100, 0.1);
}

.btn-success:hover:not(.disabled) {
  box-shadow: 0 0 30px rgba(0, 255, 100, 0.5), 0 0 60px rgba(0, 255, 100, 0.3), inset 0 0 30px rgba(0, 255, 100, 0.2);
  text-shadow: 0 0 10px #00ff64;
}

.btn-icon {
  font-size: 20px;
}

.confirm-actions {
  display: flex;
  gap: 16px;
}

/* 分组抽奖按钮 */
.group-lottery-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: 2px solid rgba(0, 255, 249, 0.5);
  border-radius: 4px;
  background: rgba(0, 255, 249, 0.1);
  color: #00fff9;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.group-lottery-btn:hover:not(.disabled) {
  background: rgba(0, 255, 249, 0.2);
  border-color: #00fff9;
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.4);
  text-shadow: 0 0 10px #00fff9;
}

.group-lottery-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 奖项选择器 - Cyberpunk */
.prize-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 24px;
}

.prize-tag {
  padding: 10px 20px;
  border: 2px solid rgba(0, 255, 249, 0.3);
  border-radius: 4px;
  background: rgba(0, 255, 249, 0.05);
  color: #8a8a9a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.prize-tag:hover {
  border-color: #00fff9;
  background: rgba(0, 255, 249, 0.1);
  color: #00fff9;
  transform: translateY(-2px);
  box-shadow: 0 0 15px rgba(0, 255, 249, 0.3);
}

.prize-tag.active {
  color: #00fff9;
  font-weight: 600;
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.4), inset 0 0 15px rgba(0, 255, 249, 0.1);
  text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
}

@media (max-width: 768px) {
  .rolling-card {
    width: 140px;
    height: 100px;
  }

  .winner-name {
    font-size: 20px;
  }

  .btn {
    padding: 14px 28px;
    font-size: 16px;
  }

  .count-number {
    font-size: 40px;
  }

  .prize-badge {
    font-size: 16px;
    padding: 10px 24px;
  }
}
</style>
