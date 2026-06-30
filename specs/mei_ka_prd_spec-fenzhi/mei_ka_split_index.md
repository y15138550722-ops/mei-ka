# 美卡 PRD 拆分索引

> 来源主文档：`specs/mei_ka_prd_spec.md`  
> 拆分日期：2026-04-17
> 最近同步：2026-05-14

## 子 PRD 列表

| 模块 | 文件 | 覆盖范围 |
| --- | --- | --- |
| 基础平台能力 | `specs/mei_ka_prd_spec-fenzhi/mei_ka_foundation_spec.md` | 登录认证、受保护路由、Dashboard、全局导航、管理端/用户端/生产端入口 |
| 订单中心 | `specs/mei_ka_prd_spec-fenzhi/mei_ka_order_center_spec.md` | 翻译/换国内驾照翻译件/IDP/公证/Klook 订单列表、详情、审核、状态聚合 |
| 美卡用户端录单 | `specs/Meika System Port/mei_ka_Client-side .md` | 切换系统后的用户端录单、产品选择、驾照/收货信息、订单提交 |
| 公证处工作台 | `specs/Meika System Port/mei_ka_Notary End.md` | 公证处列表、预览、模板下载、制作推进、完成与物流同步 |
| 管理端总 PRD | `specs/Meika System Port/mei_ka_Admin side.md` | 管理后台、订单中心、产品中心、公证处联动、中文翻译件生产端入口 |
| 驾照官生产端 | `specs/Meika System Port/mei_ka_production side.md` | 中文翻译件生产列表、翻译确认、DOCX 预览编辑、PDF 导出、发货、取消与生产状态映射 |
| 产品中心与办理类型 | `specs/mei_ka_prd_spec-fenzhi/mei_ka_product_center_spec.md` | 产品管理、办理类型、价格矩阵、推送时效、`domestic_license` 分类 |
| 共享能力 | `specs/mei_ka_prd_spec-fenzhi/mei_ka_shared_capabilities_spec.md` | 导出能力、本地持久化、跨模块通用约束 |

## 拆分原则

1. 每份文档可独立评审与排期，不依赖主文档上下文才能理解。
2. 状态机与数据口径在“订单中心”中定义为主口径，其它文档引用不重复发明。
3. 导出与持久化集中到“共享能力”，避免重复定义导致口径冲突。
4. `specs/Requirements Management` 为需求原始记录区，本次同步不更新该目录下文档。
