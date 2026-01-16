<template>
  <div class="lottery-board" :class="{ 'lottery-running': isAnimating || isRunning }">
    <!-- 粒子画布 -->
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>

    <!-- 背景特效层 -->
    <div class="effects-layer">
      <div class="lightning-flash" v-if="showFlash"></div>
      <div class="energy-beam" v-if="showEnergyBeam"></div>
    </div>

    <!-- 当前奖项信息 -->
    <div class="current-prize" :class="{ 'prize-pulse': isAnimating }">
      <div class="prize-badge">🎉 {{ currentPrize?.name || '请选择奖项' }}</div>
      <div class="prize-count">
        <span class="count-number">{{ currentPrize?.count || 0 }}</span>
        <span class="count-label">人</span>
      </div>
    </div>

    <!-- 抽奖展示区域 -->
    <div class="lottery-display" :class="{ 'lottery-active': isAnimating }">
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

      <!-- 进度条 -->
      <div v-if="isAnimating" class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="control-buttons" :class="{ 'button-pulse': isAnimating }">
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
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useLotteryStore } from '@/stores/lottery'
import { createAnimationGenerator } from '@/utils/lottery'

const store = useLotteryStore()
const emit = defineEmits(['result', 'groupResult'])

const particleCanvas = ref<HTMLCanvasElement | null>(null)
const animationFrame = ref<number | null>(null)
const progress = ref(0)
const showFlash = ref(false)
const showEnergyBeam = ref(false)

// 动画相关变量
const PARTICLES: Particle[] = []
const PARTICLE_COUNT = 50
const ANIMATION_DURATION = 3000 // 3秒抽奖时间

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  maxLife: number
}

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
// 开始时间
let startTime: number | null = null
// 动画生成器
let animationGenerator: (() => any) | null = null
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

// 粒子系统
function initParticles() {
  if (!particleCanvas.value) return

  const canvas = particleCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  // 清空现有粒子
  PARTICLES.length = 0

  // 创建新粒子
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    PARTICLES.push(createParticle(canvas.width, canvas.height))
  }
}

function createParticle(width: number, height: number): Particle {
  return {
    x: width / 2,
    y: height / 2,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10,
    size: Math.random() * 4 + 2,
    color: `hsl(${Math.random() * 60 + 180}, 100%, 50%)`, // 青色到粉色
    life: 0,
    maxLife: Math.random() * 100 + 100,
  }
}

function updateParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 更新和绘制粒子
  for (let i = PARTICLES.length - 1; i >= 0; i--) {
    const particle = PARTICLES[i]

    // 更新位置
    particle.x += particle.vx
    particle.y += particle.vy
    particle.life++

    // 添加重力
    particle.vy += 0.1

    // 添加摩擦力
    particle.vx *= 0.98
    particle.vy *= 0.98

    // 绘制粒子
    const opacity = 1 - (particle.life / particle.maxLife)
    ctx.globalAlpha = opacity
    ctx.fillStyle = particle.color
    ctx.shadowBlur = 10
    ctx.shadowColor = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()

    // 移除死亡的粒子
    if (particle.life > particle.maxLife) {
      PARTICLES.splice(i, 1)
    }
  }

  // 补充新粒子
  while (PARTICLES.length < PARTICLE_COUNT) {
    PARTICLES.push(createParticle(canvas.width, canvas.height))
  }

  animationFrame.value = requestAnimationFrame(updateParticles)
}

function createExplosion(x: number, y: number, count: number = 30) {
  const canvas = particleCanvas.value
  if (!canvas) return

  for (let i = 0; i < count; i++) {
    PARTICLES.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      size: Math.random() * 6 + 3,
      color: Math.random() > 0.5 ? '#00fff9' : '#ff00ff',
      life: 0,
      maxLife: Math.random() * 50 + 50,
    })
  }
}

// 获取动画速度（基于设置）
function getAnimationSpeed(): number {
  const baseSpeed = 20 // 基础速度（毫秒）

  switch (config.value.autoCompleteSpeed) {
    case 'slow':
      return baseSpeed * 2 // 40ms
    case 'normal':
      return baseSpeed // 20ms
    case 'fast':
      return baseSpeed / 2 // 10ms
    case 'very-fast':
      return baseSpeed / 3 // 约7ms
    default:
      return baseSpeed
  }
}

