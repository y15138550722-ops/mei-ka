---
trigger: glob
globs: src/modules/**/*
---

# Module Boundaries & Safety

## 1. Modular Isolation
- fleetedge saas项目为模块化架构：`src/modules/*`。
- 当在某个特定 module 下工作时，**严禁** 随意修改其他 module 的代码。
- 即使发现 Cross-Module 引用问题，也**禁止**自动跨模块修复。
- 若确需跨模块修改，必须先向用户请求明确许可。

## 2. Interface Contracts
- 模块之间的通信必须通过 `public-api.ts` 或明确定义的 Interface。
- 若需要修改公共接口（`public-api.ts` 或对外 Interface），必须先请求用户明确许可。
- 如果发现未按接口通信的情况，先停止并征询用户是否允许调整结构。

## 3. Scope Enforcement
- 生成代码前，先检查目标文件路径是否属于当前 focus module。
- 若目标路径不匹配当前 focus module：**停止**并询问用户是否允许切换或新增范围。