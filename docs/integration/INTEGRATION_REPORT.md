# Mathverse 完整对比与整合记录

日期：2026-10-12。交付为本地源码整合；未推送 GitHub、未部署生产、未调用付费模型。

## 结果与核对范围

以用户指定的 `gaokao-math-platform-handoff-dev-baseline-20260923.zip` 为基线，逐文件检查 546 份原包文件、634 份本地主项目文件、星空/飞船收藏、莫比乌斯静态/动画/v2 三轮输出和 `D:/Mathverse` 四维工程。额外发现并纳入桌面上两份未归档的 Math Universe 原稿及七张形象探索图。

打包前目录统计（不含本段生成的审计索引）：2642 文件、约 1.47 GiB；相对原包 497 文件逐字不变、49 更新、2096 新增、0 缺失。审计索引本身另计，最终完整数量与校验以 DELIVERY_MANIFEST.json、SHA256SUMS.txt 为准。原包文件全部保留。

原 ZIP SHA256：`34db75e47adc2df34eb9b21e6116446bd1ecb7ab5652518b8ceaea0cf05f2301`。源项目 Git HEAD `c7d850b` 用作比较参照；以该提交的 451 文件快照进行三方合并，冲突再按实际功能逐项处理。它是本地参考提交，不声称原 ZIP 自带可验证的 Git 历史。绝不按修改日期整体覆盖。

## 各功能的版本与归属

| 功能 | 整合结果 | 入口或目录 |
|---|---|---|
| Math Agent | 用最新完整实现替换原包聊天型旧版，保留当前阶段边界 | frontend/src/features/ai-assistant；docs/math-agent |
| 草稿与提示 | 提交版本、局部步骤、较早前提、渐进提示、读法确认、过期反馈与取消 | Agent 抽屉 |
| 数学检查 | 有理算术、限定符号与单变量区间证据；未知情况继续标明未验证 | arithmetic/premise/interval verifiers |
| 拍照/手写 | 选区、旋转、逐块订正、确认、主动备份、账号隔离和恢复 | paper/handwriting；features/draft |
| 讲回与路线 | 带出处的单次追问、补充重检、路线比较与条件/范围核对 | teachBack；strategyMap；routeCondition |
| 模型接入 | 推理与生成额度、超时/中止、截断/无最终回复检查；厂商切换清除旧 Key | 前端 relay/dev proxy 与后端 ai/similarity |
| 同类题 | 本地规则、特征抽取、图片识别与修复、复数标签与题目推荐 | /similar-problems（管理员） |
| 原包业务 | 新版试卷/打印、难度、题单显示/统计、原卷与来源管理继续采用原包 | backend、frontend |
| 莫比乌斯小兽 | v2 竖起好奇、盘绕思考、摊低休息；待机眨眼、回复与请求状态 | 首页、Agent；开发态 /mascot-preview |
| 星空与飞船 | 全部收藏、星云、黑洞、知识网图、入场、流形液滴及两份原稿 | design-demos，5500 |
| 四维主页 | 完整 React/Three.js 工程；入口、镜头、投影、数学世界与阅读 | experiences/four-dimensional，5184 |
| 巨构/深井 | 保留两个独立已验证研究及其方案，不虚构尚未实现的场景连接 | /space-a/reference；/space-a/abyss/euler |
| 设计资产 | 原始姿态 PNG、概念稿、正式截图/录像、历史源码快照完整收录 | design-archive；four-dimensional/artifacts |

## 关键合并决定

1. 保留 `cn.mathverse` Java 包名、Mathverse 产品名、原包存储/代理命名。最新代码和测试同步迁入这些命名，避免同一包混入两套 Java 应用或代理地址。数据库开发名称与已有服务器路径按基线保留。
2. V1～V20 共 20 个迁移与原包逐字相同。V19 来源规范、V20 题单显示设置及后端业务不被旧本地主项目回滚。原包试卷界面、难度方案、选项分栏、打印测量、历史/帮助/支持页面均保留。
3. AI 继续仅管理员可用；最新抽屉、解答选区工具条与画板提交入口使用同一权限规则。普通用户画板仍可使用。最新访客型测试改为真实模拟管理员身份，账号切换、恢复与过期检查仍执行。
4. MathText 合并 `questionLayout=false` 的 Agent 输出通道与基线的选择题分栏/打印同步测量，避免整组件覆盖。保留基线浏览器套件并加上新 Agent 套件与小兽测试。
5. 两个前端各自维护 package.json 和锁文件。统一目录、启动与 GitHub 检查，不强行混用 React 19.0（画板）和 19.3（四维）的依赖树。根目录 `npm run install:all`、`npm run dev`、`npm run build` 为统一入口。
6. 四维活动脚本从自身位置解析根目录，浏览器地址可由 MATHVERSE_BASE_URL 指定，浏览器由 CHROME_EXECUTABLE 或系统默认选择。历史六窗口测试明确访问 /legacy，保留旧场景与中央地址兼容表。原电脑 D 盘启动脚本改为当前目录。
7. 历史设计媒体保持原内容。本次生成的复查画面/摘要另放 docs/integration/qa，不覆盖 D:/Mathverse 的原稿；原本机源码和数据没有被修改。

