# 管理员内测发布：成员只需上传并运行

Agent 已在主站源码中；本次发布继续限制为管理员使用。发布包包含构建好的前后端，服务器无需安装 Node、Maven 或编译源码。

## 下载与上传

从本仓库 Releases 中下载管理员内测版的 `mathverse-admin-beta-20261028.tar.gz` 和同名 `.sha256` 文件。将两个文件上传到**原来运行 mathverse.com.cn 的应用服务器**的 `/tmp/`。

使用原有 SSH 账号；也可以在已登录的 Workbench 文件面板上传。域名入口此前核对为 `47.82.112.75`，请由原运维确认实际应用服务器。

## 服务器上执行

以下命令在服务器终端执行，使用能运行 sudo 的原有部署账号：

```sh
cd /tmp
sha256sum -c mathverse-admin-beta-20261028.tar.gz.sha256
work=$(mktemp -d /tmp/mathverse-beta-kit.XXXXXX)
tar -xzf mathverse-admin-beta-20261028.tar.gz -C "$work"
cd "$work/mathverse-admin-beta-20261028"
sudo bash install.sh --check-only
```

只有出现 `Preflight passed` 和 `Check-only finished` 后，再执行：

```sh
sudo bash install.sh
```

成功后会输出新前端版本目录和备份位置。脚本只适用于已有部署布局：`/srv/mathsea/backend`、`/var/www/mathsea-current`、`mathsea-backend.service`、PostgreSQL `mathsea`、Redis 和 Nginx。路径、服务、健康、题号格式或迁移不匹配会在停止应用前退出。把完整报错反馈即可，无需自行修改部署脚本。

## 已准备好的内容

- Agent 主实现、模型转发和管理员限制已经包含在发布候选中。
- 清理重复的同类题路由，保留管理员路由。
- 校验安装包和全部应用文件，拒绝目录穿越、链接和重复文件。
- 比对新旧 JAR 内所有 Flyway SQL，内容必须完全相同；本次发布不引入数据库迁移。
- 复用现有发布脚本：备份旧 JAR、配置、数据库及上传文件，检查新应用健康，再切换前端；应用失败会尝试回退旧应用和前端。
- 不覆盖服务器 `.env`、不创建管理员、不写入平台模型密钥。

## 上线后验收

1. 检查首页、题库、登录和试卷正常。
2. 用普通账号确认没有 Agent；有效登录与 CSRF 下直接请求 AI 接口仍被角色规则拒绝。
3. 用已有管理员打开 Agent，在设置中填入自己的模型地址、模型名和 API Key，测试连接。
4. 检查最小提示、继续提示、草稿检查、照片确认、取消和重试。

模型回复在本地回归中均为模拟，真实连接需在管理员会话验收。服务端不具备实际部署记录时，本地构建和 GitHub 检查不能被当作生产部署成功。
