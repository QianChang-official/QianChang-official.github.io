# 音源系统部署说明

## 前端

- `/audio/` 是完整音源控制台。
- 首页有迷你播放器和 EQ 入口。
- 公共下载根地址默认使用 `https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev`。
- Worker API 地址需要在页面右侧填写一次，会保存到当前浏览器的 `localStorage`。

## Cloudflare Worker

1. 进入 `workers/`。
2. 执行 `wrangler secret put DEVELOPER_TOKEN`，设置删除专用令牌。
3. 不设置 `UPLOAD_TOKEN` 时，上传公开可用；设置后需要前端额外传 `x-upload-token`。
4. 执行 `wrangler deploy`。
5. 将 Worker 域名填入 `/audio/` 页面里的 `Worker API`。

## R2 CORS

R2 当前只允许 `http://localhost:3000` GET。为了让线上页面播放 R2 音源并启用 Web Audio EQ，需要把 `docs/r2-cors.json` 的策略配置到桶 `r2-server`。

## 权限边界

- 下载：走公开 R2 地址。
- 上传：走 Worker `/api/audio/upload`。
- 删除：走 Worker `/api/audio/delete`，必须带 `x-developer-key`，并匹配 Worker Secret `DEVELOPER_TOKEN`。
- 不要把 Cloudflare R2 S3 API 密钥写进 GitHub Pages 前端。