// 进度动画
function animateProgress(timestamp: number) {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime

  // 如果是自动完成模式，使用设置的时间
  const duration = config.value.enableAutoComplete
    ? config.value.autoCompleteDuration * 1000
    : ANIMATION_DURATION

  progress.value = Math.min((elapsed / duration) * 100, 100)

  // 计算当前动画速度（先快后慢）
  const speedFactor = 1 - (progress.value / 100) * 0.7
  const animationSpeed = getAnimationSpeed() * speedFactor

  if (animationTimer) {
    clearInterval(animationTimer)
  }

  // 根据进度调整动画速度
  if (progress.value > 80) {
    // 最后20%，速度显著减慢
    animationTimer = window.setInterval(() => {
      if (animationGenerator) {
        for (let i = 0; i < tempWinners.value.length; i++) {
          const participant = animationGenerator()
          displayNames.value[i] = participant.name
          tempWinners.value[i] = participant
        }
      }
    }, animationSpeed * 2)
  } else if (progress.value > 60) {
    // 中间阶段，中等速度
    animationTimer = window.setInterval(() => {
      if (animationGenerator) {
        for (let i = 0; i < tempWinners.value.length; i++) {
          const participant = animationGenerator()
          displayNames.value[i] = participant.name
          tempWinners.value[i] = participant
        }
      }
    }, animationSpeed * 1.5)
  } else {
    // 开始阶段，最快速度
    animationTimer = window.setInterval(() => {
      if (animationGenerator) {
        for (let i = 0; i < tempWinners.value.length; i++) {
          const participant = animationGenerator()
          displayNames.value[i] = participant.name
          tempWinners.value[i] = participant
        }
      }
    }, animationSpeed)
  }

  if (progress.value < 100) {
    animationFrame.value = requestAnimationFrame(animateProgress)
  }
}

// 特效函数
function triggerFlash() {
  showFlash.value = true
  setTimeout(() => {
    showFlash.value = false
  }, 100)
}

function triggerEnergyBeam() {
  showEnergyBeam.value = true
  setTimeout(() => {
    showEnergyBeam.value = false
  }, 2000)
}

function triggerWinEffect() {
  const canvas = particleCanvas.value
  if (!canvas) return

  // 创建庆祝爆炸效果
  createExplosion(canvas.width / 2, canvas.height / 2, 50)

  // 触发闪光
  triggerFlash()

  // 触发震动（如果设备支持）
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200])
  }
}

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
  store.isRunning = true
  progress.value = 0
  startTime = null

  // 创建动画生成器
  animationGenerator = createAnimationGenerator(candidates)

  // 开始粒子动画
  initParticles()
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
  animationFrame.value = requestAnimationFrame(updateParticles)

  // 开始进度动画
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
  animationFrame.value = requestAnimationFrame(animateProgress)

  // 触发开始特效
  triggerEnergyBeam()
  createExplosion(particleCanvas.value?.offsetWidth / 2 || 400, 100, 20)

  // 如果开启了自动完成，设置定时器
  if (config.value.enableAutoComplete) {
    const duration = config.value.autoCompleteDuration * 1000 // 转换为毫秒

    // 如果是平滑停止模式，提前开始减速
    if (config.value.autoCompleteStopMode === 'smooth') {
      setTimeout(() => {
        if (store.isAnimating) {
          // 开始缓慢减速
          animateSmoothDeceleration()
        }
      }, duration * 0.7) // 在70%时间时开始减速
    }

    // 设置自动停止
    setTimeout(() => {
      if (store.isAnimating) {
        stopLotteryWithAutoComplete()
      }
    }, duration)
  }
}

// 自动停止并确认结果
function autoStopAndConfirm() {
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = null
  }

  // 执行真正的抽奖
  const selected = store.drawLottery()

  if (selected.length > 0) {
    displayNames.value = selected.map((p) => p.name)
    tempWinners.value = selected
    store.isAnimating = false

    // 触发中奖特效
    triggerWinEffect()

    // 自动确认结果
    setTimeout(() => {
      store.confirmWinners(tempWinners.value)
      emit('result', tempWinners.value)

      // 清空状态，准备下一轮
      setTimeout(() => {
        displayNames.value = []
        tempWinners.value = []
        progress.value = 0

        // 清理粒子
        PARTICLES.length = 0
      }, 1000)
    }, 1000)
  } else {
    ElMessage.error('抽奖失败，请重试')
    store.isAnimating = false
    PARTICLES.length = 0
  }
}

// 平滑减速动画
function animateSmoothDeceleration() {
  if (!animationGenerator) return

  const startTime = Date.now()
  const duration = config.value.autoCompleteDuration * 300 // 减速时间（毫秒）
  const baseSpeed = getAnimationSpeed()

  // 停止当前的动画定时器
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  const decelerate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // 使用缓出函数计算当前速度（先慢后快再慢）
    const easeOut = 1 - Math.pow(1 - progress, 3)
    const currentSpeed = baseSpeed * (1 + Math.sin(progress * Math.PI) * 2)

    animationTimer = window.setInterval(() => {
      if (animationGenerator) {
        for (let i = 0; i < tempWinners.value.length; i++) {
          const participant = animationGenerator()
          displayNames.value[i] = participant.name
          tempWinners.value[i] = participant
        }
      }
    }, currentSpeed)

    if (progress < 1 && store.isAnimating) {
      requestAnimationFrame(decelerate)
    } else {
      // 减速完成，可以停止
      stopLotteryWithAutoComplete()
    }
  }

  decelerate()
}

