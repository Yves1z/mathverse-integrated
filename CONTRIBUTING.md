# Mathverse 成员协作操作手册

仓库：[Yves1z/mathverse-integrated](https://github.com/Yves1z/mathverse-integrated)。协作约定建立于 2026-10-14。

**每次修改都从最新 `main` 开始；在自己的分支工作；通过 Pull Request（PR，合并申请）进入 `main`。** 不用旧压缩包覆盖仓库，也不把别人正在使用的分支当作自己的工作目录。

## 先看这一页：每次工作的 7 步

1. 在 GitHub Desktop 切到 `main`，点 **Fetch origin**；出现 **Pull origin** 就继续点击，下载最新修改。
2. 从更新后的 `main` 新建自己的分支，例如 `feat/zhang-starfield` 或 `fix/li-print-layout`。
3. 完成一个明确任务，查看变更文件，测试自己改动的功能。
4. 填写提交说明，点 **Commit to…**；再点 **Publish branch** 或 **Push origin** 上传。
5. 点 **Create Pull Request**，确认 `base: main`、`compare: 自己的分支`，填写模板，请另一名协作者审核。
6. 如果提示落后于 `main`，先 **Update branch**，解决冲突；等待三项检查通过，并获得有效的审核同意。
7. 点 **Squash and merge** 合并；回到 Desktop 切换 `main`，再次 Fetch / Pull。下个任务重新建分支。

## 一、第一次加入项目

### 接受邀请并克隆

仓库拥有者在 [Settings → Collaborators](https://github.com/Yves1z/mathverse-integrated/settings/access) 点击 **Add people**，用成员的 GitHub 用户名邀请。成员先接受邀请，并确认自己登录的是被邀请的账号。公开仓库允许别人阅读，但公开本身不会赋予写入权限。

安装 [GitHub Desktop](https://desktop.github.com/download/)，登录自己的 GitHub 账号。选择 **File → Clone repository → URL**，填入：

```text
https://github.com/Yves1z/mathverse-integrated.git
```

选择一个专用的本地目录，克隆整个仓库。所有人各用自己的克隆目录；不要共用同一个网盘同步目录。

仓库包含由 Git LFS 管理的研究视频和图片。GitHub Desktop 自带 LFS，克隆完成后等待媒体下载完毕。如果某个视频只有几行文字，在仓库目录运行 `git lfs install`、`git lfs pull`。下载 ZIP 不作为日常协作方式。[LFS 与 Desktop 官方说明](https://docs.github.com/en/desktop/configuring-and-customizing-github-desktop/about-git-large-file-storage-and-github-desktop)

### 启动项目

完整工程使用 **Node.js 24.12 或更高版本**。在仓库根目录打开终端：

```sh
npm run install:all
npm run dev
```

| 项目 | 本地入口 |
| --- | --- |
| Mathverse 主站 | http://localhost:5173 |
| 四维研究主页 | http://localhost:5184/studies/ |
| 星空及其他设计原型目录 | http://localhost:5500 |

后端需要 JDK 21、Maven 3.9+ 和 Docker，按 [本地开发说明](docs/DEVELOPMENT.md) 启动。需要登录、题库或保存数据的功能还需要后端；启动前端不等于启动全部服务。Agent 的管理员权限与本地授权方式也见该说明。

## 二、开始任务前：保证版本最新

在 GitHub Desktop 的 **Current Branch** 里选择 `main`，然后 Fetch / Pull。**Fetch 只检查远端变化；出现 Pull 时还要 Pull，才会更新本地代码。** 再选择 **New Branch**，从 `main` 创建分支。

分支名使用英文、数字和短横线。建议 `feat/姓名-功能`、`fix/姓名-问题`、`docs/姓名-文档`，如 `feat/wang-agent-hint`。一个分支只处理一个任务，方便审核和撤回。

开始前在仓库 Issue 中简要登记“准备改什么、涉及哪些文件”，或在团队已有沟通渠道说明。同一个核心文件、Agent 提示流程、打印布局等，先协调谁负责。Git 能发现文本冲突，不能自动判断两个设计是否相容。

如果切换分支时提示有未提交修改，先提交到原来的工作分支，或保存到暂存区（stash）后再切换。不要为了拉取最新版而丢弃自己尚未保存的工作。

已经在自己的分支上开发几天时：先提交手头修改、Fetch origin，再用 **Branch → Merge into current branch** 选择更新后的 `origin/main`；也可以先更新本地 `main`，回到自己的分支后将 `main` 合入。同步完成后再测试、Push。不要把旧版文件整批复制回来。[Desktop 分支操作](https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop)

## 三、在哪里修改

| 内容 | 当前入口与约定 |
| --- | --- |
| 主站页面、题库、组卷与打印 | `frontend/`；代码入口见 `docs/DEVELOPMENT.md` |
| 主站 Agent | `frontend/src/features/ai-assistant/`；相关后端在 `backend/` |
| Agent 的有效架构规范 | 先读根目录 `AGENTS.md`、`MATH_AGENT_CONSTITUTION.md`，再按 `docs/math-agent/TASK-ROUTING.md` 读取当前规范；`status: active` 文档具有权威性 |
| 四维 React / Three.js 工程 | `experiences/four-dimensional/` |
| 星空、飞船等设计原型 | `design-demos/` |
| 莫比乌斯小兽制作资料 | `design-archive/mascot/`；主站正在使用的素材与组件仍在 `frontend/`，修改时确认实际引用 |
| 整合清单、历史快照与研究产物 | `docs/integration/` 等保留资料用于追溯；不能以旧快照覆盖当前实现 |

四维与星空工程可以独立运行；把原型纳入生产主站需要单独讨论接入方式。修改 Agent 行为时遵守 `AGENTS.md` 的阅读、分层和验证流程。

已有 Flyway V1～V20 迁移不要改写；需要数据库变化时，查看最新迁移编号，新增迁移文件，并与其他后端成员协调编号。

## 四、提交与本地验证

Desktop 左侧 **Changes** 中逐个查看变更，确认没有意外删除别人的代码。提交说明写实际行为，例如“修复试卷打印选择题换行”或“增加星空背景开关”。不把账号密钥、`.env`、数据库目录、`node_modules`、构建结果或整包 ZIP 提交进源码。

按改动选择验证；在 PR 中填写具体命令与结果。以下命令在仓库根目录执行，浏览器测试首次运行需要安装 Chromium：

| 改动 | 建议验证 |
| --- | --- |
| 两个前端的构建 | `npm run build` |
| 主站一般逻辑 | `npm test`；涉及页面交互时运行 `npm --prefix frontend run test:browser` |
| Agent、草稿或手写交互 | `npm run test:agent`，并实际操作修改的流程 |
| 组卷与打印 | `npm --prefix frontend run test:exam-print`，并检查实际打印预览；改选择题布局时还检查相应页面测试 |
| 莫比乌斯小兽 | `npm --prefix frontend run test:mascot`，并观察显示和动画 |
| 四维工程 | `npm --prefix experiences/four-dimensional run build`，并实际打开相关场景 |
| Java 后端 | 进入 `backend/` 后执行 `mvn verify` |
| 纯文档 | 检查内容、命令和链接；说明无需功能测试的理由 |

浏览器测试准备：`npm --prefix frontend exec -- playwright install chromium`。如果执行 lint / format，注意工具可能自动改文件，提交前重新检查差异。

GitHub 会在推送和 PR 上自动运行三项检查：`frontend`（含页面、Agent、打印和小兽测试及构建）、`backend`（验证与测试）、`four-dimensional`（构建）。三项均为必需项；不要为了通过检查删除测试或跳过断言。

## 五、创建 PR、审核与合并

首次上传分支点 **Publish branch**，以后点 **Push origin**。再点 **Create Pull Request**，确认合并目标为本仓库的 `main`，按自动出现的模板填写：问题、修改后的行为、涉及模块、验证结果、截图或打印预览（适用时）。

在 PR 右侧 **Reviewers** 请求另一名有写入权限的协作者审核。如果还没完成，先创建 **Draft PR**；完成后点 **Ready for review**。

审核者查看 **Files changed**，重点核对是否删掉已有功能、是否混入旧文件、是否修改范围过大，以及界面/打印是否符合预期。需要调整时留评论，由作者修改并推送；确认后用 **Review changes → Approve** 提交审核，普通评论不等于同意合并。

仓库要求最后一次推送得到其他人的审核；**两人协作时，请让 PR 作者负责提交修正，审核者负责评论和审核。** 审核者替作者直接推送代码，可能需要第三人审核才能满足规则。

合并前确认：

- `frontend`、`backend`、`four-dimensional` 的**当前 PR 检查**全部通过。
- 已同步最新 `main`；如果出现 **Update branch**，点击后等待检查重新完成。该按钮不可用时在 Desktop 合并最新版 `main` 到自己的分支并 Push。
- 至少一名其他有写入权限的成员审核同意；新增改动导致旧同意失效时，请重新审核。
- 所有审核讨论已处理并 Resolve；确认没有未解决的冲突。

达到条件后使用 **Squash and merge**，确认合并说明。`main` 变化后，本地切回 `main` 并 Fetch / Pull。已完成的工作分支可以删除，下一个任务新建分支。**合并代码不会自动等同于发布生产网站**；生产发布另按 [部署说明](deploy/README.md) 执行。[更新 PR 的官方说明](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch)

## 六、出现冲突或检查失败时

| 提示或现象 | 应当怎么做 |
| --- | --- |
| 分支落后于 `main` | Update branch，或在自己的分支合入最新 `main`；重新测试与审核 |
| 合并冲突 | 保留自己的工作提交，联系涉及文件的成员，逐处合并两方需要的功能；不要对整个文件盲选“全部使用我的/对方的版本” |
| 冲突标记 `<<<<<<<` / `=======` / `>>>>>>>` | 在编辑器处理每处冲突并删掉标记；按 Desktop 提示完成合并、运行测试、Push，再请成员检查结果 |
| 检查红色 | 打开**当前 PR** 的失败检查看日志，修正在同一分支并 Push；历史上失败的 Actions 记录不会自动变绿，不能据此判断最新版失败 |
| 缺少审核 / 合并按钮不可用 | 请求其他有写入权限的成员 Approve；仓库拥有者也不能自己批准自己的 PR |
| 没有写入权限 | 确认邀请已接受且账号正确；联系拥有者检查 Collaborators |
| 研究视频变成文字指针 | 在仓库目录执行 `git lfs pull`，确认 LFS 下载完成 |
| 测试截图、缓存或数据库文件出现在提交里 | 取消选择，检查忽略配置；不要直接删除自己的本地数据库 |

不要对 `main` 强制推送、不要删除 `main`，也不要用关闭保护规则的方式绕过问题。需要撤回已合并修改时，从最新 `main` 创建修复/撤回分支，通过新的 PR 撤回；不要抹掉公共历史。

## 七、命令行成员的等价流程

首次克隆（已安装 Git 和 Git LFS）：

```sh
git lfs install
git clone https://github.com/Yves1z/mathverse-integrated.git
cd mathverse-integrated
git lfs pull
```

开始一个任务（先确认现有修改已提交或妥善暂存）：

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/yourname-task
```

完成修改并验证后，先 `git status`、`git diff`，只暂存需要的文件，再提交、推送自己的分支：

```sh
git add <需要提交的文件路径>
git commit -m "具体说明修改了什么"
git push -u origin HEAD
```

`<需要提交的文件路径>` 是占位符，请替换为实际路径。随后在 GitHub 创建 PR。开发中同步最新版时，在**自己的工作分支**、已妥善保存修改的前提下执行：

```sh
git fetch origin
git merge origin/main
git push
```

如果 merge 提示冲突，先解决、暂存冲突文件并完成合并提交，再测试与 push。不要执行 `git push --force` 或用 `reset --hard` 丢弃尚未确认的工作。

## 八、拥有者维护规则

`main` 是本仓库的共同最新基线。旧交接分支名、ZIP 文件名中的日期、历史设计快照、整合时的哈希清单都是追溯资料；日常工作以 GitHub 上当前 `main` 的提交记录为准。`tools/verify-delivery.mjs` 校验的是交付快照，后续开发改变快照文件时出现差异属于需要解释的变更，不用于判断当前 PR 的自动检查是否通过。

主分支保护按以下约定执行，可在 [Settings → Branches](https://github.com/Yves1z/mathverse-integrated/settings/branches) 查看：

| 规则 | 配置 |
| --- | --- |
| 进入 `main` 的方式 | 必须通过 PR |
| 审核 | 至少 1 人同意；最后一次推送必须由其他人审核；新改动使旧同意失效 |
| 自动检查 | 必须通过 `frontend`、`backend`、`four-dimensional`，来源为 GitHub Actions |
| 同步 | 必须先包含最新 `main`，再通过检查和审核 |
| 审核讨论 | 合并前必须解决 |
| 强推和删除 | 禁止对 `main` 强制推送或删除 |
| 拥有者 / 管理员 | 同样受上述规则约束，不能直接绕过 |

至少邀请另一名成员并等待其接受邀请，否则拥有者自己的后续 PR 无法满足他人审核要求。普通成员不需要管理员权限；不要为方便合并而授予管理员权限或临时关闭规则。自动检查任务改名时，需要同步更新必需检查名称。

这些规则能阻止未同步、未检查或未审核的分支直接合并；若有人主动把旧代码覆盖成新提交，仍需通过差异审核和功能验证发现，Git 不会理解功能新旧。协调任务、逐文件审核和针对性测试共同保证多人修改不丢失。

主分支保护启用前的这份手册初始化 PR，由拥有者在三项检查通过后合并；后续 PR 遵守以上规则。
