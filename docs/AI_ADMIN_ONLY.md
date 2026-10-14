# AI 功能仅管理员可用

本次改动把 AI 相关功能的可见入口和接口调用限制为管理员角色。

普通用户仍然可以正常使用题库、题单、试卷、组卷、上传题目等原有功能，只是不再看到或调用 AI 功能。

## 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `frontend/src/stores/practiceLists.js` | 增加 `isAdmin` getter，统一判断当前用户是否为 `ADMIN` |
| `frontend/src/App.vue` | 全局 AI 学习助手抽屉仅管理员渲染 |
| `frontend/src/views/HomeView.vue` | 首页把管理员状态传给搜索面板 |
| `frontend/src/components/home/HomeSearchPanel.vue` | 首页“AI 同类题”入口仅管理员显示 |
| `frontend/src/views/ContributionUploadView.vue` | 上传题目页的 AI 辅助仅管理员显示 |
| `frontend/src/router/index.js` | `/similar-problems` 路由增加管理员权限 |
| `backend/src/main/java/cn/mathverse/backend/config/SecurityConfig.java` | AI 接口从公开访问改为管理员访问 |

## 具体改动

### 1. 增加管理员判断

`frontend/src/stores/practiceLists.js`

```js
getters: {
  isAdmin: (state) => String(state.authUser?.role ?? '').toUpperCase() === 'ADMIN',
  ...
}
```

### 2. 全局 AI 学习助手仅管理员显示

`frontend/src/App.vue`

```vue
<AiAssistantDrawer v-if="practiceListsStore.isAdmin" />
```

### 3. 首页“AI 同类题”仅管理员显示

`frontend/src/views/HomeView.vue` 把管理员状态传给搜索面板：

```vue
:show-ai-entry="practiceListsStore.isAdmin"
```

`frontend/src/components/home/HomeSearchPanel.vue` 增加 prop：

```js
showAiEntry: {
  type: Boolean,
  default: false,
}
```

并给入口增加：

```vue
<RouterLink v-if="showAiEntry" class="home-ai-entry" :to="similarProblemsRoute">
```

### 4. 上传题目页 AI 辅助仅管理员显示

`frontend/src/views/ContributionUploadView.vue`

```js
const isAdmin = computed(() => String(user.value?.role ?? '').toUpperCase() === 'ADMIN')
```

```vue
<AiUploadAssistant v-if="isAdmin && !sent" ... />
```

### 5. 相似题路由加管理员限制

`frontend/src/router/index.js`

```js
meta: { requiresAdmin: true, studyNavigation: true, title: '相似题推荐' },
```

项目已有 `requiresAdmin` 路由守卫，因此非管理员直接访问 `/similar-problems` 会被拦截。

### 6. 后端 AI 接口仅管理员可调用

`backend/src/main/java/cn/mathverse/backend/config/SecurityConfig.java`

```java
.requestMatchers("/api/v1/ai/similarity/chat").hasRole("ADMIN")
```

这样即使绕过前端直接调用接口，非管理员也会被后端拒绝。

## 如何改回去

如果后续要恢复“所有用户都可使用 AI”，反向修改以下位置：

1. 删除 `practiceLists.js` 中的 `isAdmin` getter。
2. `App.vue` 改回：

   ```vue
   <AiAssistantDrawer />
   ```

3. `HomeView.vue` 删除 `practiceListsStore` 相关引入和 `:show-ai-entry`。
4. `HomeSearchPanel.vue` 删除 `showAiEntry` prop 和入口上的 `v-if`。
5. `ContributionUploadView.vue` 删除 `isAdmin` 计算属性，并把 AI 组件改回：

   ```vue
   <AiUploadAssistant v-if="user && !sent" ... />
   ```

6. `router/index.js` 删除相似题路由 meta 中的 `requiresAdmin: true`。
7. `SecurityConfig.java` 改回：

   ```java
   .requestMatchers("/api/v1/ai/similarity/chat").permitAll()
   ```

也可以按需要恢复其中任意一项，例如只想放开前端入口但仍限制接口，就只撤销前端 1-5，保留后端第 6 项。

## 验证建议

- 前端：运行 `cd frontend && npm run build`，确认没有构建错误。
- 管理员账号：登录后应能看到首页 AI 同类题、上传页 AI 辅助和全局 AI 学习助手。
- 普通账号：登录后不应看到上述入口，直接访问 `/similar-problems` 会被路由守卫拦截。
- 后端：非管理员直接调用 `/api/v1/ai/similarity/chat` 应返回 403。
