# GitHub Actions 配置说明

## 工作流概述

本项目包含了三个 GitHub Actions 工作流：

### 1. CI/CD Pipeline (ci.yml)
- **触发条件**: 推送到 master/main/version2 分支或创建 PR
- **功能**:
  - 在多个 Node.js 版本上运行测试
  - 类型检查
-  - 代码检查
  - 项目构建
  - 上传构建产物
  - 部署到 GitHub Pages（仅当推送到 version2 分支时）

### 2. Deploy to Production (deploy.yml)
- **触发条件**: 创建版本标签 (v*)
- **功能**:
  - 构建生产版本
  - 创建 GitHub Release
  - 上传构建产物和压缩包

### 3. Update Dependencies (update-dependencies.yml)
- **触发条件**: 每周一凌晨 2 点自动运行，或手动触发
- **功能**:
  - 检查并更新过时的依赖包
  - 自动提交更新

## 使用说明

### 手动运行工作流
1. 进入 Actions 页面
2. 选择要运行的工作流
3. 点击 "Run workflow" 按钮
4. 选择分支和参数

### 发布新版本
1. 创建版本标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. 这将自动触发 deploy.yml 工作流
3. 查看 Releases 页面获取发布包

### 部署到 GitHub Pages
1. 确保 version2 分支是默认发布分支
2. 在仓库设置中启用 GitHub Pages
3. 推送到 version2 分支将自动触发部署

## 环境变量
如果需要，可以在仓库设置中添加环境变量：
- `NODE_ENV`: 生产环境设置
- `VITE_API_BASE_URL`: API 基础 URL（如果需要）

## 自定义配置
- 修改 Node.js 版本：更新 workflow 文件中的 node-version
- 添加测试命令：在 ci.yml 中添加测试步骤
- 修改部署目标：根据需要配置其他部署服务