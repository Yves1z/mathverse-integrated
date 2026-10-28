import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { authService } from '../services/authService.js'
import { lastProblemsVisit } from '../services/problemNavigation.js'

async function redirectToCurrentUser(to) {
  try {
    const auth = await authService.me()
    if (auth?.authenticated && auth.user?.id) {
      return { name: 'user-profile', params: { userId: auth.user.id } }
    }
  } catch {
    // The login page will explain an expired or missing session.
  }
  return { name: 'login', query: { redirect: to.fullPath } }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (
      !savedPosition &&
      from.name === 'question' &&
      to.fullPath === lastProblemsVisit.path &&
      Date.now() - lastProblemsVisit.at < 120000
    ) {
      savedPosition = { top: lastProblemsVisit.top }
    }
    if (savedPosition)
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(savedPosition)))
      })
    if (to.name === 'problems' && from.name === 'problems') return false
    return { top: 0 }
  },
  routes: [
    {
      path: '/papers',
      name: 'papers',
      component: () => import('../views/SharedPapersView.vue'),
      meta: { studyNavigation: true, title: '试卷' },
    },
    {
      // 发布入口已下线，旧链接统一回到试卷库。
      path: '/papers/new',
      redirect: { name: 'papers' },
      meta: { studyNavigation: true, title: '试卷' },
    },
    {
      // 卷面已经直接渲染在试卷详情页，旧链接（含外部分享）统一回到详情页。
      path: '/papers/:resourceId/preview',
      name: 'paper-shared-preview',
      redirect: (to) => ({ name: 'shared-paper', params: { id: to.params.resourceId } }),
      meta: { studyNavigation: true, title: '试卷详情' },
    },
    {
      path: '/papers/:id',
      name: 'shared-paper',
      component: () => import('../views/SharedPaperView.vue'),
      meta: { studyNavigation: true, title: '试卷详情' },
    },
    {
      path: '/contribute',
      name: 'contribute',
      component: () => import('../views/ContributionUploadView.vue'),
      meta: { studyNavigation: true, title: '上传题目' },
    },
    {
      path: '/paper',
      name: 'paper-library',
      component: () => import('../views/PaperLibraryView.vue'),
      meta: { studyNavigation: true, title: '我的试卷' },
    },
    {
      path: '/paper/edit/:id?',
      name: 'paper',
      component: () => import('../views/PaperBuilderView.vue'),
      meta: { studyNavigation: true, title: '自主组卷' },
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('../views/FeedbackView.vue'),
      meta: { studyNavigation: true, title: '题目反馈' },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { studyNavigation: true, title: '首页' },
    },
    {
      path: '/problems',
      name: 'problems',
      component: () => import('../views/ProblemsView.vue'),
      meta: { studyNavigation: true, title: '题库' },
    },
    ...(import.meta.env.DEV ? [{
      path: '/math-agent-eval',
      name: 'math-agent-eval',
      component: () => import('../views/MathAgentEvalView.vue'),
      meta: { studyNavigation: true, title: 'Math Agent 人工测试题库' },
    }, {
      path: '/mascot-preview',
      name: 'mascot-preview',
      component: () => import('../views/MascotPreviewView.vue'),
      meta: { title: '莫比乌斯小兽 · 动态设计' },
    }] : []),
    {
      path: '/similar-problems',
      name: 'similar-problems',
      component: () => import('../features/similar-problems/SimilarProblemsView.vue'),
      meta: { requiresAdmin: true, studyNavigation: true, title: '相似题推荐' },
    },
    {
      path: '/problems/:problemNumber/legacy',
      name: 'question-legacy',
      component: () => import('../views/QuestionView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题目详情（旧版）' },
    },
    {
      path: '/problems/:problemNumber/reader-v1',
      name: 'question-reader-v1',
      component: () => import('../views/QuestionReaderView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题目详情（阅读版一）' },
    },
    {
      path: '/problems/:problemNumber/study-v2',
      name: 'question-study-v2',
      component: () => import('../views/QuestionStudyView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题目详情（讲义版）' },
    },
    {
      path: '/problems/:problemNumber',
      name: 'question',
      component: () => import('../views/QuestionView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题目详情' },
    },
    {
      path: '/training',
      name: 'training',
      component: () => import('../views/TrainingView.vue'),
      meta: { studyNavigation: true, title: '题单' },
    },
    {
      path: '/training/:practiceListId',
      name: 'training-detail',
      component: () => import('../views/TrainingDetailView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题单详情' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录账号' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { title: '创建账号' },
    },
    {
      path: '/forgot',
      name: 'forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { title: '找回密码' },
    },
    {
      path: '/user/settings/profile',
      name: 'user-settings-profile',
      component: HomeView,
      beforeEnter: redirectToCurrentUser,
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/user/settings/preferences',
      name: 'user-settings-preferences',
      component: () => import('../views/UserSettingsView.vue'),
      props: { activeTab: 'preferences' },
      meta: { studyNavigation: true, title: '偏好设置' },
    },
    {
      path: '/user/settings/security',
      name: 'user-settings-security',
      component: () => import('../views/UserSettingsView.vue'),
      props: { activeTab: 'security' },
      meta: { studyNavigation: true, title: '安全设置' },
    },
    {
      path: '/user',
      name: 'user-profile-missing',
      component: HomeView,
      beforeEnter: redirectToCurrentUser,
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/user/:userId',
      name: 'user-profile',
      component: () => import('../views/UserProfileView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAdmin: true, title: '管理后台' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
      meta: { title: '历史与介绍' },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('../views/HelpView.vue'),
      meta: { title: '使用帮助' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: { title: '关于' },
    },
    {
      path: '/support',
      name: 'support',
      component: () => import('@/views/SupportView.vue'),
      meta: { title: '支持数海' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  try {
    const auth = await authService.me()
    if (!auth?.authenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (String(auth.user?.role ?? '').toUpperCase() !== 'ADMIN') {
      return { name: 'problems', query: { adminAccess: 'denied' } }
    }
    return true
  } catch {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

router.afterEach((to) => {
  if (typeof document === 'undefined') {
    return
  }

  const pageTitle = String(to.meta.title ?? '').trim()
  document.title = pageTitle ? `${pageTitle} - 数海 Mathverse` : '数海 Mathverse'
})

export default router
