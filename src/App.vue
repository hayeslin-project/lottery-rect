<template>
  <div class="app">
    <!-- 粒子背景 -->
    <canvas id="particles" class="particles"></canvas>

    <!-- 顶部导航 -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">🎲</div>
          <h1 class="title">LUCKY DRAW</h1>
        </div>
        <nav class="nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['nav-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.name }}</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main">
      <!-- 名单管理 -->
      <div v-show="activeTab === 'list'" class="panel fade-in">
        <CsvUploader />
      </div>

      <!-- 抽奖设置 -->
      <div v-show="activeTab === 'settings'" class="panel fade-in">
        <SettingsPanel />
      </div>

      <!-- 抽奖区域 -->
      <div v-show="activeTab === 'lottery'" class="panel fade-in lottery-panel">
        <LotteryBoard
          @result="handleResult"
          @group-result="handleGroupResult"
        />
      </div>

      <!-- 中奖名单 -->
      <div v-show="activeTab === 'winners'" class="panel fade-in">
        <WinnerList @view-history="viewHistory" />
      </div>
    </main>

    <!-- 帮助弹窗 -->
    <div v-if="showHelp" class="modal-overlay" @click="showHelp = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>使用说明</h2>
          <button class="close-btn" @click="showHelp = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="help-section">
            <div class="help-icon">📁</div>
            <h3>1. 上传名单</h3>
            <p>点击"名单管理"，上传CSV格式文件。第一行为列名，建议包含：工号、姓名、手机号、部门等字段。</p>
          </div>
          <div class="help-section">
            <div class="help-icon">⚙️</div>
            <h3>2. 配置奖项</h3>
            <p>点击"抽奖设置"，配置奖项名称、抽取人数。支持普通随机、权重抽奖、分组抽奖三种模式。</p>
          </div>
          <div class="help-section">
            <div class="help-icon">🎯</div>
            <h3>3. 开始抽奖</h3>
            <p>选择奖项后，点击"开始抽奖"。名字滚动显示，点击"停止"显示结果，点击"确认"保存。</p>
          </div>
          <div class="help-section">
            <div class="help-icon">📊</div>
            <h3>4. 导出结果</h3>
            <p>在"中奖名单"中查看中奖记录，支持导出为Excel或CSV格式。</p>
          </div>
          <div class="csv-example">
            <h4>CSV文件格式示例：</h4>
            <pre>工号,姓名,手机号,部门,权重
