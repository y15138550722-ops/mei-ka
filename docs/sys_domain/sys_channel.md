# 系统术语定义：Channel / 渠道

> **AI Context Instruction**:
> 当代码中出现 `Channel`、`Source Channel`、`source_channel` 时，优先使用本文定义。
> 生成涉及渠道判断的 `switch/case`、查询条件和映射逻辑时，使用本文第 3 节中的统一常量与字段口径。

## 1. 领域边界与核心对象 (Overview)

### 1.1 Channel 的领域定义

在 FleetEdge car rental 业务中，**Channel（渠道）= 租户品牌渠道实例（`tenant_channel`）**。

明确边界：
- 渠道不是渠道模板（`sys_channel_template`）
- 渠道不是导入模板（`sys_import_template`）
- 订单中的 `source_channel` 只表达“渠道实例”语义

### 1.2 四层对象关系（统一口径）

1. `platform_channel`：平台维护的线上 OTA 渠道主数据（名称、认证协议、接入模式）
2. `sys_channel_template`：系统渠道模板（定义 ONLINE/OFFLINE 类别与能力）
3. `tenant_channel`：租户品牌维度的渠道实例（业务主实体，订单来源归属）
4. `sys_import_template`：订单导入模板（仅用于文件解析，不是渠道）

### 1.3 Source Channel 定义

- `platform_order.source_channel`
- `rental_order_snapshot.source_channel`

以上字段均表示“渠道实例来源”，对应 `tenant_channel` 语义。
导入模板（如 `FE_STANDARD`、`CTRIP`）仅是导入元数据，不可作为 `source_channel` 值。

## 2. 渠道分类与生命周期 (Channel Types & Lifecycle)

### 2.1 按运行模式分类

- `ONLINE`：线上渠道，支持 API 对接
- `OFFLINE`：线下渠道，不走 API 直连，主要通过运营流程/导入承接

### 2.2 线上接入模式（仅 `ONLINE`）

- `SAAS_OPENAPI`：FleetEdge 对外提供 OpenAPI
- `OTA_ISV`：FleetEdge 作为 OTA ISV 对接 OTA 协议

### 2.3 渠道状态模型（业务状态）

线上渠道状态（`tenant_channel.status`）：
- `PENDING`：申请中
- `REJECTED`：申请驳回
- `ENABLED`：已启用
- `DISABLED`：已停用

线下渠道状态（`tenant_channel.status`）：
- `ENABLED`：已启用
- `DISABLED`：已停用

### 2.4 连接状态模型（仅线上且已启用）

`tenant_channel.connect_status` 仅在 `channel_mode = ONLINE` 且 `status = ENABLED` 时生效：
- `DISCONNECTED`：未连接
- `CONNECTED`：已连接
- `ERROR`：连接异常

### 2.5 Walk-in 特殊渠道

Walk-in 渠道是系统默认线下渠道，规则固定：
- `template_code = WALKIN`
- `channel_mode = OFFLINE`
- `is_system = 1`
- 始终启用，不可删除、不可停用、不可改模板/模式
- 仅允许修改 `display_name`
- 不支持订单导入（门店直接建单）

## 3. 技术映射 (Technical Mapping)

### 3.1 枚举定义 (Enums)

| 枚举 | 值 | 适用范围 | 说明 |
| --- | --- | --- | --- |
| `ChannelMode` | `ONLINE`, `OFFLINE` | `tenant_channel.channel_mode` | 渠道运行模式 |
| `OnlineIntegrationMode` | `SAAS_OPENAPI`, `OTA_ISV` | `tenant_channel.integration_mode`（线上） | 线上接入模式 |
| `ChannelStatusOnline` | `PENDING`, `REJECTED`, `ENABLED`, `DISABLED` | `tenant_channel.status`（线上） | 线上状态 |
| `ChannelStatusOffline` | `ENABLED`, `DISABLED` | `tenant_channel.status`（线下） | 线下状态 |
| `ConnectStatus` | `DISCONNECTED`, `CONNECTED`, `ERROR` | `tenant_channel.connect_status`（线上且启用） | 连接状态 |
| `ConnectManagedBy` | `PLATFORM`, `TENANT` | `tenant_channel.connect_managed_by`（线上） | 连接管理方 |

空值规则：
- `integration_mode`：仅线上可有值，线下必须为空
- `connect_status`：仅线上且启用态可有值；申请中/驳回态不展示

### 3.2 数据库字段 (Database Schema)

#### 3.2.1 主实体：`tenant_channel`

核心字段：
- `id`：渠道实例 ID（渠道主键）
- `tenant_id`：租户 ID
- `brand_id`：品牌 ID（创建后不可变）
- `template_code`：渠道模板编码
- `display_name`：渠道展示名
- `channel_mode`：`ONLINE` / `OFFLINE`
- `status`：渠道业务状态
- `integration_mode`：线上接入模式（仅线上）
- `connect_status`：连接状态（仅线上已启用）
- `order_import_enabled`：是否启用导入（线下）
- `allowed_import_templates`：允许导入模板列表（线下）
- `is_system`：是否系统渠道（Walk-in）

关键约束：

```sql
UNIQUE(tenant_id, brand_id, template_code, channel_mode)
```

#### 3.2.2 订单来源映射（Source Channel）

- `platform_order.source_channel`
- `rental_order_snapshot.source_channel`

映射语义：
- 值代表渠道实例来源（`tenant_channel`）
- 不是导入模板编码
- 不是渠道模板编码

### 3.3 实现常量建议 (Implementation Constants)

建议在代码中统一如下常量命名（可映射到语言级 enum）：

```ts
const CHANNEL_MODE = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;

const CHANNEL_STATUS = {
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  ENABLED: "ENABLED",
  DISABLED: "DISABLED",
} as const;

const INTEGRATION_MODE = {
  SAAS_OPENAPI: "SAAS_OPENAPI",
  OTA_ISV: "OTA_ISV",
} as const;

const CONNECT_STATUS = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
} as const;

const CHANNEL_TEMPLATE = {
  WALKIN: "WALKIN",
} as const;
```

## 4. OTA 业务规则 (Business Rules)

1. **品牌强绑定**：渠道实例创建后 `brand_id` 不可变更。
2. **线上准入**：仅平台支持可连接的渠道可走 `ONLINE`；未完成 API 对接只能创建 `OFFLINE`。
3. **导入边界**：导入模板仅用于文件解析，不进入渠道领域主键，不写入 `source_channel` 语义。
4. **同名展示规则**：同一品牌下，线上与线下渠道允许同名，通过 `channel_mode` 区分展示。
5. **删除/停用策略**：已有订单的渠道实例不可物理删除，仅允许停用。
6. **Walk-in 规则固定**：系统创建、始终启用、不可删不可停、不可导入。
7. **门店关联原则**：渠道门店配置遵循“单门店在单渠道下仅一个品牌名义”的约束（`channel_store_config` 口径）。
8. **订单来源一致性**：订单来源始终追溯到渠道实例，不因导入模板变化而改变渠道语义。

## 5. 口径来源 (References)

- `specs/channel/channel_management_spec.md`
- `docs/assets/platform_channel_management_spec.md`
- `specs/order/feat_orderlist&detail_spec.md`


