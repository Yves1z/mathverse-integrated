import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALLOW_OFFICIAL_LIST_DELETE,
  describeDeleteOutcome,
  isDeletablePracticeList,
  pruneSelectedIds,
  selectablePracticeListIds,
  toggleSelectedId,
} from './practiceListSelection.js'

test('调试阶段官方题单也允许删除', () => {
  assert.equal(ALLOW_OFFICIAL_LIST_DELETE, true)
  assert.equal(isDeletablePracticeList({ id: 'a', isOfficial: false }), true)
  assert.equal(isDeletablePracticeList({ id: 'b' }), true)
  assert.equal(isDeletablePracticeList({ id: 'c', isOfficial: true }), true)
  assert.equal(isDeletablePracticeList(null), false)
})

test('可选题单包含官方题单在内、忽略空 id', () => {
  const ids = selectablePracticeListIds([
    { id: 'official-1', isOfficial: true },
    { id: 'mine-1', isOfficial: false },
    { id: 'official-2', isOfficial: true },
    { id: 'mine-2' },
    { id: '' },
  ])
  assert.deepEqual(ids, ['official-1', 'mine-1', 'official-2', 'mine-2'])
  assert.deepEqual(selectablePracticeListIds(null), [])
})

test('切换选中状态会剔除失效项', () => {
  const selectable = ['mine-1', 'mine-2', 'official-1']

  assert.deepEqual(toggleSelectedId([], 'mine-1', selectable), ['mine-1'])
  assert.deepEqual(toggleSelectedId(['mine-1'], 'mine-1', selectable), [])
  assert.deepEqual(toggleSelectedId(['official-1'], 'mine-2', selectable), ['official-1', 'mine-2'])
  assert.deepEqual(toggleSelectedId([], 'official-1', selectable), ['official-1'])
  // 已不在可选集合里的 id 会被剔除。
  assert.deepEqual(toggleSelectedId(['gone'], 'mine-1', selectable), ['mine-1'])
  assert.deepEqual(toggleSelectedId([], '', selectable), [])
})

test('删除后清理选中的失效 id', () => {
  assert.deepEqual(pruneSelectedIds(['mine-1', 'mine-2', 'gone'], ['mine-2']), ['mine-2'])
  assert.deepEqual(pruneSelectedIds(null, ['mine-2']), [])
})

test('删除结果提示覆盖全部成功、部分失败与全失败', () => {
  assert.equal(describeDeleteOutcome({ requested: 0, deleted: 0, failed: 0 }), '')
  assert.equal(describeDeleteOutcome({ requested: 2, deleted: 2, failed: 0 }), '已删除 2 份题单')
  assert.equal(describeDeleteOutcome({ requested: 3, deleted: 1, failed: 2 }), '已删除 1 份，2 份删除失败')
  assert.equal(describeDeleteOutcome({ requested: 2, deleted: 0, failed: 2 }), '删除失败，请稍后重试')
})
