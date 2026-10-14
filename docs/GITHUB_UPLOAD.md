# 上传 GitHub

完整整合包包含主站、全部设计源码、历史源代码快照和正式样片。请将解压后的目录内容合入仓库；不要把整个 ZIP 当作源码提交。

保留的四维样片约 1.3 GB，其中部分录像超过 50 MiB。仓库已经为研究媒体配置 Git LFS；当前运行所需的源码、字体、莫比乌斯素材和本地 Three.js 不依赖 LFS。

在自己选择的仓库/分支中先执行 `git lfs install`，再复制解压内容，检查差异，执行 `git add .` 和提交。已有仓库保持自己的 .git 目录，不复制旧项目 .git 或改写既有历史。`git lfs ls-files` 可检查媒体是否由 LFS 接管。之后按现有远端设置推送，LFS 存储与流量按账户配额处理。本次整合没有替你执行远端推送。

GitHub 网页上传的单文件上限为 25 MiB，普通 Git 会对超过 50 MiB 的文件警告并拒绝超过 100 MiB 的文件。完整 ZIP 应作为 Release 附件分发，不能直接通过网页上传到源码目录。[GitHub 官方限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)；[LFS 配置说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/configuring-git-large-file-storage)。

安装与检查：Node.js 24.12+，根目录 `npm run install:all`，然后 `npm run dev`。主站、四维研究、星空原型分别在 5173、5184、5500；后端启动见 DEVELOPMENT.md。根目录 `npm run build` 构建两个前端，后端 `mvn verify`。AI 保留原基线的管理员权限；普通用户仍能使用题库与画板。

生产部署继续使用原 deploy 文档。四维与星空是已保留、可独立运行的设计工程；本次没有将所有视觉原型强制变为生产首页，也没有把巨构和深井两个尚待讨论的模型合成一个新场景。
