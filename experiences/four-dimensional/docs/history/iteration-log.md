# Mathverse 主页原型与开发环境

2026-10-12 深井中的欧拉：完成垂直深井方案第四阶段，独立 `/space-a/abyss/euler/` 将圆弧、旋转曲面、公式与少量纸页放入同一内层源体积，随层板共同 YW 投影展开。接回真实拾取、实体遮挡、欧拉三章、故事记忆和共享角度；阅读占屏幕 80.1%，外围以原速度 6% 继续行进，返回恢复朝向及暂停状态。六状态实际对照与 117.16 秒实录为 `/artifacts/spaces/abyss/vertical-abyss-euler/index.html`。模型、正常速度完整交换、305 个时序样本、真实点击与遮挡、桌面阅读、减少动态、资源复用及生产构建通过，范围见 `docs/spaces/abyss/vertical-abyss-euler-report.md`。检查脚本 `node scripts/spaces/abyss/abyss-euler.model.test.mjs`、`node scripts/spaces/abyss/abyss-euler.capture.mjs`、`node scripts/spaces/abyss/abyss-euler.browser.test.mjs`；后者支持 `--interaction-only`。下一阶段复查新开口的光路、材质与克制微尘。

2026-10-12 深井侧壁交换：完成垂直深井方案第三阶段，独立 `/space-a/abyss/exchange/` 将一组相连横向板库放入共同 YW 投影。72 个实体与 12 根承接共同变化，暖白接缝追踪密集内层向外展开，中心自然放大约 3.22 倍，其余巨构保持稳定。首次稳定 32 秒，按 6／30／8 秒起势、交换、落定；持续行进、弹性扭头、独立定格、暂停和手动交换可用。五阶段同眼点对照及 90.28 秒实录为 `/artifacts/spaces/abyss/vertical-abyss-exchange/index.html`。完整真实事件、路线净空、桌面交互、减少动态、资源稳定、旧版本回归与生产构建通过，范围见 `docs/spaces/abyss/vertical-abyss-exchange-report.md`。检查脚本 `node scripts/spaces/abyss/abyss-exchange.model.test.mjs`、`node scripts/spaces/abyss/abyss-exchange.capture.mjs`、`node scripts/spaces/abyss/abyss-exchange.browser.test.mjs`、`node scripts/spaces/abyss/abyss-exchange.gallery.test.mjs`。下一阶段接回欧拉与阅读。

2026-10-12 井边弧线行进：完成垂直深井方案第二阶段，独立 `/space-a/abyss/journey/` 沿平缓曲线绕过近处巨柱，逐渐进入井口，再继续深入。高度与朝向保持稳定，拖拽独立控制弹性扭头；暂停、最近方向回正、重新行进分别可用。七张实际对照及 58.88 秒真实实录为 `/artifacts/spaces/abyss/vertical-abyss-journey/index.html`。路径净空、不同帧率、完整发现过程、实际连续采样、暂停像素、多圈回正、桌面控件、减少动态、资源复用与生产构建通过，范围见 `docs/spaces/abyss/vertical-abyss-journey-report.md`。检查脚本 `node scripts/spaces/abyss/abyss-journey.model.test.mjs`、`node scripts/spaces/abyss/abyss-journey.capture.mjs`、`node scripts/spaces/abyss/abyss-journey.browser.test.mjs`、`node scripts/spaces/abyss/abyss-journey.controls.test.mjs`。原静态和巨构入口保留，下一步接入深井侧壁的共同四维事件。

2026-10-12 垂直深井构成：按新讨论方案完成第一阶段，独立 `/space-a/abyss/` 重建上下深井、横向宽厚层板与错层背景，建议审阅 `/space-a/abyss/?view=reveal`。入口、显露、侧向三主视角与抬头／俯视／回望对照为 `/artifacts/spaces/abyss/vertical-abyss-composition/index.html`。当前为可弹性环顾的静态构成，连续行进、四维交换和欧拉内容随后接入；原巨构保留。模型净空、真实拖拽、回正、静态像素、姿态资源复用、桌面控件和生产构建通过，范围见 `docs/spaces/abyss/vertical-abyss-composition-report.md`。检查脚本 `node scripts/spaces/abyss/abyss-composition.model.test.mjs`、`node scripts/spaces/abyss/abyss-composition.capture.mjs`、`node scripts/spaces/abyss/abyss-composition.browser.test.mjs`。

