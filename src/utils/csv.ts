import Papa from 'papaparse'

/**
 * 参与人员接口
 */
export interface Participant {
  id: string
  name: string
  phone?: string
  department?: string
  weight?: number
  [key: string]: any // 支持自定义字段
}

/**
 * CSV 列映射配置
 */
export interface ColumnMapping {
  id?: string
  name: string
  phone?: string
  department?: string
  weight?: string
}

/**
 * 解析 CSV 文件
 */
export function parseCSV(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          resolve(results.data as string[][])
        } else {
          reject(new Error('CSV文件为空'))
        }
      },
      error: (error) => {
        reject(error)
      },
    })
  })
}

/**
 * 根据列映射配置转换 CSV 数据为参与人员数组
 */
export function transformToParticipants(
  data: string[][],
  mapping: ColumnMapping
): Participant[] {
  const headers = data[0]
  const rows = data.slice(1)

  const getRowIndex = (field?: string): number => {
    if (!field) return -1
    return headers.findIndex((h) => h.trim() === field.trim())
  }

  const nameIndex = getRowIndex(mapping.name)
  if (nameIndex === -1) {
    throw new Error('必须指定姓名列')
  }

  const idIndex = getRowIndex(mapping.id)
  const phoneIndex = getRowIndex(mapping.phone)
  const departmentIndex = getRowIndex(mapping.department)
  const weightIndex = getRowIndex(mapping.weight)

  const participants: Participant[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0 || !row[nameIndex]?.trim()) {
      continue // 跳过空行
    }

    const name = row[nameIndex]?.trim() || ''
    const phone = phoneIndex >= 0 ? row[phoneIndex]?.trim() : undefined
    const department = departmentIndex >= 0 ? row[departmentIndex]?.trim() : undefined
    const weight = weightIndex >= 0 ? Number(row[weightIndex]) || 1 : 1

    const participant: Participant = {
      id: idIndex >= 0 ? row[idIndex]?.trim() || `${i}` : `${i}`,
      name,
      phone,
      department,
      weight: weight > 0 ? weight : 1,
    }

    // 保存所有原始数据
    for (let j = 0; j < row.length; j++) {
      if (j !== idIndex && j !== nameIndex && j !== phoneIndex && j !== departmentIndex && j !== weightIndex) {
        const fieldName = headers[j]?.trim()
        if (fieldName) {
          participant[fieldName] = row[j]?.trim()
        }
      }
    }

    participants.push(participant)
  }

  return participants
}

/**
 * 自动检测列映射
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const result: ColumnMapping = { name: '' }

  // 常见的列名模式
  const patterns = {
    id: ['工号', '编号', 'ID', 'id'],
    name: ['姓名', '名字', 'name'],
    phone: ['手机', '电话', '手机号', 'phone', 'tel'],
    department: ['部门', '科室', 'department', 'dept'],
    weight: ['权重', 'weight', '几率'],
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.trim().toLowerCase() || ''

    for (const [field, keywords] of Object.entries(patterns)) {
      if (keywords.some((kw) => header.includes(kw.toLowerCase()))) {
        // 只有在未设置时才设置，优先匹配更精确的
        if (field === 'name' && !result.name) {
          result.name = headers[i]
        } else if (field === 'id' && !result.id) {
          result.id = headers[i]
        } else if (field === 'phone' && !result.phone) {
          result.phone = headers[i]
        } else if (field === 'department' && !result.department) {
          result.department = headers[i]
        } else if (field === 'weight' && !result.weight) {
          result.weight = headers[i]
        }
      }
    }
  }

  return result
}

/**
 * 导出为 CSV
 */
export function exportToCSV(data: any[], filename: string = 'export.csv') {
  const csv = Papa.unparse(data)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
