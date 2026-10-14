import { apiRequest } from './apiClient.js'
import { normalizePracticeListDisplay } from '../utils/practiceListChart.js'

function displayPayload(value) {
  return {
    heading: String(value.heading ?? '').trim(),
    description: String(value.description ?? '').trim(),
    baseColor: value.baseColor,
    progressColor: value.progressColor,
    textColor: value.textColor,
    barHeight: Number(value.barHeight),
    blendPercent: Number(value.blendPercent),
    sortDirection: value.sortDirection === 'desc' ? 'desc' : 'asc',
    showProblemCount: Boolean(value.showProblemCount),
  }
}

export const practiceDisplayService = {
  async getDisplay() {
    return normalizePracticeListDisplay(await apiRequest('/api/v1/practice-lists/display'))
  },

  async getAdminDisplay() {
    return normalizePracticeListDisplay(await apiRequest('/api/v1/admin/practice-list-display'))
  },

  async saveAdminDisplay(value) {
    const saved = await apiRequest('/api/v1/admin/practice-list-display', {
      method: 'PUT',
      body: displayPayload(value),
    })
    return normalizePracticeListDisplay(saved)
  },
}