2026-10-12 巨构光影收尾：完成参考图重建第五阶段，默认 `/space-a/reference/` 使用中性石墨灰、层间接触阴影、远处暖白渐变透光和少量局部空气。512 个微尘点限定在光路内，共用四维交换时钟；定格、阅读慢行与有界复用保持一致。新旧同眼点、八组实际画面和 164.08 秒完整实录为 `/artifacts/spaces/megastructure/megastructure-reference-light/index.html`；上一轮光影保留为 `/space-a/reference/?finish=previous`。模型、完整真实事件、定格像素、三章阅读、实际遮挡、桌面尺寸、资源复用与生产构建通过，范围见 `docs/spaces/megastructure/megastructure-reference-light-report.md`。运行 `node scripts/spaces/megastructure/reference-light.model.test.mjs`、`node scripts/spaces/megastructure/reference-light.capture.mjs`、`node scripts/spaces/megastructure/reference-light.browser.test.mjs` 复查。五个实施阶段已执行，最终艺术审阅、指定硬件长期性能与完整主页整合继续后续工作。

2026-10-11 巨构中的欧拉：完成参考图重建第四阶段，默认 `/space-a/reference/` 将圆、旋转曲面、公式注记和少量作品纸页放入同一内层体积，与实体一起展开到外部。接回欧拉三章、真实图形和纸面点击、实体遮挡、80.1% 阅读、外围 6% 非零慢行与返回记忆。六状态对照和 136.68 秒完整实录为 `/artifacts/spaces/megastructure/megastructure-reference-euler/index.html`；纯交换保留在 `/space-a/reference/?study=exchange`。模型、完整真实事件、三章关联、跨圈连续旋转、遮挡、桌面阅读、资源复用与生产构建通过，范围见 `docs/spaces/megastructure/megastructure-reference-euler-report.md`。检查脚本 `node scripts/spaces/megastructure/reference-euler.model.test.mjs`、`node scripts/spaces/megastructure/reference-euler.capture.mjs`、`node scripts/spaces/megastructure/reference-euler.browser.test.mjs`；快速阅读检查附加 `--interaction-only`。下一步为第五阶段光影、材质与局部空气的收尾。

2026-10-11 巨构深度交换：默认 `/space-a/reference/` 接入一处真实 XW 四维旋转投影，72 个实体与 12 处连接共同变化；密集内层来到外部，疏朗外层退入深处，其余巨构保持稳定。初始停留 24 秒，按 6／30／8 秒起势、展开、落定，之后稳定 80 秒再交换回去。保持持续前进与弹性环顾，新增独立“定格空间”。五个固定阶段对照和 95.48 秒真实录像为 `/artifacts/spaces/megastructure/megastructure-exchange/index.html`；上一轮保留为 `/space-a/reference/?study=journey`。721 角度采样、一次完整真实事件、定格像素、路线净空、资源复用与生产构建通过，范围见 `docs/spaces/megastructure/megastructure-exchange-report.md`。运行 `node scripts/spaces/megastructure/reference-exchange.model.test.mjs`、`node scripts/spaces/megastructure/reference-exchange.capture.mjs`、`node scripts/spaces/megastructure/reference-exchange.browser.test.mjs` 复查。下一阶段接回欧拉与阅读。

2026-10-11 巨构环顾与行进：`/space-a/reference/` 接入持续缓慢深入，补齐侧向、头顶与回望结构，保持弹性扭头与稳定照明。可暂停前进、回正方向或重新进入；前进路线经过实体净空检查，循环替换发生在远裁剪面外。四个真实环顾视角、深入位置对照和 38.44 秒实录为 `/artifacts/spaces/megastructure/megastructure-journey/index.html`；原静态首帧保留在 `/space-a/reference/?study=first`。详细范围见 `docs/spaces/megastructure/megastructure-journey-report.md`。运行 `node scripts/spaces/megastructure/reference-journey.model.test.mjs`、`node scripts/spaces/megastructure/reference-journey.capture.mjs`、`node scripts/spaces/megastructure/reference-journey.browser.test.mjs` 复查。四维交换与欧拉内容属于后续阶段。

