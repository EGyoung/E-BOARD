# E-Board

## 开发环境设置

### 必需的 VS Code 扩展

当你首次在 VS Code 中打开这个项目时，VS Code 会提示你安装推荐的扩展：

- ESLint
- Prettier

### 自动格式化设置

项目已配置了以下自动化功能：

- 保存时自动格式化代码（Prettier）
- 保存时自动修复 ESLint 问题
- TypeScript 语法检查

### 开发流程

1. 克隆项目后，运行 `pnpm install` 安装依赖
2. 使用 VS Code 打开项目
3. 安装推荐的扩展（会自动提示）
4. 开始开发！代码会在保存时自动格式化

### 手动格式化命令

如果需要手动格式化代码，可以使用以下命令：

- `pnpm run format` - 格式化所有文件
- `pnpm run lint:fix` - 修复 ESLint 问题
