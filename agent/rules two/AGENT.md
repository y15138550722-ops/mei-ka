******## 构建命令**
**- 验证编译：`cargo check`**
**- 跑全部测试：`cargo test`**
**- 格式化代码：`cargo fmt`**
**- 静态检查：`cargo clippy -- -D warnings`**
**
**## 本地基础设施**
**- 启动本地环境：`./scripts/dev-infra.ps1 -Action up`**
**- 跑冒烟测试：`./scripts/smoke-persistent.ps1`**
**- API 默认绑定 `**[http://127.0.0.1:18080](http://127.0.0.1:18080)`**
**
**## 代码风格**
**- 后端使用 Rust，协议核心和 API 层都是 Rust。**
**- `crates/protocol/` 中的类型必须与传输方式无关。不要在 protocol 类型里**
**  引用 HTTP、MQTT 或任何特定传输协议的概念。**
**- `crates/adapters/` 必须将外部格式归一化为 protocol envelope。不要让**
**  供应商特有的类型泄漏到 `crates/domain/` 中。**
**- 遵循六边形架构：domain → application → adapters。绝不反转依赖方向。**
**
**## 架构边界**
**- `crates/protocol/` — 线上契约、信封定义（标准的、与传输无关的）**
**- `crates/domain/` — 业务实体、策略模型（不依赖任何基础设施）**
**- `crates/application/` — 用例、端口（与适配器无关）**
**- `crates/adapters/` — 基础设施桥接（PostgreSQL、NATS、MQTT、Webhook）**
**- `apps/api/` — Axum 控制平面（处理函数保持精简，逻辑委托给应用层）**
**
**## 绝对禁止**
**- 不要在 `crates/protocol/` 的类型中加入传输特有的假设**
**- 不要以任何方式记录密钥材料、设备密钥或 epoch key 中的字段**
**- 不要修改 protocol envelope 的 schema 而不同步更新 `specs/jsonschema/`**
**- 不要在 HTTP handler 里写编排逻辑；handler 必须保持精简**
**- 不要在领域实体中混淆设备身份和用户身份**
**- 不要在没有明确审查的情况下改动事件排序或重放语义**
**
**## 修改 protocol 时**
**- 同步更新 `specs/jsonschema/protocol-envelope.schema.json`**
**- 如果涉及 API 变更，同步更新 `specs/openapi/control-plane.yaml`**
**- 在 commit message 中说明版本兼容影响**
**
**## 修改持久化时**
**- 考虑重放语义和幂等性**
**- 确认迁移脚本向后兼容**
**- 验证事件排序未被破坏**
**
**## 安全**
**- 密码学相关的变更必须附带明确的理由说明**
**- 任何修改后，撤销（revocation）行为必须仍然有效**
**- 不要让明文出现在日志、遥测数据或死信队列中**
**
**## 更多规则**
**- 协议领域详细约定见 `.claude/rules/**[protocol.md](http://protocol.md)`**
**- 密码学相关约定见 `.claude/rules/[crypto.md](http://crypto.md)`
