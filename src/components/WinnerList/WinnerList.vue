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
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
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
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 20px;
  color: #667eea;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* 中奖内容 */
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
  border-left: 4px solid #667eea;
  border-radius: 12px;
  font-weight: 600;
  color: white;
  backdrop-filter: blur(10px);
}

.prize-icon {
  font-size: 24px;
}

.prize-title {
  font-size: 18px;
  flex: 1;
}

.prize-count {
  font-size: 14px;
  opacity: 0.9;
}

.winner-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.winner-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left-width: 4px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  padding: 20px;
  transition: all 0.3s;
}

.winner-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
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
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.winner-name {
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
  flex: 1;
}

.remove-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  border: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
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
  color: #9ca3af;
}

.card-info .info-icon {
  font-size: 16px;
}

.card-info.time {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
  opacity: 0.5;
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0 0 8px 0;
}

.empty-hint {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* 历史记录 */
.history-section {
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.history-section h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 1px;
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
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(102, 126, 234, 0.2);
}

.history-info {
  display: flex;
  gap: 20px;
}

.history-count {
  font-weight: 600;
  color: #e2e8f0;
}

.history-time {
  color: #6b7280;
  font-size: 14px;
}

.view-btn {
  padding: 8px 16px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 20px;
  color: #667eea;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.view-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px);
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
  }
}
</style>
