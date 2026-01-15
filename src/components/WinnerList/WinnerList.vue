<template>
  <div class="winner-list">
    <div class="header">
      <h3>🏆 中奖名单 ({{ winners.length }}人)</h3>
      <div class="actions">
        <button class="action-btn" @click="exportToExcel">
          <span>📊</span>
          <span>导出 Excel</span>
        </button>
        <button class="action-btn" @click="exportToCsv">
          <span>📄</span>
          <span>导出 CSV</span>
        </button>
        <button class="action-btn danger" @click="clearAll">
          <span>🗑️</span>
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- 按奖项分组显示 -->
    <div v-if="winners.length > 0" class="winner-content">
      <div
        v-for="prize in config.prizes"
        :key="prize.id"
        class="prize-group"
      >
        <div
          v-if="prizeWinners[prize.id]?.length > 0"
          class="prize-group-header"
          :style="{ borderColor: prize.color, background: `${prize.color}20` }"
        >
          <span class="prize-icon">🎉</span>
          <span class="prize-title">{{ prize.name }}</span>
          <span class="prize-count">{{ prizeWinners[prize.id].length }}人</span>
        </div>

        <div
          v-if="prizeWinners[prize.id]?.length > 0"
          class="winner-cards"
        >
          <div
            v-for="winner in prizeWinners[prize.id]"
            :key="winner.participant.id"
            class="winner-card"
            :style="{ borderLeftColor: prize.color }"
          >
            <div class="card-header">
              <div class="winner-avatar">{{ winner.participant.name?.[0] || '?' }}</div>
              <span class="winner-name">{{ winner.participant.name }}</span>
              <button class="remove-btn" @click="removeWinner(winner.participant.id)">✕</button>
            </div>
            <div class="card-body">
              <div v-if="winner.participant.id" class="card-info">
                <span class="info-icon">🆔</span>
                <span>{{ winner.participant.id }}</span>
              </div>
              <div v-if="winner.participant.phone" class="card-info">
                <span class="info-icon">📱</span>
                <span>{{ winner.participant.phone }}</span>
              </div>
              <div v-if="winner.participant.department" class="card-info">
                <span class="info-icon">🏢</span>
                <span>{{ winner.participant.department }}</span>
              </div>
              <div class="card-info time">
                <span class="info-icon">🕐</span>
                <span>{{ formatTime(winner.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📭</div>
      <p class="empty-text">暂无中奖记录</p>
      <p class="empty-hint">开始抽奖后，中奖名单将显示在这里</p>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" class="history-section">
      <h4>📜 历史记录</h4>
      <div class="history-list">
        <div
          v-for="(record, index) in history"
          :key="index"
          class="history-item"
        >
          <div class="history-info">
            <span class="history-count">共 {{ record.length }} 人</span>
            <span class="history-time">{{ formatHistoryTime(record) }}</span>
          </div>
          <button class="view-btn" @click="viewHistory(index)">
            查看
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLotteryStore } from '@/stores/lottery'
import * as XLSX from 'xlsx'
import { exportToCSV } from '@/utils/csv'

const store = useLotteryStore()
const emit = defineEmits(['viewHistory'])

const winners = computed(() => store.winners)
const history = computed(() => store.history)
const config = computed(() => store.config)

// 按奖项分组的中奖者
const prizeWinners = computed(() => {
  const result: Record<string, any[]> = {}

  for (const prize of config.value.prizes) {
    result[prize.id] = winners.value.filter((w) => w.prizeId === prize.id)
  }

  return result
})

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function formatHistoryTime(record: any[]) {
  if (record.length === 0) return ''

  const timestamps = record.map((r) => r.timestamp)
  const max = Math.max(...timestamps)
  const min = Math.min(...timestamps)

  if (max === min) {
    return formatTime(max)
  }

  return `${formatTime(min)} - ${formatTime(max)}`
}

function exportToExcel() {
  const data = winners.value.map((w) => ({
    '奖项': w.prizeName,
    '工号': w.participant.id || '',
    '姓名': w.participant.name,
    '手机号': w.participant.phone || '',
    '部门': w.participant.department || '',
    '中奖时间': new Date(w.timestamp).toLocaleString(),
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '中奖名单')

  const fileName = `中奖名单_${new Date().toLocaleDateString()}.xlsx`
  XLSX.writeFile(wb, fileName)

  ElMessage.success('导出成功')
}

function exportToCsv() {
  const data = winners.value.map((w) => ({
    '奖项': w.prizeName,
    '工号': w.participant.id || '',
    '姓名': w.participant.name,
    '手机号': w.participant.phone || '',
    '部门': w.participant.department || '',
    '中奖时间': new Date(w.timestamp).toLocaleString(),
  }))

  exportToCSV(data, `中奖名单_${new Date().toLocaleDateString()}.csv`)

  ElMessage.success('导出成功')
}

function clearAll() {
  ElMessageBox.confirm('确定要清空所有中奖记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      store.saveToHistory()
      store.clearCurrent()
      ElMessage.success('已清空')
    })
    .catch(() => {})
}

function removeWinner(id: string) {
  ElMessageBox.confirm('确定要移除该中奖记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      store.removeWinner(id)
      ElMessage.success('已移除')
    })
    .catch(() => {})
}

function viewHistory(index: number) {
  emit('viewHistory', index)
}
</script>

<style scoped>
.winner-list {
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #00fff9;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
}

.actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(0, 255, 249, 0.1);
  border: 1px solid #00fff9;
  border-radius: 4px;
  color: #00fff9;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.action-btn:hover {
  background: rgba(0, 255, 249, 0.2);
  box-shadow: 0 0 15px rgba(0, 255, 249, 0.4);
  transform: translateY(-2px);
  text-shadow: 0 0 10px #00fff9;
}

.action-btn.danger {
  background: rgba(255, 0, 255, 0.1);
  border-color: #ff00ff;
  color: #ff00ff;
}

.action-btn.danger:hover {
  background: rgba(255, 0, 255, 0.2);
  box-shadow: 0 0 15px rgba(255, 0, 255, 0.4);
  text-shadow: 0 0 10px #ff00ff;
}

/* 中奖内容 - Cyberpunk */
.winner-content {
  margin-bottom: 32px;
}

.prize-group {
  margin-bottom: 32px;
}

.prize-group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-left: 4px solid #00fff9;
  border-radius: 4px;
  font-weight: 600;
  color: #00fff9;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 255, 249, 0.3);
  position: relative;
}

