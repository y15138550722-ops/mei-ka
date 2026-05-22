# 部署说明

这个项目是 `Vite + React` 静态前端，可以部署到 Vercel，也可以部署到 Linux 服务器上的 `Nginx`。

## 方案一：Vercel 生产部署

项目已经绑定到 Vercel 项目 `meika-admin-demo-20260408`。在项目根目录执行：

```bash
npm run deploy:vercel
```

这个命令会依次完成：

1. 检查 `.vercel/project.json`、`vercel.json`、`src/package-lock.json` 等部署配置。
2. 本地构建 `src`。
3. 使用项目内 npm 缓存和已登录的 Vercel CLI 发布到生产环境。
4. 验证正式地址是否返回 `200`。

正式地址：

```text
https://meika-admin-demo-20260408.vercel.app
```

说明：

- 当前桌面环境可能无法读取 Git 信息，检查脚本会把 Git 相关问题作为提醒，不会阻断直接 Vercel CLI 部署。
- 如果需要把 Git 信息作为强校验，可以设置 `VERCEL_STRICT_GIT=1` 后再运行部署命令。
- 如果只想部署、不想做线上访问验证，可以设置 `VERCEL_SKIP_VERIFY=1`。

## 方案二：Docker 部署

在项目根目录执行：

```bash
docker build -t meika-admin:latest .
docker run -d --name meika-admin -p 8080:80 --restart always meika-admin:latest
```

访问：

```text
http://服务器IP:8080
```

## 方案三：Nginx 静态部署

1. 本地打包：

```bash
cd src
npm ci
npm run build
```

2. 上传 `src/dist/` 目录到服务器，例如：

```bash
scp -r dist/* user@server:/var/www/meika-admin/
```

3. 服务器使用 `deploy/nginx.conf` 作为站点配置，并把 `root` 指向上传目录。

如果服务器已经装好了 `Nginx`，通常只需要把静态文件放到站点目录并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 路由说明

项目使用 `BrowserRouter`，`Nginx` 必须配置：

```nginx
try_files $uri $uri/ /index.html;
```

否则刷新 `/orders`、`/products` 等页面会返回 404。
