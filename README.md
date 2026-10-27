# 🦈 饥饿鲨：无限进化 (Hungry Shark: Infinite Evolution)

一款基于 **React 19 + TypeScript + HTML5 Canvas 2D** 构建的高帧率深海吞噬进化动作游戏。支持 **48 阶鲨鱼本体进化（6 代 × 8 列）**、**跨局金币与基因持久化养成**、**真实海洋深度栖息地分布**以及**桌面/移动端横屏多点触控**。

---

## 📚 团队协同开发与 AI 约束文档中心（Documentation Hub）

本项目支持多人协同开发与 AI 辅助编程（Cursor / Claude Code / GitHub Copilot / Windsurf / Google AI Studio）。
**任何开发者或 AI 助手在修改代码前，必须先阅读对应的设计文档，并在修改代码后同步更新对应文档，严禁让文档过期失效：**

| 序号 | 文档名称 | 核心内容 |
| :---: | :--- | :--- |
| **00** | **[`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md)** | **AI 编程助手最高行为准则与《代码 ⇄ 文档强制同步映射表》** |
| **00** | **[`docs/00-AI_CONSTRAINTS.md`](./docs/00-AI_CONSTRAINTS.md)** | **AI 编码六大刚性红线、修改前五步预检与文档防过期同步契约** |
| **01** | **[`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)** | **系统架构说明书**：目录结构、三层解耦架构、60FPS 零 GC 对象池、跨局存档 Schema |
| **02** | **[`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)** | **渲染、UI/UX 与多指交互规范**：48 阶精灵抠图与脊柱游动、屏幕体型=吞噬判定铁律、移动端多指摇杆+按钮无阻塞规范 |
| **03** | **[`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)** | **核心数值策划圣经**：双轨等级 `Lv` 与咬合阶位 `T1~T8` 计算公式、猎物相对体型算法、48 阶进化矩阵与三重门禁、海洋深度分布 |
| **04** | **[`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md)** | **协同开发与部署手册**：Git 分支规范、核心单测套件说明、Vercel 部署参数与构建排障 |

---

## 🚀 快速开始 (Quick Start)

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器 (http://localhost:3000)
npm run dev

# 3. 运行核心数值与规则单元测试 (12 项核心断言)
npx tsx --test src/game/rules.test.ts

# 4. 运行 TypeScript 类型检查与生产打包预检
npm run lint && npm run build
```