2026-10-11 参考图首帧重建：按 A 层叠巨构重新建立厚重框架、深凹层板与局部透光。独立样片 `/space-a/reference/`，原设计图与实际截图对照 `/artifacts/spaces/megastructure/megastructure-reference/index.html`。本阶段保持静态构成，支持弹性拖拽和视角复位；连续深入、四维变化与数学世界随后接回。检查脚本 `node scripts/spaces/megastructure/reference-study.qa.mjs`；详细范围见 `docs/spaces/megastructure/megastructure-reference-report.md`。

2026-10-11 巨构尺度返修：默认 `/space-a/euler/` 打开更宽、更高、纵深更长的中央空间，加入上下层和侧向巨构。纵向节距由 48 改为 216，欧拉世界成为侧前方地标，继续保持共用四维投影与缓慢交换。上一版入口 `/space-a/euler/?space=previous`，新旧同视角对照和实录 `/artifacts/spaces/megastructure/megastructure-expanse/index.html`。详细计划见 `docs/spaces/megastructure/megastructure-expanse-plan.md`，验证见 `docs/spaces/megastructure/megastructure-expanse-report.md`；运行 `node scripts/spaces/megastructure/expanse.model.test.mjs`、`node scripts/spaces/megastructure/expanse.capture.mjs`、`node scripts/spaces/megastructure/expanse.browser.test.mjs` 复查。

2026-10-11 巨构返修：以原 `/space-a/` 层叠巨构和光影为底稿，融合一处欧拉体积世界。交互入口 http://127.0.0.1:5184/space-a/euler/ ，同视角四帧对照与实际录像 http://127.0.0.1:5184/artifacts/spaces/megastructure/megastructure-euler/index.html 。31 个外围结构组沿用原数据，改造一处同源翻转区域与相邻开口；其余数学世界暂不扩展。计划和验证见 `docs/spaces/megastructure/megastructure-euler-plan.md`、`docs/spaces/megastructure/megastructure-euler-report.md`。可用 `node scripts/spaces/megastructure/mega-euler.model.test.mjs`、`node scripts/spaces/megastructure/mega-euler.browser.test.mjs`、`node scripts/spaces/megastructure/mega-euler.capture.mjs` 复查。历史入口保留。

2026-10-11 新增第三个体积世界：高斯径向曲面接入右侧前方，暖白截线保留平面曲线的形状。欧拉、莫比乌斯与高斯依次展开，再依次收回，一次只变化一处，侧后方保持安静参照。直达 http://127.0.0.1:5184/space-fusion/gaussian/worlds/ ，对照与实录 http://127.0.0.1:5184/artifacts/spaces/fusion/space-fusion-gaussian/index.html ，拱门入口 http://127.0.0.1:5184/space-fusion/gaussian/ 。旧入口保留。计划及验证见 docs/spaces/fusion/space-fusion-gaussian-plan.md、docs/spaces/fusion/space-fusion-gaussian-report.md；运行 `npm run test:space-fusion-gaussian`、`npm run test:space-fusion-gaussian-browser`、`node scripts/spaces/fusion/space-fusion-gaussian.qa.mjs` 可复查。

2026-10-11 新增第二个体积世界：上方单元包含完整莫比乌斯带，一条连续边界与暖白光点表现其半扭转关系。欧拉与莫比乌斯按固定顺序轮流展开和收回，一次只变化一处。直接入口 http://127.0.0.1:5184/space-fusion/mobius/worlds/ ，对照与实录 http://127.0.0.1:5184/artifacts/spaces/fusion/space-fusion-mobius/index.html ，白色拱门入口 http://127.0.0.1:5184/space-fusion/mobius/ 。上一轮融合入口保留。计划及验证见 docs/spaces/fusion/space-fusion-mobius-plan.md、docs/spaces/fusion/space-fusion-mobius-report.md；运行 `npm run test:space-fusion-mobius`、`npm run test:space-fusion-mobius-browser`、`node scripts/spaces/fusion/space-fusion-mobius.qa.mjs` 可复查。

