# E-Board

> 基于 Canvas 的插件化白板引擎，支持绘图、思维导图、多人协作等场景。

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[在线预览 →](https://egyoung.github.io/E-BOARD)

---

## 特性

- **插件化架构** — 绘图、选择、漫游、快捷键等功能均以插件形式注册，可按需组合
- **丰富的元素类型** — 矩形、圆形、箭头、直线、图片、文本、思维导图
- **高性能渲染** — 基于 Canvas 的脏矩形渲染、离屏缓存，流畅应对大量元素
- **完整的交互能力** — 元素选中、拖拽、缩放、框选、撤销/重做
- **IoC 容器** — 基于 Inversify 的依赖注入，模块解耦、易于扩展
- **协作支持** — WebSocket 通信层，为实时协同编辑预留接口
- **AI 辅助** — 内置 AI 助手模块，支持智能内容生成

## 架构

```
E-Board
├── packages/
│   ├── board-core          # 核心引擎：元素、插件、服务（渲染、变换、模型）
│   ├── board-utils         # 公共工具函数（几何计算、深拷贝等）
│   ├── board-ui            # UI 组件库
│   ├── board-workbench     # 工作台：组装核心与插件，提供完整白板实例
│   ├── board-collaboration # 协作层：CRDT / OT 相关逻辑
│   ├── board-websocket     # WebSocket 通信服务
│   ├── board-plugin-fps    # FPS 性能监测插件
│   └── board-ai-assistant  # AI 辅助模块
├── app/                    # 前端演示应用（Webpack + React）
└── server/                 # 后端服务
```

## 快速开始

### 环境要求

- Node.js >= 16
- pnpm >= 8

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/egyoung/E-Board.git
cd E-Board

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 [http://localhost:3001](http://localhost:3001) 查看效果。

### 构建

```bash
pnpm build
```

## 核心插件

| 插件 | 功能 |
| --- | --- |
| `draw` | 自由笔触绘制，支持线条粗细、颜色调节 |
| `drawShape` | 矩形、圆形等形状绘制 |
| `drawArrow` / `drawLine` | 箭头、直线绘制 |
| `selection` | 元素选中、拖拽、缩放、框选 |
| `roam` | 画布平移与缩放（漫游模式） |
| `eraser` | 橡皮擦，支持局部擦除 |
| `mindMap` | 思维导图绘制与自动布局 |
| `picture` | 图片元素插入与管理 |
| `hotkey` | 快捷键绑定（撤销/重做/删除等） |
| `clear` | 画布清空 |

## 元素类型

| 元素 | 说明 |
| --- | --- |
| Rect | 矩形，支持填充与描边 |
| Circle | 圆形 / 椭圆 |
| Arrow | 带箭头的连线 |
| Line | 直线段 |
| Picture | 图片元素 |
| Text | 文本元素 |
| MindMap | 思维导图（树形自动布局） |

## 项目路线图

- [x] 插件机制
- [x] 基础绘图（笔触平滑、粗细、颜色）
- [x] 形状绘制（矩形、圆形、箭头、直线）
- [x] 图片渲染
- [x] 橡皮擦 & 局部擦除
- [x] 元素选中 / 拖拽 / 缩放
- [x] 画布漫游与缩放
- [x] 撤销 / 重做
- [x] 思维导图
- [ ] 文本渲染
- [ ] 多指书写
- [ ] 实时协同编辑
- [ ] CI / CD 流水线完善

## 技术栈

- **渲染**：Canvas 2D
- **语言**：TypeScript
- **依赖注入**：Inversify
- **前端框架**：React
- **构建工具**：Webpack / Father
- **包管理**：pnpm Monorepo

## 许可证

[GPL v3](https://www.gnu.org/licenses/gpl-3.0)

本项目采用 GNU General Public License v3.0 发布：

- **自由使用** — 允许个人和商业用途
- **自由修改** — 可以修改源代码
- **自由分发** — 可以分发副本
- **Copyleft** — 衍生作品必须以相同的 GPL 许可证开源
