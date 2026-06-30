---
trigger: glob
description: 表单页与列表页设计基线的统一执行规范（Single Source of Truth）
globs: src/**/*, specs/sys/feat_form_experience_unification_spec.md, specs/sys/feat_list_experience_unification_spec.md
---

# Design Baselines

本文件是商户端 Form/List 设计规范的唯一权威来源（Single Source of Truth）。
所有后续设计决策、评审与实现均以本文件为准。

历史来源（用于追溯，不作为优先裁决依据）：

- `specs/sys/feat_form_experience_unification_spec.md`（`FORM_BASE_V1`）
- `specs/sys/feat_list_experience_unification_spec.md`（`ORDER_BASE_V1`）

若 specs 与本文件冲突，统一以本文件为准，并在后续将 specs 回写对齐。

## 1. Baseline Matrix

| 页面类型 | 基线标识 | 历史来源 | 当前版本 |
|---|---|---|---|
| 表单页 | `FORM_BASE_V1` | `specs/sys/feat_form_experience_unification_spec.md` | v1.1 (2026-03-03) |
| 列表页 | `ORDER_BASE_V1` | `specs/sys/feat_list_experience_unification_spec.md` | v1.4 (2026-03-03) |

## 2. Trigger & Routing

识别到以下关键词时，必须命中本基线并路由到对应 profile：

- 表单路由关键词：`Form`、表单、新增、编辑、详情页、`FormPageShell`
- 列表路由关键词：`List`、列表、筛选、分页、批量、`Table`

## 3. Mandatory Workflow

1. 识别页面类型（Form/List），选择 `FORM_BASE_V1` 或 `ORDER_BASE_V1`
2. 读取本文件对应章节，不允许只看摘要
3. 先过 `Do Not` 禁止项，再开始方案设计
4. 优先复用共享组件，不重复造壳层
5. 完成后按 TC 验收用例逐项自查
6. 若需求与本文件基线冲突，必须显式告知用户并等待确认，禁止静默偏离
7. 若发现 specs 未同步，不阻断实施；按本文件落地并标记 specs 待更新

## 4. FORM_BASE_V1 (Form)

### 4.1 页面骨架（必须）

`Header context -> Form content -> Section cards/Anchor -> Footer actions`

### 4.2 布局合同（必须）

1. 页头白底上下文栏；内容区浅灰背景
2. 页面级提交动作（取消/保存）统一放底部操作条，禁止放在顶部
3. 桌面端（`>=1024px`）底部操作条 sticky；中小屏（`<1024px`）静态流式
4. 内容容器最大宽度固定 `1480px`
5. 大屏固定两列：`minmax(0, 1fr) + 220px`，列间距 `24px`
6. 表单字段优先使用 `fe-form-grid-2` / `fe-form-grid-3`

### 4.3 分区与目录（必须）

1. 分区数 `>= 3` 且页面较长时，必须提供目录
2. 大屏（`>=1280px`）目录右侧常驻 sticky
3. 中小屏隐藏右侧常驻目录，使用折叠目录入口
4. 每个分区必须有唯一锚点 id，目录需支持点击跳转与滚动高亮同步

### 4.4 共享实现（优先复用）

- `src/shared/components/form/FormPageShell.tsx`
- `src/shared/components/form/types.ts`
- `src/shared/styles/form-experience.css`

### 4.5 Do Not

1. 禁止页面主区使用窄宽容器（如 `max-w-4xl`）并与右侧目录并存
2. 禁止同业务的新增/编辑/详情使用不同壳层
3. 禁止多分区长表单不提供目录导航
4. 禁止目录与分区命名不一致或锚点不可达
5. 禁止页面级“取消/保存”放顶部操作区

## 5. LIST_BASE_V1 (List)

### 5.1 页面骨架（必须）

`筛选区 -> 操作区 -> 业务 Tabs(可选) -> 表格区 -> 分页区`

### 5.2 筛选区（必须）

1. 动作右对齐，顺序固定：`Search -> Reset`
2. 有高级筛选折叠时，顺序固定：`展开/收起 -> Search -> Reset`（同一动作行）
3. 窄屏可换行，但整体仍保持右侧对齐语义

### 5.3 操作区（必须）

1. 布局固定：左主按钮 + 右侧动作群
2. 左段为新增类主按钮（可选）
3. 右侧动作群包含：选择描述 + 批量动作 + 次操作（导入/导出等）
4. 禁止独立批量状态条
5. 无明确批量业务动作时，隐藏通用“批量操作”按钮

### 5.4 选择与批量（必须）

1. 表头全选显示 `全选当前页 X 条`
2. 非全选但有勾选显示 `已选择 N 条记录`
3. 无勾选时描述隐藏且不占位
4. 范围型批量动作必须弹窗确认 `当前页` / `全部页（当前筛选结果）`
5. 未勾选点击批量动作：提示“请先勾选记录”并阻断
6. 执行成功后清空勾选；筛选条件变化后自动清空勾选

### 5.5 分页区（必须）

1. 固定包含：总数、当前页、前后翻页、跳页输入、每页条数
2. 每页条数固定选项：`20/50/100`，默认 `20`
3. 切换 `pageSize` 或筛选条件变化后，回到第 1 页
4. 跳页输入仅接受正整数并 clamp 至 `[1, totalPages]`
5. 无数据时仍展示分页框架，显示 `1/1` 且翻页禁用

### 5.6 共享实现（优先复用）

- `src/shared/components/list/ListUnifiedPagination.tsx`
- `src/shared/components/list/batchScope.ts`
- `src/shared/components/list/useListBatchSelection.ts`
- `src/shared/components/list/types.ts`

## 6. Cross-Baseline Defaults

1. 本轮统一以“前端收敛”为主，默认不改后端契约
2. 与 `feat_page_refresh_spec.md` 联动时，不破坏 `filters/pagination/sort/columns/scroll` 语义稳定性
3. 不允许为了赶进度绕过共享组件并复制粘贴新实现
4. 交付前必须完成一次“基线自查”，并可映射到对应 TC 编号
5. 新增或调整基线规则时，先更新本文件，再同步 specs（如需）