// 带自动停止的抽奖停止
function stopLotteryWithAutoComplete() {
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = null
  }

  // 执行真正的抽奖
  const selected = store.drawLottery()

  if (selected.length > 0) {
    displayNames.value = selected.map((p) => p.name)
    tempWinners.value = selected
    store.isRunning = true
    store.isAnimating = false

    // 根据停止模式触发不同的特效
    switch (config.value.autoCompleteStopMode) {
      case 'instant':
        // 立即停止，无特效
        break
      case 'dramatic':
        // 戏剧性停止 - 多重特效
        triggerWinEffect()
        createExplosion(
          particleCanvas.value?.offsetWidth / 2 || 400,
          particleCanvas.value?.offsetHeight / 2 || 300,
          80
        )
        // 强闪光
        setTimeout(() => {
          showFlash.value = true
          setTimeout(() => {
            showFlash.value = false
          }, 300)
        }, 100)
        // 震动
        if (navigator.vibrate) {
          navigator.vibrate([200, 50, 200, 50, 200])
        }
        break
      case 'smooth':
      default:
        // 平滑停止 - 标准中奖特效
        triggerWinEffect()
        break
    }

    // 自动确认结果
    setTimeout(() => {
      store.confirmWinners(tempWinners.value)
      emit('result', tempWinners.value)

      // 清空状态，准备下一轮
      setTimeout(() => {
        displayNames.value = []
        tempWinners.value = []
        progress.value = 0

        // 清理粒子
        PARTICLES.length = 0
      }, 1000)
    }, 1000)
  } else {
    ElMessage.error('抽奖失败，请重试')
    store.isAnimating = false
    PARTICLES.length = 0
  }
}

function cancelLottery() {
  store.isRunning = false
  displayNames.value = []
  tempWinners.value = []
  progress.value = 0

  // 清理动画
  if (animationTimer) {
    clearInterval(animationTimer)
    animationTimer = null
  }

  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = null
  }

  // 清理粒子
  PARTICLES.length = 0
}

function confirmResult() {
  store.confirmWinners(tempWinners.value)
  emit('result', tempWinners.value)

  store.isRunning = false
  displayNames.value = []
  tempWinners.value = []
  progress.value = 0

  // 清理粒子
  PARTICLES.length = 0
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
  const delay = index * 0.02 // 减少延迟，让动画更快
  return {
    animationDelay: `${delay}s`,
    animationDuration: '0.5s',
  }
}

// 组件挂载时初始化
onMounted(() => {
  initParticles()
  animationFrame.value = requestAnimationFrame(updateParticles)
})

// 组件卸载时清理
onUnmounted(() => {
  if (animationTimer) {
    clearInterval(animationTimer)
  }
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
  PARTICLES.length = 0
})
</script>

<style scoped>
.lottery-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  position: relative;
  transition: all 0.3s;
}

.lottery-board.lottery-running {
  animation: board-pulse 0.5s ease-in-out infinite;
}

/* 粒子画布 */
.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

/* 背景特效层 */
.effects-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.lightning-flash {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  animation: flash 0.1s ease-out;
  z-index: 3;
}

@keyframes flash {
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

.energy-beam {
  position: absolute;
  top: 0;
  left: 50%;
  width: 100px;
  height: 100%;
  transform: translateX(-50%);
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(0, 255, 249, 0.3) 20%,
    rgba(0, 255, 249, 0.6) 50%,
    rgba(0, 255, 249, 0.3) 80%,
    transparent 100%
  );
  filter: blur(20px);
  animation: beam-scan 2s ease-in-out infinite;
  z-index: 2;
}

@keyframes beam-scan {
  0%, 100% { transform: translateX(-50%) scaleX(0.5); opacity: 0; }
  50% { transform: translateX(-50%) scaleX(1); opacity: 1; }
}

/* 进度条 */
.progress-bar {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 2px;
  overflow: hidden;
  z-index: 3;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00fff9, #ff00ff);
  width: 0%;
  transition: width 0.1s linear;
  box-shadow: 0 0 10px rgba(0, 255, 249, 0.8);
  animation: progress-glow 0.5s ease-in-out infinite alternate;
}

@keyframes progress-glow {
  from { box-shadow: 0 0 10px rgba(0, 255, 249, 0.8); }
  to { box-shadow: 0 0 20px rgba(255, 0, 255, 0.8); }
}

/* 当前奖项 - Cyberpunk */
.current-prize {
  text-align: center;
  margin-bottom: 40px;
  transition: all 0.3s;
}

