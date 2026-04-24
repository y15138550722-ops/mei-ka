# 美卡 PRD 拆分索引

> 来源主文档：`specs/mei_ka_prd_spec.md`  
> 拆分日期：2026-04-17

## 子 PRD 列表

| 模块 | 文件 | 覆盖范围 |
| --- | --- | --- |
| 基础平台能力 | `specs/mei_ka_foundation_spec.md` | 登录认证、受保护路由、Dashboard、全局导航 |
| 订单中心 | `specs/mei_ka_order_center_spec.md` | 翻译/IDP/公证/Klook 订单列表、详情、审核、状态聚合 |
| 公证处工作台 | `specs/mei_ka_notary_workbench_spec.md` | 公证处列表、预览、批量下载、制作推进与完成 |
| 产品中心与办理类型 | `specs/mei_ka_product_center_spec.md` | 产品管理、办理类型、价格矩阵、推送时效 |
| 共享能力 | `specs/mei_ka_shared_capabilities_spec.md` | 导出能力、本地持久化、跨模块通用约束 |

## 拆分原则

1. 每份文档可独立评审与排期，不依赖主文档上下文才能理解。
2. 状态机与数据口径在“订单中心”中定义为主口径，其它文档引用不重复发明。
3. 导出与持久化集中到“共享能力”，避免重复定义导致口径冲突。
