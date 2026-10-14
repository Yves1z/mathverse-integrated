import { apiRequest, clearCsrf } from './apiClient.js'
import { beginIdentityCheck, finishIdentityCheck } from './authIdentity.js'

async function identityRequest(path, options, changingSession = false) {
  const check = beginIdentityCheck({ changingSession })
  try {
    const result = await apiRequest(path, options)
    finishIdentityCheck(check, result)
    return result
  } catch (error) {
    finishIdentityCheck(check, null)
    throw error
  }
}

export const authService = {
  me() {
    return identityRequest('/api/v1/auth/me')
  },
  login(account, password) {
    return identityRequest('/api/v1/auth/login', { method: 'POST', body: { account, password } }, true)
  },
  async logout() {
    const check = beginIdentityCheck({ changingSession: true })
    try {
      const result = await apiRequest('/api/v1/auth/logout', { method: 'POST' })
      finishIdentityCheck(check, { authenticated: false })
      return result
    } finally {
      clearCsrf()
    }
  },
  register(value) {
    return apiRequest('/api/v1/auth/register', { method: 'POST', body: value })
  },
}