.prize-group-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
}

.prize-icon {
  font-size: 24px;
  filter: drop-shadow(0 0 5px currentColor);
}

.prize-title {
  font-size: 18px;
  flex: 1;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.prize-count {
  font-size: 14px;
  opacity: 0.9;
  font-family: 'Orbitron', monospace;
}

.winner-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.winner-card {
  border: 2px solid rgba(0, 255, 249, 0.3);
  border-left-width: 4px;
  border-radius: 4px;
  background: rgba(0, 255, 249, 0.03);
  padding: 20px;
  transition: all 0.3s;
  position: relative;
}

.winner-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #00fff9, transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.winner-card:hover::before {
  opacity: 1;
}

.winner-card:hover {
  background: rgba(0, 255, 249, 0.08);
  border-color: #00fff9;
  transform: translateY(-4px);
  box-shadow: 0 0 25px rgba(0, 255, 249, 0.2);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.winner-avatar {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(0, 255, 249, 0.3) 0%, rgba(255, 0, 255, 0.3) 100%);
  border: 2px solid #00fff9;
  color: #00fff9;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
  box-shadow: 0 0 15px rgba(0, 255, 249, 0.3);
}

.winner-name {
  font-size: 18px;
  font-weight: 700;
  color: #00fff9;
  flex: 1;
  font-family: 'Share Tech Mono', monospace;
  text-shadow: 0 0 5px rgba(0, 255, 249, 0.5);
}

.remove-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: rgba(255, 0, 255, 0.1);
  border: 1px solid #ff00ff;
  color: #ff00ff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(255, 0, 255, 0.2);
  box-shadow: 0 0 15px rgba(255, 0, 255, 0.4);
  transform: scale(1.1);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #8a8a9a;
  font-family: 'Share Tech Mono', monospace;
}

.card-info .info-icon {
  font-size: 16px;
  filter: drop-shadow(0 0 3px #00fff9);
}

.card-info.time {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 255, 249, 0.2);
  color: #ff00ff;
}

/* 空状态 - Cyberpunk */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
  filter: drop-shadow(0 0 20px rgba(0, 255, 249, 0.3));
  animation: empty-pulse 2s ease-in-out infinite;
}

@keyframes empty-pulse {
  0%, 100% { filter: drop-shadow(0 0 20px rgba(0, 255, 249, 0.3)); }
  50% { filter: drop-shadow(0 0 30px rgba(255, 0, 255, 0.4)); }
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: #00fff9;
  margin: 0 0 8px 0;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.empty-hint {
  font-size: 14px;
  color: #8a8a9a;
  margin: 0;
  font-family: 'Share Tech Mono', monospace;
}

/* 历史记录 - Cyberpunk */
.history-section {
  padding-top: 32px;
  border-top: 2px solid rgba(0, 255, 249, 0.2);
}

.history-section h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ff00ff;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: 'Share Tech Mono', monospace;
  text-shadow: 0 0 5px rgba(255, 0, 255, 0.3);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 255, 249, 0.03);
  border-radius: 4px;
  border: 1px solid rgba(0, 255, 249, 0.2);
  transition: all 0.3s;
}

.history-item:hover {
  background: rgba(0, 255, 249, 0.08);
  border-color: #00fff9;
  box-shadow: 0 0 15px rgba(0, 255, 249, 0.2);
}

.history-info {
  display: flex;
  gap: 20px;
}

.history-count {
  font-weight: 600;
  color: #00fff9;
  font-family: 'Orbitron', monospace;
}

.history-time {
  color: #8a8a9a;
  font-size: 14px;
  font-family: 'Share Tech Mono', monospace;
}

.view-btn {
  padding: 8px 16px;
  background: rgba(0, 255, 249, 0.1);
  border: 1px solid #00fff9;
  border-radius: 4px;
  color: #00fff9;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.view-btn:hover {
  background: rgba(0, 255, 249, 0.2);
  box-shadow: 0 0 15px rgba(0, 255, 249, 0.4);
  transform: translateY(-2px);
  text-shadow: 0 0 10px #00fff9;
}

@media (max-width: 768px) {
  .winner-cards {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
    gap: 16px;
  }

  .actions {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-btn {
    font-size: 12px;
    padding: 6px 12px;
  }
}
</style>
