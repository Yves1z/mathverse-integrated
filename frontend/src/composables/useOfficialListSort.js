import { ref } from 'vue'
import { normalizePracticeListSort } from '../utils/practiceListChart.js'

export const OFFICIAL_LIST_SORT_STORAGE_KEY = 'official-list-sort-preference'

function readSort() {
  if (typeof window === 'undefined') {
    return normalizePracticeListSort(null)
  }

  try {
    return normalizePracticeListSort(
      JSON.parse(window.localStorage.getItem(OFFICIAL_LIST_SORT_STORAGE_KEY)),
    )
  } catch {
    return normalizePracticeListSort(null)
  }
}

/** 官方题单的排序偏好，保存在本机；未选择时使用后台配置的默认方向。 */
export function useOfficialListSort() {
  const sort = ref(readSort())

  function setSort(changes) {
    sort.value = normalizePracticeListSort({ ...sort.value, ...changes })

    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(OFFICIAL_LIST_SORT_STORAGE_KEY, JSON.stringify(sort.value))
    } catch {
      // 本地存储不可用时，本次页面内的排序选择仍然有效。
    }
  }

  return { sort, setSort }
}
