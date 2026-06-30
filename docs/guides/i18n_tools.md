# 国际化 (i18n) 工具使用指南

本指南解释了项目中用于管理和验证国际化翻译的工具。

## 📁 相关工具

虽然 `scripts/` 目录已在清理中移除，但相关工具逻辑已迁移或作为参考保留。如需重新使用，可参考之前的 `check-missing-translations.ts` 和 `add-missing-translations.ts` 实现。

## 🛠️ 核心功能（参考）

### 1. 检测缺失翻译 (`check-missing-translations.ts`)

**功能**:
- 扫描 `src/` 目录下所有 `.tsx`, `.ts`, `.vue` 文件
- 提取使用 `t('key')` 格式的翻译键
- 与 locale 文件 (`src/config/i18n/*.ts`) 中定义的键对比
- 生成覆盖率报告和详细分析

**输出示例**:
```
📊 Translation Coverage by Locale:

  en-US: 93.5% coverage (27 missing keys)
  zh-CN: 93.5% coverage (27 missing keys)
  ja-JP: 92.1% coverage (33 missing keys)
  de-DE: 92.1% coverage (33 missing keys)
```

### 2. 翻译辅助 (`add-missing-translations.ts`)

**功能**:
- 生成缺失翻译的代码片段
- 包含所有四种语言的占位符
- 格式化输出，便于复制粘贴

## 📖 翻译命名规范

### 命名格式

```typescript
// ✅ 推荐
"namespace.category.specific_key"

// 示例
"order.filter.cancel_date"    // 订单.过滤器.取消日期
"store.action.enable"          // 门店.操作.启用
"common.message.success"       // 通用.消息.成功
```

### 命名规则

1. **使用小写字母和下划线**: `stop_sale_setting` ✅
2. **避免驼峰命名**: `stopSaleSetting` ❌
3. **使用嵌套结构**: `order.filter.date` ✅
4. **避免中文键名**: `"取消日期"` ❌
5. **使用英文键名**: `"cancel_date"` ✅

### 命名空间组织

```
common          # 通用翻译（按钮、状态等）
menu            # 菜单和导航
order           # 订单模块
stock           # 库存模块
vehicle         # 车辆模块
store           # 门店模块
channel         # 渠道模块
self_service    # 自助服务模块
```

## 🔍 调试技巧

### 查找翻译键使用位置

```bash
# 查找特定翻译键在代码中的使用
grep -r "t('common.remove')" src/

# 查找所有 t() 调用
grep -rE "t\(['\"]" src/
```

### 验证翻译键存在

```bash
# 在 locale 文件中查找特定键
grep "\"remove\":" src/config/i18n/*.ts
```

## 🤝 最佳实践

1. **始终使用键名**: 严禁在代码中硬编码文本
2. **多语言同步**: 添加新键时，确保 en/zh/ja/de 四个文件同步更新
3. **保持结构**: 遵循现有的命名空间结构，不要创建过深的嵌套
