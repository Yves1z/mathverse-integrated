/**
 * Selection rules for the “我的题单” batch actions.
 */

/**
 * 调试阶段：官方题单也允许删除。
 *
 * 官方题单会出现在所有人的「官方题单」页，正式上线后如需恢复保护，把这里改为
 * false，并恢复后端 PracticeListService.delete 里的 official 校验。
 */
export const ALLOW_OFFICIAL_LIST_DELETE = true

export function isDeletablePracticeList(list) {
  return Boolean(list) && (ALLOW_OFFICIAL_LIST_DELETE || list.isOfficial !== true)
}

export function selectablePracticeListIds(lists) {
  return (Array.isArray(lists) ? lists : [])
    .filter(isDeletablePracticeList)
    .map((list) => String(list?.id ?? '').trim())
    .filter(Boolean)
}

/** Adds or removes one id, ignoring ids that are not selectable. */
export function toggleSelectedId(selectedIds, listId, selectableIds) {
  const allowed = new Set((Array.isArray(selectableIds) ? selectableIds : []).map(String))
  const next = new Set(
    (Array.isArray(selectedIds) ? selectedIds : []).map(String).filter((id) => allowed.has(id)),
  )
  const id = String(listId ?? '').trim()

  if (!id || !allowed.has(id)) {
    return [...next]
  }

  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }

  return [...next]
}

/** Drops selected ids that no longer exist (for example after a delete). */
export function pruneSelectedIds(selectedIds, selectableIds) {
  const allowed = new Set((Array.isArray(selectableIds) ? selectableIds : []).map(String))
  return (Array.isArray(selectedIds) ? selectedIds : [])
    .map(String)
    .filter((id) => allowed.has(id))
}

export function describeDeleteOutcome({ requested = 0, deleted = 0, failed = 0 } = {}) {
  if (requested <= 0) {
    return ''
  }
  if (failed <= 0) {
    return `已删除 ${deleted} 份题单`
  }
  if (deleted <= 0) {
    return '删除失败，请稍后重试'
  }
  return `已删除 ${deleted} 份，${failed} 份删除失败`
}
