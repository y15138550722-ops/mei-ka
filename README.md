# 项目名称

该项目是针对IDP业务的一个集成办理平台，系统通过与OTA平台对接，专注于为用户提供合规、便捷的国际驾照及多国官方翻译件办理服务业务。同时，平台内置完整的订单管理系统，支持实时跟踪审核、制作、发货等全流程状态，并提供物流查询，实现从申请到交付的高效闭环运营。该系统的核心功能包括：

- 订单中心：支持对各代理商产生的订单进行统一的集成化管理：系统自动识别订单来源（代理ID与层级），并通过统一的订单池汇总、筛选与流转；管理员可集中查看所有代理订单的实时状态（待审核、制作中、已发货、已取消），
- 产品中心：管理IDP业务中的所有产品类型及对应价格：管理员可新增或编辑产品（如“驾照翻译国际认证（小白本）”“NZTA新西兰认证”），并为每种产品配置不同的办理类型（如正常办理、优先办理、加急配送），每个办理类型均可独立设置价格；应用于前台下单。

# 项目结构

本项目的核心文档结构如下：

- README.md: 项目说明文档；
- /docs(定义项目的reference，或mocked data)
- /specs(定义项目的specifications)
- /src(定义mvp级的应用实现)
- /prompts(保存与AI交互的关键prompt记录)

除此之外，请时刻遵循该项目下的rules.md中定义的准则和约束

# 技术栈

本项目定位为 **演示级别 (Demo-level)** 的原型实现，使用 **Google AI Studio Build** 生成的 React 应用：

| 技术                         | 说明                                      |
| ---------------------------- | ----------------------------------------- |
| **React + TypeScript** | Google AI Studio Build 默认生成的框架     |
| **组件化架构**         | 按功能模块拆分组件                        |
| **Mock 数据**          | 使用 `services/` 下的 Mock 服务模拟后端 |

> **💡 设计理念**：专注于产品流程和交互验证，不追求技术完整性。数据为 Mock 模拟，无需真实后端。

# 项目结构（src 目录）

每个功能模块在 `src/` 下按以下结构组织：

```
src/
├── index.html                  # 入口 HTML
├── index.tsx                   # React 应用入口
├── App.tsx                     # 主应用组件（路由配置）
│
├── shared/                     # 🔹 公共层（Shared Layer）
│   ├── layouts/                # 布局组件
│   │   ├── MainLayout.tsx      # 主布局（侧边栏 + 内容区）
│   │   └── AuthLayout.tsx      # 登录页布局
│   ├── components/             # 通用 UI 组件
│   │   ├── Table/
│   │   ├── Form/
│   │   ├── Modal/
│   │   └── ...
│   ├── styles/                 # 全局样式
│   │   ├── variables.css       # CSS 变量（主题色等）
│   │   ├── global.css          # 全局样式
│   │   └── components.css      # 组件样式
│   ├── config/                 # 配置
│   │   └── menuConfig.ts       # 菜单结构配置
│   ├── hooks/                  # 自定义 Hooks
│   ├── utils/                  # 工具函数
│   └── types/                  # 公共类型定义
│
├── services/                   # Mock 数据服务
│   └── mockDataService.ts
│
└── modules/                    # 🔹 功能模块（按一级菜单划分）
    ├── dashboard/              # 工作台
    ├── order-management/       # 订单管理
    ├── product-management/     # 商品管理
    ├── price-management/       # 价格管理
    ├── inventory-management/   # 库存管理
    ├── vehicle-management/     # 车辆管理
    ├── store-management/       # 门店管理
    ├── policy-management/      # 政策管理
    ├── self-service/           # 自助取还
    ├── channel_management/     # 渠道管理
    └── system-settings/        # 系统设置
```

> **映射关系**：`specs/` 下的每个 spec 文档对应 `src/modules/` 下的功能模块。

### Shared Layer 说明

| 目录                     | 职责                                     |
| ------------------------ | ---------------------------------------- |
| `layouts/`             | 页面布局框架，包含侧边栏菜单、顶部导航等 |
| `components/`          | 可复用的 UI 组件（表格、弹窗、表单等）   |
| `styles/`              | 全局样式、主题变量、CSS 规范             |
| `config/menuConfig.ts` | 统一管理侧边栏菜单结构                   |

# 项目运行

## 环境要求

- **Node.js**: >= 18.x

## 本地启动

```bash
cd src
npm install
npm run dev
```
