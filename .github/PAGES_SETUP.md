# GitHub Pages 设置指南

## 手动启用 GitHub Pages

如果自动部署失败，请按以下步骤手动配置：

1. **进入仓库设置**
   - 点击仓库顶部的 "Settings" 标签

2. **找到 Pages 部分**
   - 在左侧菜单中找到 "Pages" 选项

3. **选择源和分支**
   - Source 选择 "GitHub Actions"
   - 不要选择 "Deploy from a branch"

4. **保存设置**
   - 点击 "Save" 按钮

## 或者使用传统的 Pages 方式

1. **进入仓库设置** → **Pages**
2. **Source** 选择 "Deploy from a branch"
3. **Branch** 选择 "version2"
4. **Folder** 选择 "/ (root)"
5. **保存**

## 工作流说明

- **pages-deploy.yml**: 优先推荐使用，需要设置为 GitHub Actions 源
- 如果遇到问题，可以使用传统的分支部署方式

## 注意事项

- 确保 version2 分支存在且包含构建文件
- 构建产物必须在 dist/ 目录下
- GitHub Pages 会自动处理静态文件的部署