1001,张三,13800138001,技术部,10
1002,李四,13800138002,市场部,5
1003,王五,13800138003,技术部,8</pre>
          </div>
        </div>
        <button class="modal-btn primary" @click="showHelp = false">知道了</button>
      </div>
    </div>

    <!-- 中奖结果弹窗 -->
    <div v-if="showResultDialog" class="modal-overlay">
      <div class="result-modal" @click.stop>
        <button class="result-close-btn" @click="showResultDialog = false">✕</button>
        <div class="result-header">🎉 恭喜中奖 🎉</div>
        <div class="result-body">
          <div v-for="winner in currentResult" :key="winner.id" class="result-card">
            <span class="winner-name">{{ winner.name }}</span>
            <span v-if="winner.department" class="winner-dept">{{ winner.department }}</span>
          </div>
        </div>
        <button class="result-confirm-btn" @click="showResultDialog = false">确定</button>
      </div>
    </div>

    <!-- 分组抽奖结果弹窗 -->
    <div v-if="showGroupResultDialog" class="modal-overlay">
      <div class="result-modal group-modal" @click.stop>
        <button class="result-close-btn" @click="showGroupResultDialog = false">✕</button>
        <div class="result-header">🎉 分组抽奖结果 🎉</div>
        <div class="group-result-body">
          <div
            v-for="group in currentGroupResult"
            :key="group.department"
            class="group-result-item"
          >
            <h4>{{ group.department }}</h4>
            <div class="group-winners">
              <span
                v-for="winner in group.winners"
                :key="winner.participant.id"
                class="group-winner"
              >
                {{ winner.participant.name }}
              </span>
            </div>
          </div>
        </div>
        <button class="result-confirm-btn" @click="showGroupResultDialog = false">确定</button>
      </div>
    </div>

    <!-- 历史记录弹窗 -->
    <div v-if="showHistoryDialog" class="modal-overlay" @click="showHistoryDialog = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>历史记录</h2>
          <button class="close-btn" @click="showHistoryDialog = false">✕</button>
        </div>
        <div class="history-detail">
          <div
            v-for="prize in config.prizes"
            :key="prize.id"
            class="history-prize-group"
          >
            <div
              v-if="historyPrizeWinners[prize.id]?.length > 0"
              class="history-prize-header"
              :style="{ borderColor: prize.color }"
            >
              {{ prize.name }} ({{ historyPrizeWinners[prize.id].length }}人)
            </div>
            <div v-if="historyPrizeWinners[prize.id]?.length > 0" class="history-winners">
              <span
                v-for="winner in historyPrizeWinners[prize.id]"
                :key="winner.participant.id"
                class="history-winner"
              >
                {{ winner.participant.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLotteryStore } from '@/stores/lottery'
import CsvUploader from '@/components/ParticipantList/CsvUploader.vue'
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel.vue'
import LotteryBoard from '@/components/LotteryBoard/LotteryBoard.vue'
import WinnerList from '@/components/WinnerList/WinnerList.vue'

const store = useLotteryStore()

const activeTab = ref('lottery')
const showHelp = ref(false)
const showResultDialog = ref(false)
const showGroupResultDialog = ref(false)
const showHistoryDialog = ref(false)

const tabs = [
  { id: 'list', name: '名单管理', icon: '📋' },
  { id: 'settings', name: '抽奖设置', icon: '⚙️' },
  { id: 'lottery', name: '开始抽奖', icon: '🎲' },
  { id: 'winners', name: '中奖名单', icon: '🏆' },
]

const currentResult = ref<any[]>([])
const currentGroupResult = ref<any[]>([])
const currentHistory = ref<any[] | null>(null)

const config = computed(() => store.config)

// 历史记录按奖项分组
const historyPrizeWinners = computed(() => {
  if (!currentHistory.value) return {}

  const result: Record<string, any[]> = {}

  for (const prize of config.value.prizes) {
    result[prize.id] = currentHistory.value.filter((w) => w.prizeId === prize.id)
  }

  return result
})

function handleResult(winners: any[]) {
  currentResult.value = winners
  showResultDialog.value = true
}

function handleGroupResult(results: any[]) {
  currentGroupResult.value = results
  showGroupResultDialog.value = true
}

function viewHistory(index: number) {
  store.loadFromHistory(index)
  currentHistory.value = [...store.winners]
  showHistoryDialog.value = true
}

// 粒子背景动画
onMounted(() => {
  store.loadFromLocal()
  initParticles()
})

onUnmounted(() => {
  const canvas = document.getElementById('particles') as HTMLCanvasElement
  if (canvas) {
    canvas.remove()
  }
})

function initParticles() {
  const canvas = document.getElementById('particles') as HTMLCanvasElement
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const particles: any[] = []
  const particleCount = 80

  class Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string

    constructor() {
      this.x = Math.random() * canvas.width
      this.y = Math.random() * canvas.height
      this.vx = (Math.random() - 0.5) * 0.5
      this.vy = (Math.random() - 0.5) * 0.5
      this.size = Math.random() * 3 + 1
      this.color = `hsla(${Math.random() * 60 + 250}, 70%, 60%, ${Math.random() * 0.3 + 0.1})`
    }

    update() {
      this.x += this.vx
      this.y += this.vy

      if (this.x < 0 || this.x > canvas.width) this.vx *= -1
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1
    }

    draw() {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      ctx.fillStyle = this.color
      ctx.fill()
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle())
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < particles.length; i++) {
      particles[i].update()
      particles[i].draw()

      // 连线
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 150) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 * (1 - distance / 150)})`
          ctx.lineWidth = 1
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.stroke()
        }
      }
    }

    requestAnimationFrame(animate)
  }

  animate()

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  })
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  overflow-x: hidden;
}

.particles {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.header {
  position: relative;
  z-index: 10;
  background: rgba(15, 15, 26, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%, #f093fb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: 2px;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.nav-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.main {
  position: relative;
  z-index: 10;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
}

.panel {
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lottery-panel {
  min-height: calc(100vh - 200px);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 32px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #9ca3af;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.modal-body {
  margin-bottom: 24px;
}

.help-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.help-icon {
  font-size: 32px;
}

.help-section h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #e2e8f0;
}

.help-section p {
  margin: 0;
  font-size: 14px;
  color: #9ca3af;
  line-height: 1.6;
}

.csv-example {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  margin-top: 24px;
}

.csv-example h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #9ca3af;
}

.csv-example pre {
  margin: 0;
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #a5b4fc;
  overflow-x: auto;
  line-height: 1.8;
}

.modal-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.modal-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

/* Result modal */
.result-modal {
  position: relative;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
  border-radius: 24px;
  padding: 40px;
  text-align: center;
  animation: scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.result-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.result-confirm-btn {
  margin-top: 24px;
  padding: 14px 48px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.result-confirm-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.result-header {
  font-size: 32px;
  font-weight: 700;
  color: white;
  margin-bottom: 32px;
}

.result-body {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
}

.result-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 32px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.winner-name {
  font-size: 36px;
  font-weight: 700;
  color: white;
  margin-bottom: 8px;
}

.winner-dept {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.group-modal {
  max-width: 700px;
}

.group-result-body {
  max-height: 400px;
  overflow-y: auto;
}

.group-result-item {
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.group-result-item h4 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.group-winners {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.group-winner {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 16px;
  font-weight: 500;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* History */
.history-detail {
  max-height: 400px;
  overflow-y: auto;
}

.history-prize-group {
  margin-bottom: 20px;
}

.history-prize-header {
  padding: 12px 16px;
  border-left: 4px solid #667eea;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 12px;
}

.history-winners {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.history-winner {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 14px;
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Scrollbar */
.modal-content::-webkit-scrollbar,
.history-detail::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track,
.history-detail::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb,
.history-detail::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover,
.history-detail::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .nav-btn {
    flex: 1;
    justify-content: center;
    min-width: calc(50% - 4px);
  }

  .result-card {
    padding: 16px 20px;
  }

  .winner-name {
    font-size: 24px;
  }
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
  min-height: 100vh;
}
</style>