## 验证

- 前端单元测试：276/276；Oxlint、ESLint 和生产构建通过。
- 主站实际浏览器流程：44/44，含 20 条 Agent/草稿/照片/恢复/路线/讲回流程，21 条原包业务流程，以及同类题图片、试卷打印和小兽动画。全部模型回复模拟；未宣称真实 OCR 或模型教学质量。
- 后端：52/52 测试；临时 PostgreSQL 的迁移/业务集成测试通过；可执行 JAR 构建通过。隔离环境不能启动数据库程序，随后在允许的本地测试环境执行；离线打包首次缺少 Maven 标准依赖，补齐后成功。
- 四维：TypeScript 检查与生产构建通过，24 个模型/逻辑检查通过。6 个浏览器流程通过：原欧拉、关联投影、深井图库、路径控件、当前巨构光影及深井欧拉。当前两场景使用固定姿态的交互复查，涵盖真实拾取、遮挡、80.1% 阅读、返回、资源复用及减少动态。没有重做 10 分钟/指定 GPU 的长期性能验收。
- 85 份四维活动脚本语法检查通过；414 个活动源码文件检查无冲突标记；主站依赖与锁文件一致；未发现密钥文件、数据库或识别到的真实 Token。
- 测试曾发现旧菜单路径、访客身份和厂商切换后未补 Key 的输入样例，以及旧场景地址不符。修复测试前提和对应权限入口后复查通过；原始失败日志作为诊断历史保留，FINAL_VALIDATION.json 才是最终结果。
- Windows 本次很长的临时路径触发 TypeScript 原生编译器的库路径限制；使用本机已安装的同版本编译器，对复制后的 tsconfig/source 完成检查。建议解压到较短目录后安装。

## 保留与排除

四维原始输入索引逐项列在 FOUR_DIMENSIONAL_SOURCE.json：保留约 1.3 GB 已命名截图、正式演示、方案、验证摘要和源代码快照；不交付 node_modules、dist、临时环境与未经引用的 raw-video/recording 中间录屏。全部排除路径可复核，本机原件仍在。

莫比乌斯的旧输出目录也逐文件对比；更新版以主项目/v2 为准，旧完整前端副本不再重复装入活动代码。PNG 原稿和三轮预览保留。独立宣传片及其制作工程属于媒体生产，不是本次平台功能设计，未混入源码包；已整理的数学网站视觉原型属于保留资产。环境模板保留，实际 .env、数据库、用户上传、SSH 密钥、Git 元数据、依赖与编译缓存不进入压缩包。

## 上传与运行

解压根目录即统一源码仓库布局。开发采用 Node.js 24.12+，`npm run install:all` 后 `npm run dev`；主站 5173，四维 5184/studies/，设计总览 5500，后端按 DEVELOPMENT.md 启动。

正式样片由 .gitattributes 配置 Git LFS。先在你的仓库运行 `git lfs install`，再复制/提交源码；完整 ZIP 用于交付或 Release 附件，不作为 Git 源码中的一个大文件。具体方法和 GitHub 官方限制见 ../GITHUB_UPLOAD.md。本次没有替你推送或变更远端分支。

## 可追溯材料

- FILE_COMPARISON.csv：原包到整合包每条路径、状态、SHA256 与合并处理。
- LOCAL_WORK_COMPARISON.json：主项目和三个小兽阶段每份文件如何选用。
- SOURCE_AUDIT.json：原包、本地主项目、视觉收藏和小兽阶段的完整初始文件指纹。
- MERGE_DECISIONS.json：三方合并/保留基线/选用最新本地的决定。
- FOUR_DIMENSIONAL_SOURCE.json：四维原稿文件、指纹、字节数、排除目录和脚本迁移。
- DELIVERY_MANIFEST.json、SHA256SUMS.txt：交付目录完整文件与校验；运行 `node tools/verify-delivery.mjs` 可复核。
- verification/FINAL_VALIDATION.json：最终结果；其他日志与 JSON 含初始失败/重试过程。