2026-10-11 新增空间融合构成样片：一个完整欧拉单元与侧后方、上方两处安静参照融入连续骨架。只有欧拉单元翻转，连接随投影端点变化；图形自然展开至约 3.22 倍尺度。入口 http://127.0.0.1:5184/space-fusion/worlds/ ，对照与实录 http://127.0.0.1:5184/artifacts/spaces/fusion/space-fusion/index.html ，白色拱门入口 http://127.0.0.1:5184/space-fusion/ 。本轮为三个固定单元的构成样片，其他世界与无限内容流式复用留待下一轮。计划及验证见 docs/spaces/fusion/space-fusion-plan.md、docs/spaces/fusion/space-fusion-report.md；执行 `npm run test:space-fusion` 和 `npm run test:space-fusion-browser` 可复查。

以下保留前一阶段根主页与演示记录。

更新日期：2026-10-10。用户已批准将内外翻转样片应用到主页。当前根入口从白色拱门进入相连的超立方体空间；沿中央轴持续前进，六个结构单元共用一条节奏，一次只翻转一个单元。保留六个数学世界、欧拉故事、共享角度、80.1% 阅读与 6% 非零慢行。石墨银灰骨架受光清晰，外部空间关闭 Bloom 与粒子，局部数学窗口保留微尘。源代码、依赖、开发缓存、截图及演示录像位于 D 盘。

最新修改：第一个单元的单位圆与银色旋转曲面已放入内方体的体积中，随同一源单元翻到外层，三维投影线性尺寸达到约 3.22 倍。欧拉恒等式采用小型悬浮注记，其余三扇窗口保留。固定镜头对照与约 107 秒实际演示：http://127.0.0.1:5184/artifacts/spaces/inversion/volume-inversion/index.html 。计划及验证见 docs/spaces/inversion/volume-inversion-plan.md、docs/spaces/inversion/volume-inversion-report.md。

直接进入新空间：http://127.0.0.1:5184/space-inversion/worlds/ 。上一版全部画框的实录保留在 http://127.0.0.1:5184/artifacts/spaces/inversion/ordered-inversion/index.html 。旧主页与原跨窗精确拼接保留在 http://127.0.0.1:5184/legacy/ 。整体空间实施与验证见 docs/spaces/inversion/ordered-inversion-plan.md 和 docs/spaces/inversion/ordered-inversion-report.md；下方较早阶段的记录保留作为历史。

## 安装位置

| 工具 | 版本 | 位置 |
|---|---|---|
| Node.js LTS | 24.21.0 | D:\Node.js |
| npm（随 Node.js） | 11.19.0 | D:\Node.js |
| Git for Windows | 2.56.0.windows.2 | D:\Git |
| React / React DOM | 19.3.0 | D:\Mathverse\node_modules |
| Three.js | 0.186.1 | D:\Mathverse\node_modules\three |
| React Three Fiber | 9.8.1 | D:\Mathverse\node_modules\@react-three\fiber |
| KaTeX | 0.19.0 | D:\Mathverse\node_modules\katex |
| Three 后期效果 | postprocessing 6.39.5 / React 组件 3.1.3 | D:\Mathverse\node_modules |
| TypeScript | 7.0.2 | D:\Mathverse\node_modules\typescript |
| Vite | 8.3.4 | D:\Mathverse\node_modules\vite |
| React 构建插件 | 6.1.2 | D:\Mathverse\node_modules\@vitejs\plugin-react |
| Playwright | 1.64.0 | D:\Mathverse\node_modules\playwright |
| Playwright FFmpeg | 1013 | D:\Playwright\browsers\ffmpeg-1013 |
| VS Code（原有） | 1.139.1 | D:\Microsoft VS Code |

