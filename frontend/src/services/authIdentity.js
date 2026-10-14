import { readonly, ref } from 'vue'

const owner = ref(null)
export const authOwner = readonly(owner)
let revision = 0

export function ownerFromAuth(auth) {
  if (auth?.authenticated === false) return 'anon'
  const id = auth?.user?.id
  if (auth?.authenticated === true && (typeof id === 'string' || typeof id === 'number')
    && String(id).trim() && String(id).length <= 100) return `user:${id}`
  return null
}

export function beginIdentityCheck({ changingSession = false } = {}) {
  if (changingSession) owner.value = null
  return ++revision
}

export function finishIdentityCheck(check, auth) {
  if (check === revision) owner.value = ownerFromAuth(auth)
}
