# CLAUDE.md — AI 协同开发入口指引

本仓库采用统一的 AI 辅助协同开发规范与“代码-文档强制同步机制”。

在执行任何代码阅读、重构、功能开发或数值调整前，请**务必先阅读以下文件**：

1. **[`AGENTS.md`](./AGENTS.md)** —— 顶层 AI 协同红线与《代码 ⇄ 文档强制同步映射表》
2. **[`docs/00-AI_CONSTRAINTS.md`](./docs/00-AI_CONSTRAINTS.md)** —— AI 修改代码前后的强制检查清单与文档防过期契约
3. **[`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)** —— 项目架构、目录职责与 60FPS 零 GC 循环说明
4. **[`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)** —— 视觉渲染、HUD 规范与移动端多点触控规范
5. **[`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)** —— 完整数值策划案（等级 `Lv`、咬合阶位 `T`、48 阶进化矩阵、猎物体型算法、鱼类深度分布）
6. **[`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md)** —— 多人 Git 协作、自动化测试与 Vercel 部署指南

---

### 快捷验证命令

```bash
# 1. 运行核心数值与规则单元测试
npx tsx --test src/game/rules.test.ts

# 2. 运行 TypeScript 静态类型检查
npm run lint

# 3. 验证生产环境打包（Vercel 构建预检）
npm run build
```

> **重要提醒**：只要你修改了任何业务逻辑、UI 交互或数值参数，**必须在本次任务结束前同步修改 `docs/` 下对应的 `.md` 文档**，绝不允许只改代码不改文档！