另外已安装 React、Three.js、KaTeX 与 Node.js 的类型定义，准确版本见 package.json / package-lock.json。

npm 下载缓存位于 D:\npm-tools\cache，全局工具目录位于 D:\npm-tools\global。当前项目安装与验证的临时文件位于 D:\Mathverse\temp。原来的 D:\npm 是已有启动文件，保持原样。

Node.js 与 Git 的安装包保存在各自 downloads 文件夹。Node.js SHA256 与官方校验表一致；Git SHA256 与官方发布摘要一致，数字签名有效。

## 使用环境

双击 Open-Mathverse.cmd 打开已配置 D 盘路径的终端。PowerShell 中也可运行：

```powershell
. D:\Mathverse\Enter-Environment.ps1
npm run verify
```

已更新用户级工具路径与 npm 缓存位置；新开终端会读取这些设置。原有用户环境值备份在 docs/environment/docs\\environment\\environment-before.json。

## 已完成的验证

- 所有直接依赖的版本树兼容。
- React、Three.js、React Three Fiber、KaTeX 和后期效果模块可加载。
- TypeScript 编译器可运行。
- Vite 可编译 TSX 三维组件样例。
- 现有 Edge 154.0.4258.62 可创建并使用 WebGL2。
- npm audit 检查结果为 0 个已知漏洞。

结果见 docs/environment/docs\\environment\\environment-verification.json 和 docs/environment/docs\\environment\\dependency-audit.json。编译检查样例位于 temp/environment-check，仅用于验证工具，不是主页实现。

复用电脑原有 Edge，没有另行下载浏览器。Playwright 安装时关闭自动下载浏览器；若后续需要下载专用测试浏览器，使用本环境中的 PLAYWRIGHT_BROWSERS_PATH，让它保存在 D:\Playwright\browsers。

## 运行主页原型

在已配置的终端运行：

```powershell
. D:\Mathverse\Enter-Environment.ps1
npm run dev
```

打开 http://127.0.0.1:5184/ 。点击中央门或“推门进入”按钮进入空间；按住鼠标左键拖拽环顾，右上角可暂停前进，底部可恢复朝向前方；“定格空间”单独暂停结构变化。点击数学对象、标签或右上“数学索引”进入阅读；右侧关闭按钮或 Esc 返回。单位圆可调角度，莫比乌斯带可环顾曲面。当前原型仅面向桌面浏览器。

```powershell
npm run build
npm run test:ordered-space
npm run test:ordered-space-browser
npm run test:volume-space
npm run test:motion
npm run test:reading
npm run test:stage-c
npm run test:windows
npm run test:windows-browser
npm run test:light
npm run test:euler
npm run test:euler-viewport
npm run test:alignment
```

浏览器检查使用电脑原有 Edge，需要先启动开发服务器。阶段 C 的截图、检查报告与约 32 秒连续演示位于 artifacts/worlds/stage-c。演示与画面页：http://127.0.0.1:5184/artifacts/worlds/stage-c/index.html 。内容配置、阅读参数与实际验证记录见 docs/worlds/stage-c-report.md。阶段 B 镜头说明仍保留在 docs/interaction/stage-b-report.md。

阶段 A 精修记录见 docs/entrance/stage-a-refined-report.md。原版源代码保存在 artifacts/archive/sources/stage-a-original-source；阶段 A 精修源码保存在 artifacts/archive/sources/stage-a-refined-source；阶段 B 源码与原录像保存在 artifacts/archive/sources/stage-b-source。完整设计方案位于 docs/design/Mathverse-主页动效设计与Agent执行方案.md。

数学窗口与连接运动的早期样例演示页：http://127.0.0.1:5184/artifacts/worlds/stage-d-windows/index.html 。约 39 秒录像覆盖入场、环顾、定格结构、关联阅读、角度调节、人物纸页与返回；说明与实际验证见 docs/worlds/stage-d-windows-report.md。阶段 C 源码已保存到 artifacts/archive/sources/stage-c-source。审美确定为抽象数学景象为主、人物窗口保留少量人的痕迹；设计决定见完整方案第 16 节。

