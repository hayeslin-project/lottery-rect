# 部署测试清单

## 如果部署后显示空白屏，请检查：

### 1. GitHub Pages 设置
- 进入仓库 Settings → Pages
- Source 选择 "GitHub Actions"
- 保存设置

### 2. 构建输出确认
- 确保构建产物在 `dist/` 目录
- `dist/index.html` 必须存在
- `dist/assets/` 目录包含 JS 和 CSS 文件

### 3. 检查控制台错误
- 打开浏览器开发者工具 (F12)
- 查看 Console 是否有错误
- 查看 Network 是否加载了资源

### 4. 检查资源路径
- 确保所有资源的路径以 `/` 开头
- 例如：`/assets/xxx.js` 而不是 `./assets/xxx.js`

### 5. 清理缓存
- 硬刷新页面 (Ctrl+F5 或 Cmd+Shift+R)
- 或在浏览器中清除缓存

### 6. 检查 URL
- 确保 URL 格式正确：`https://<username>.github.io/<repository-name>/`
- 如果仓库名称不是 `lottery-rect`，需要调整 URL

## 常见问题解决

1. **资源 404 错误**
   - 检查 vite.config.ts 中的 base 配置
   - 确保为 `base: '/'`

2. **JavaScript 错误**
   - 检查浏览器控制台的错误信息
   - 通常是依赖问题或代码错误

3. **CSS 样式丢失**
   - 检查 CSS 文件是否正确加载
   - 确认路径配置正确

## 联系支持
如果问题仍然存在，请提供：
- 页面链接
- 浏览器控制台的错误信息
- Actions 的构建日志