.current-prize.prize-pulse {
  animation: prize-pulse 0.8s ease-in-out infinite;
}

@keyframes prize-pulse {
  0%, 100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.05);
    filter: brightness(1.3);
  }
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
  transition: all 0.3s;
}

.count-number.lottery-active {
  animation: number-flicker 0.1s infinite, number-bounce 0.5s ease-in-out infinite;
}

@keyframes number-flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.7; }
  94% { opacity: 1; }
}

@keyframes number-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
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
  position: relative;
  z-index: 3;
}

.lottery-display.lottery-active {
  animation: display-pulse 0.3s ease-in-out infinite;
}

@keyframes display-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
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
  animation: shake 0.1s infinite;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
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
  animation: card-float 2s ease-in-out infinite;
}

.rolling-card:nth-child(2) {
  animation-delay: 0.2s;
}

.rolling-card:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.3s;
  transform-style: preserve-3d;
}

.rolling-card:hover .card-inner {
  transform: rotateY(10deg) scale(1.05);
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
  overflow: hidden;
}

.card-front {
  background: linear-gradient(135deg, rgba(0, 255, 249, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%);
  border: 2px solid rgba(0, 255, 249, 0.5);
  backdrop-filter: blur(10px);
  animation: card-pulse 0.5s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
  position: relative;
}

.card-front::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(0, 255, 249, 0.3) 50%,
    transparent 70%
  );
  transform: rotate(45deg) translate(-100%, -100%);
  transition: transform 0.6s;
}

.rolling-card:hover .card-front::before {
  transform: rotate(45deg) translate(100%, 100%);
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
  0%, 90%, 100% {
    transform: translate(0);
    text-shadow: 0 0 20px rgba(0, 255, 249, 0.8);
  }
  92% {
    transform: translate(-2px, 2px);
    color: #ff00ff;
    text-shadow: -2px 2px 0 #ff00ff;
  }
  94% {
    transform: translate(2px, -2px);
    color: #00fff9;
    text-shadow: 2px -2px 0 #00fff9;
  }
  96% {
    transform: translate(-1px, -1px);
    text-shadow: 0 0 20px rgba(0, 255, 249, 0.8);
  }
}

.card-back {
  background: linear-gradient(135deg, #0a0a0f 0%, #151520 100%);
  border: 2px solid #ff00ff;
  transform: rotateY(180deg);
  box-shadow: 0 0 40px rgba(255, 0, 255, 0.5), inset 0 0 30px rgba(255, 0, 255, 0.1);
  position: relative;
  animation: card-back-glow 2s ease-in-out infinite alternate;
}

@keyframes card-back-glow {
  from {
    box-shadow: 0 0 40px rgba(255, 0, 255, 0.5), inset 0 0 30px rgba(255, 0, 255, 0.1);
  }
  to {
    box-shadow: 0 0 60px rgba(255, 0, 255, 0.8), 0 0 80px rgba(0, 255, 249, 0.3), inset 0 0 40px rgba(255, 0, 255, 0.2);
  }
}

.winner-name {
  font-size: 28px;
  font-weight: 700;
  color: #ff00ff;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  text-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
  animation: winner-glow 1s ease-in-out infinite alternate;
}

@keyframes winner-glow {
  from {
    text-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
  }
  to {
    text-shadow: 0 0 25px rgba(255, 0, 255, 1), 0 0 35px rgba(0, 255, 249, 0.5);
  }
}

/* 控制按钮 - Cyberpunk */
.control-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  z-index: 3;
}

.control-buttons.button-pulse .btn-primary {
  animation: button-pulse 0.5s ease-in-out infinite;
}

@keyframes button-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(0, 255, 249, 0.5), 0 0 60px rgba(0, 255, 249, 0.3), inset 0 0 30px rgba(0, 255, 249, 0.2);
  }
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
  transform-origin: center;
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
  animation: btn-primary-glow 3s ease-in-out infinite;
}

@keyframes btn-primary-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 20px rgba(0, 255, 249, 0.1); }
  50% { box-shadow: 0 0 30px rgba(0, 255, 249, 0.5), 0 0 40px rgba(255, 0, 255, 0.2), inset 0 0 25px rgba(0, 255, 249, 0.2); }
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
  z-index: 3;
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
  z-index: 3;
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

/* 添加整体震动动画 */
@keyframes board-vibrate {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-2px, -2px); }
  20% { transform: translate(2px, -2px); }
  30% { transform: translate(-2px, 2px); }
  40% { transform: translate(2px, 2px); }
  50% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, -2px); }
  70% { transform: translate(-2px, 2px); }
  80% { transform: translate(2px, 2px); }
  90% { transform: translate(-1px, -1px); }
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

  .progress-bar {
    width: 200px;
  }
}
</style>