光影与粒子演示页：http://127.0.0.1:5184/artifacts/worlds/stage-d-light/index.html 。实现、参数和实际检查记录见 docs/worlds/stage-d-light-report.md。上一轮窗口源码保存在 artifacts/archive/sources/stage-d-windows-source；原窗口录像与画面页仍保留。旧主页可用 `/legacy/?bloom=off` 检查无光晕时的空间层次。

欧拉人物故事演示页：http://127.0.0.1:5184/artifacts/worlds/stage-d-euler/index.html 。从“数学索引”打开“莱昂哈德·欧拉”，选择无穷与圆、城市与关系、指数与旋转三章；可以展开级数、剥离地形、调节共享角度。原作入口、当代构图说明与实际验证见 docs/worlds/stage-d-euler-report.md。上一轮光影源码已保存到 artifacts/archive/sources/stage-d-light-source。

视角拼接演示页：http://127.0.0.1:5184/artifacts/worlds/stage-d-alignment/index.html 。推门后稍稍抬头，在前进中寻找三窗圆弧的重合；可以暂停旅程，向侧面扭头让第四轴投影展开，点击开口继续阅读。数学对应、实际检查和可调参数见 docs/worlds/stage-d-alignment-report.md；修改前欧拉源码位于 artifacts/archive/sources/stage-d-euler-source。新增测试为 `npm run test:alignment`，连续演示与实体点击检查为 `node scripts/worlds/stage-d.relation.demo.mjs`。

当前优先单独返修四维空间：A 层叠巨构、稳定秩序中的缓慢折叠、骨架受光清晰而深处黑暗。第一轮交互样片为 http://127.0.0.1:5184/space-a/ ，画面与录像页为 http://127.0.0.1:5184/artifacts/spaces/layered/space-revision-a/index.html 。方案见 docs/spaces/layered/space-revision-a-plan.md，实际范围与验证见 docs/spaces/layered/space-revision-a-report.md。运行 `npm run test:space-a` 和 `npm run test:space-a-browser` 可复查新样片。原主页保留，返修前源码位于 artifacts/spaces/layered/space-revision-a/source-baseline。

材质与光影已在同一 /space-a/ 样片精修。光影对照和连续录像：http://127.0.0.1:5184/artifacts/spaces/layered/space-revision-a-light/index.html ，说明与实际检查见 docs/spaces/layered/space-revision-a-light-report.md。上一轮源码位于 artifacts/spaces/layered/space-revision-a-light/source-baseline/revision。使用 `$env:SPACE_A_OUTPUT = 'D:/Mathverse/artifacts/spaces/layered/space-revision-a-light'` 再运行上述空间检查，可将新结果保存到本轮目录。

数学内容接回的新样片：http://127.0.0.1:5184/space-a/worlds/ 。画面与约 99 秒连续录像：http://127.0.0.1:5184/artifacts/spaces/layered/space-revision-a-worlds/index.html 。六扇窗口置于结构开口，跟随所属层面的第四轴投影；前景梁遮挡实体点击和标签。欧拉恒等式、单位圆与复数旋转共享角度，保留欧拉三段故事、局部微尘及 80.1% 阅读／6% 非零慢行。实际范围与边界见 docs/spaces/layered/space-revision-a-worlds-report.md。改前源码位于 artifacts/spaces/layered/space-revision-a-worlds/source-baseline/src。

复查内容接回：`npm run test:space-worlds`、`npm run test:space-worlds-browser`、`npm run test:space-worlds-qa`。纯结构预览和原主页保留；原精确跨窗圆弧拼接仍在原主页，新巨构采用共享参数关系。随后用户决定继续完善四维模型，当前优先级按下面的内外翻转样片执行，阶段 E 继续后移。

