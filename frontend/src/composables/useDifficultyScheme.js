import { computed, readonly, ref } from 'vue'
import {
  createDifficultyOptions,
  DEFAULT_DIFFICULTY_SCHEME_ID,
  DIFFICULTY_SCHEMES,
  getDifficultyDisplay,
  getDifficultyDisplays,
  getDifficultyScheme,
} from '../config/difficulty.js'

const activeSchemeId = ref(DEFAULT_DIFFICULTY_SCHEME_ID)

export function setActiveDifficultyScheme(schemeId) {
  if (!DIFFICULTY_SCHEMES[schemeId]) return false
  activeSchemeId.value = schemeId
  return true
}

export function getActiveDifficultyDisplay(value) {
  return getDifficultyDisplay(value, activeSchemeId.value)
}

export function useDifficultyScheme() {
  return {
    activeSchemeId: readonly(activeSchemeId),
    scheme: computed(() => getDifficultyScheme(activeSchemeId.value)),
    levelOptions: computed(() => createDifficultyOptions(activeSchemeId.value)),
    selectableLevelOptions: computed(() =>
      createDifficultyOptions(activeSchemeId.value, {
        includeAll: false,
        includeReserved: false,
      }),
    ),
    levelDisplays: computed(() =>
      getDifficultyDisplays(activeSchemeId.value, { includeReserved: true }),
    ),
    describeLevel: (value) => getDifficultyDisplay(value, activeSchemeId.value),
    setActiveDifficultyScheme,
  }
}
