# 部署说明

这个项目是 `Vite + React` 静态前端，推荐部署到 Linux 服务器上的 `Nginx`。

## 方案一：Docker 部署

在项目根目录执行：

```bash
docker build -t meika-admin:latest .
docker run -d --name meika-admin -p 8080:80 --restart always meika-admin:latest
```

访问：

```text
http://服务器IP:8080
```

## 方案二：Nginx 静态部署

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