独立内外翻转模型：http://127.0.0.1:5184/space-inversion/ 。三种形态对照和约 62 秒实际操作录像：http://127.0.0.1:5184/artifacts/spaces/inversion/space-inversion/index.html 。先“看全貌”，再“观看完整翻转”；定格后可比较初始、展开与外侧。固定 16 顶点、32 连接，暖白角始终追踪同一源单元；空间内摄影持续渐缓深入，拖拽独立控制观察方向。计划见 docs/spaces/inversion/space-inversion-plan.md，实际投影、范围与验证见 docs/spaces/inversion/space-inversion-report.md。复查用 `npm run test:space-inversion` 和 `npm run test:space-inversion-browser`。这一独立样片保持原状；连续空间与数学窗口已按 ordered-inversion-plan.md 接入当前主页。

返修完成后再进入长期运行、硬件明确的 GPU 性能与正式工程集成准备。本轮没有新增软件或依赖。

已读取 mathweb 正式工程的前端配置：Vue + React + Vite，支持 React 组件集成。此次没有修改其业务代码或依赖文件，也没有移动原项目。本目录的独立主页环境可先用于原型验证，集成时继续按照实际项目说明处理。

欧拉作品痕迹已进入三世界融合空间：实时入口 http://127.0.0.1:5184/space-fusion/euler/worlds/ ，白色拱门入口 http://127.0.0.1:5184/space-fusion/euler/ ，实际画面对照与连续实录 http://127.0.0.1:5184/artifacts/spaces/fusion/space-fusion-euler/index.html 。点击欧拉圆与螺旋旁的纸页或人物标签进入三章故事。纸页与数学逐点使用同一四维投影，内外交换后自然放大约 3.22 倍，故事共享角度并记住章节。计划与检查见 docs/spaces/fusion/space-fusion-euler-plan.md、docs/spaces/fusion/space-fusion-euler-report.md。复查用 `npm run test:space-fusion-euler`、`npm run test:space-fusion-euler-browser` 与 `node scripts/spaces/fusion/space-fusion-euler.qa.mjs`。旧样片全部保留。

巨构中的“思想内腔”第一轮已完成欧拉样片：实时入口 http://127.0.0.1:5184/thought-cavity/worlds/ ，拱门入口 http://127.0.0.1:5184/thought-cavity/ ，六状态真实画面对照与约 147 秒实录 http://127.0.0.1:5184/artifacts/spaces/fusion/thought-cavity/index.html 。近景厚梁与层叠结构保持稳定，侧腔数学形体和七层局部肋架共用一次四维翻转，持续前进逐渐改变遮挡。计划及实际范围见 docs/spaces/fusion/thought-cavity-plan.md、docs/spaces/fusion/thought-cavity-report.md。复查用 `npm run test:thought-cavity`、`npm run test:thought-cavity-browser` 和 `node scripts/spaces/fusion/thought-cavity.qa.mjs`。本轮仅完成一个欧拉内腔；其他体积世界、无限组织与指定硬件长期验收继续后续执行，旧样片保留。

三处思想内腔第二轮：实时入口 http://127.0.0.1:5184/thought-cavity/three/worlds/ ，拱门入口 http://127.0.0.1:5184/thought-cavity/three/ ，十状态真实对照及三次完整翻转实录 http://127.0.0.1:5184/artifacts/spaces/fusion/thought-cavity-worlds/index.html 。欧拉在左侧，莫比乌斯在上方，高斯在下方；局部单元和各自七层肋架依次展开再收回，外围固定巨构提供稳定参照。上下真实开口与承接已打磨。范围和验证见 docs/spaces/fusion/thought-cavity-worlds-plan.md、docs/spaces/fusion/thought-cavity-worlds-report.md。复查为 `npm run test:thought-cavity-worlds`、`npm run test:thought-cavity-worlds-browser`，发现过程与对照页分别为 `node scripts/spaces/fusion/thought-cavity-worlds.discovery.mjs`、`node scripts/spaces/fusion/thought-cavity-worlds.qa.mjs`。仍是三个固定内腔的有限样片，旧入口保留。

## 官方来源

- Node.js 官方版本与下载：https://nodejs.org/en/download/archive/v24.21.0
- Git 官方下载入口：https://git-scm.com/install/windows
- 前端包注册表：https://registry.npmjs.org/
