import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProblemsPinnedFilters } from '../composables/useProblemsFilterPreferences.js'
import {
  PROBLEMS_SOURCE_CATALOG_ENTRIES,
  buildSourceCatalogOptions,
  normalizeProblemSource,
} from '../config/problems.js'
import { ADMIN_SOURCE_OPTIONS } from '../config/admin.js'

test('dynamic source codes remain valid in routes and pinned preferences', () => {
  assert.equal(normalizeProblemSource('gaokao-beijing'), 'gaokao-beijing')
  assert.equal(normalizeProblemSource('future-source-2027'), 'future-source-2027')
  assert.equal(normalizeProblemSource('../invalid'), '')

  const normalized = normalizeProblemsPinnedFilters({
    source: ['gaokao-beijing', 'future-source-2027', '../invalid', 'gaokao-beijing'],
  })
  assert.deepEqual(normalized.source, ['gaokao-beijing', 'future-source-2027'])
})

test('legacy local placeholder resolves to the provincial group filter', () => {
  assert.equal(normalizeProblemSource('local'), 'provincial')
  assert.equal(normalizeProblemSource('LOCAL'), 'provincial')
})

test('provincial group option replaces the local placeholder row', () => {
  const options = buildSourceCatalogOptions([
    { value: 'national-new-1', label: '新高考Ⅰ卷', groupCode: 'national' },
    { value: 'national-new-2', label: '新高考Ⅱ卷', groupCode: 'national' },
    { value: 'gaokao-beijing', label: '北京卷', groupCode: 'provincial' },
    { value: 'gaokao-tianjin', label: '天津卷', groupCode: 'provincial' },
    { value: 'local', label: '地方卷', groupCode: 'provincial' },
    { value: 'mock', label: '模拟卷', groupCode: 'mock' },
  ])
  assert.deepEqual(
    options.map((option) => option.value),
    [
      '',
      'national',
      'provincial',
      'national-new-1',
      'national-new-2',
      'gaokao-beijing',
      'gaokao-tianjin',
      'mock',
    ],
  )
  assert.equal(options[1].label, '全部全国卷')
  assert.equal(options[2].label, '全部地方卷')
  assert.equal(options[2].groupCode, 'provincial')
  assert.equal(options.find((option) => option.value === 'gaokao-beijing').label, '北京卷')
  assert.equal(
    options.some((option) => option.value === 'local'),
    false,
  )
})

test('admin source picker never offers a group filter as a problem source', () => {
  assert.deepEqual(
    ADMIN_SOURCE_OPTIONS.map((option) => option.value),
    PROBLEMS_SOURCE_CATALOG_ENTRIES.map((option) => option.value),
  )
  assert.equal(
    PROBLEMS_SOURCE_CATALOG_ENTRIES.every((option) => option.value && option.label),
    true,
  )
  assert.equal(
    ADMIN_SOURCE_OPTIONS.some((option) => option.value === 'national'),
    false,
  )
  assert.equal(
    ADMIN_SOURCE_OPTIONS.some((option) => option.value === 'provincial'),
    false,
  )
})
