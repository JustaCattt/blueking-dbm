---
name: oracle-toolbox
description: >-
  Oracle 工具箱提单页的完整实现指南，涵盖 TAPD 需求拉取、原型图预览、目录结构、路由注册、
  页面组件、列组件清单、单据详情页、工具箱菜单、提交流程与编辑回填的编码模式与约定。
  新建或修改 Oracle 工具箱提单页（ORACLE_xxx 类单据）、添加工具箱菜单项、
  注册单据详情页时使用，或当用户询问 Oracle 工具箱提单流程、可编辑表格列组件用法、
  createToolboxRoute / useCreateTicket / useTicketDetail 的使用方式时使用。
---

# Oracle 工具箱提单实现指南

本 skill 沉淀 Oracle 工具箱提单页的完整编码模式，基于 `src/views/db-manage/oracle/` 下已有工具箱的真实代码提炼。

**动手前先通读本文件**，实现时按「实现检查清单」逐条核对，专题细节按下方导航按需读取。

## 参考文件导航

专题细节拆分到 `references/` 目录，按场景按需读取，不必全部加载：

- [tapd-prototype.md](references/tapd-prototype.md)：第 0 步全流程——TAPD 需求拉取、原型图下载与预览、单据类型数量确认、项目 UI 组件对照、cypress fixtures 协议样例。**新建单据时必读**
- [page-template.md](references/page-template.md)：模式 A 的 `Index.vue` 完整模板——template 七元素结构、script setup 核心骨架（含回填、提交、批量录入方法签名）。**创建页面组件（第 2 步）时必读**
- [column-components.md](references/column-components.md)：列组件与表单项完整清单——Oracle 专属列（UpstreamInstanceColumn / ReplicationSourceColumn）、跨库通用列、AvailableResourceColumn 的 params 说明。**选列组件时读**
- [row-editing-pitfalls.md](references/row-editing-pitfalls.md)：行编辑与回填易错点——上游类型切换清空表格、批量录入去重规则、资源标签回填组装、batch-edit field 与行字段名映射。**表格含联动列 / 批量录入 / 资源标签列时必读**
- [ticket-detail.md](references/ticket-detail.md)：单据详情页实现——结构约定、取值兜底、行键与编辑入口位置、详情类型 `Oracle.oracleAddSlave` 注册。**实现详情页（第 2.5 步）时必读**
- [ticket-inventory.md](references/ticket-inventory.md)：现有 Oracle 工具箱的模式归属与特殊组件对照表。**找同类单据做参考实现时查；新单据完成后同步更新该表**

---

## 与 MySQL 工具箱的差异

Oracle 工具箱与 MySQL 工具箱共享以下基础设施（无需重复实现）：

- **核心 Hook**：`useCreateTicket`、`useTicketDetail`、`createToolboxRoute`（用法一致，仅 `DBTypes.ORACLE` 替换 `DBTypes.MYSQL`）
- **全局组件**：`EditableTable`、`EditableRow`、`EditableColumn`、`EditableInput`、`EditableSelect`、`EditableBlock`、`SmartAction`、`BkAlert`、`BkForm`、`BkFormItem`、`BkButton`、`BkSideslider`、`CardCheckbox`、`DbResetButton`、`DbIcon`、`BatchInput`
- **跨库通用列组件**：`SpecColumn`、`ResourceTagColumn`、`AvailableResourceColumn`、`OperationColumn`
- **跨库通用表单项**：`TicketPayload`（含 `createTicketPayload` 工厂函数）

Oracle 工具箱的差异点：

| 差异项 | MySQL | Oracle |
|--------|-------|--------|
| 页面目录 | `src/views/db-manage/mysql/` | `src/views/db-manage/oracle/` |
| 路由注册 | `routes.ts` 中 `createToolboxRoute(DBTypes.MYSQL)` | `routes.ts` 中 `createToolboxRoute(DBTypes.ORACLE)` |
| 菜单文件 | `toolbox/toolboxMenuList.ts` | `toolbox/toolboxMenuList.ts`（同目录结构） |
| 详情页目录 | `com-factory/mysql/` | `com-factory/oracle/` |
| 详情类型注册 | `services/model/ticket/details/mysql/` | `services/model/ticket/details/oracle/` |
| 返回路由 | `MysqlToolboxIndex` | `OracleToolboxIndex` |
| 集群类型 | `TENDBHA`、`TENDBSINGLE` | `ORACLE_PRIMARY_STANDBY`（主从）、`ORACLE_SINGLE_NONE`（单节点） |
| 列组件 | `ClusterColumn`、`TargetClusterColumn`、`DbNameColumn` 等 MySQL 专属列 | `UpstreamInstanceColumn`、`ReplicationSourceColumn` 等 Oracle 专属列 |
| 页面模式 | 6 种（A-F） | 当前仅模式 A 与模式 C（页内 CardCheckbox 子类型，单 ticket_type） |

---

## 页面模式

### 模式 A：标准可编辑表格型

结构：`SmartAction` > `BkAlert` + `BkForm` > `EditableTable` + `TicketPayload`，底部 `#action` 提交 + 重置。**当 `BatchInput` 存在时，其下方的 `BkForm` 或 `EditableTable` 必须加 `class="mt-16"`**。完整模板见 [page-template.md](references/page-template.md)。

### 模式 C：页内子类型选择型（单 ticket_type）

当**同一 ticket_type 内**有多种模式（如上游类型 single / master / slave），通过页级 `BkFormItem` + `CardCheckbox` 切换，条件列用 `v-if="formData.mode === 'xxx'"` 控制显隐。参考实现：`ORACLE_ADD_SLAVE/Index.vue`。

**与 MySQL 的关键区别**：Oracle 不存在「双 ticket_type 共用页面」模式。曾为 `ORACLE_ADD_SLAVE` 设计过双 ticket_type 共用一页 + 提交时动态选择 ticket_type 的方案，后端确认无 `ORACLE_ADD_SLAVE_VIA_CASCADING` 独立单据后已废弃——子类型区分一律走 `details.upstream_type`（或同类协议字段），单一 `useCreateTicket` + 单一 `useTicketDetail`，不建第二个 hook 实例。

**严禁**：后端为每种模式分配了不同 `ticket_type` 枚举时，必须各自独立页面（MySQL 模式 F 的做法），不能用 CardCheckbox 切换合并。

---

## 实现步骤

### 第 0 步：TAPD 需求与原型图获取（新单据必做）

必须先从 TAPD 拉取需求详情与原型图附件，确认单据类型数量（每个独立 ticket_type 独立页面，严禁合并），并与 cypress fixtures 协议样例对齐。完整流程见 [tapd-prototype.md](references/tapd-prototype.md)。

**原型图是产品意图的最权威参考**，BkAlert / CardCheckbox 的文案必须从原型图 HTML 提取原文，禁止自行编造。

### 第 1 步：注册 TicketType 常量

文件：`src/common/const/ticketTypes.ts`

```typescript
export enum TicketTypes {
  ORACLE_YOUR_NEW_TYPE = 'ORACLE_YOUR_NEW_TYPE',
}
```

命名规则：`ORACLE_` 前缀 + 全大写下划线分隔，枚举值必须与后端 `ticket_type` 完全一致。**注册前先与后端确认枚举值真实存在**（`ORACLE_ADD_SLAVE_VIA_CASCADING` 教训：前端自造枚举导致提交报 8700100，最终删除）。

### 第 2 步：创建页面组件

文件：`src/views/db-manage/oracle/ORACLE_YOUR_NEW_TYPE/Index.vue`，含 MIT 版权头。

template 七元素顺序固定：BkAlert → 页级表单项/模式卡片（可选）→ BatchInput（可选）→ BkForm（`mt-16`）→ EditableTable → TicketPayload → `#action` 提交重置。完整模板见 [page-template.md](references/page-template.md)。

列组件路径与 props 见 [column-components.md](references/column-components.md)；联动列 / 批量录入 / 资源标签的坑见 [row-editing-pitfalls.md](references/row-editing-pitfalls.md)。

### 第 2.5 步：注册详情类型 + 实现单据详情页

**详情类型**：`src/services/model/ticket/details/oracle/` 下新建 `<ticketType 驼峰>.ts`（如 `oracleAddSlave.ts`），`interface XxxXxx extends ResourcePoolDetailBase`，字段对齐后端详情协议；在 `oracle/index.ts` 导出，经 `ticket.ts` 的 `export type * as Oracle` 命名空间生效。提单页回填 `useTicketDetail<Oracle.oracleAddSlave>`、详情页 Props `TicketModel<Oracle.oracleAddSlave>` 均引用它。

**详情组件**：`src/views/ticket-center/common/ticket-detail/components/task-info/com-factory/oracle/YourNewType.vue`，结构：`InfoList`/`InfoItem`（页级信息）+ `TicketInfoTable`/`TicketInfoTableColumn`（行级表格）。**详情页列必须与提单页实际实现保持一致（列集合、列序、显隐逻辑），不照搬原型图**。完整约定见 [ticket-detail.md](references/ticket-detail.md)。

### 第 3 步：注册路由

文件：`src/views/db-manage/oracle/routes.ts`

```typescript
const { createRouteItem } = createToolboxRoute(DBTypes.ORACLE);

createRouteItem(TicketTypes.ORACLE_YOUR_NEW_TYPE, t('功能名称'));
```

`createToolboxRoute` 自动设置 `fullscreen: true`、`hideTitle: true`、`ticketType` meta，组件路径自动推导为 `@views/db-manage/oracle/${ticketType}/Index.vue`。`dbConsole` 可选（工具箱菜单页统一跳转，单页路由可不带）。

### 第 4 步：注册单据详情页

组件通过 `import.meta.glob` 自动注册，`defineOptions` 的 `name` 必须与 `TicketTypes` 枚举值一致。**每个独立的 ticket_type 创建独立的详情页**。

### 第 5 步：添加工具箱菜单

文件：`src/views/db-manage/oracle/toolbox/toolboxMenuList.ts`

```typescript
{
  desc: t('功能描述'),
  id: TicketTypes.ORACLE_YOUR_NEW_TYPE,
  name: t('功能名称'),
},
```

完成后同步更新 [ticket-inventory.md](references/ticket-inventory.md)。

---

## 核心 Hook 与工具函数

### useCreateTicket

```typescript
const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<{
  // 内联提交 payload 类型，只描述实际提交的 details 结构
}>(TicketTypes.ORACLE_YOUR_NEW_TYPE);
createTicketRun({ details: { /* ... */ }, ...formData.payload });
```

内置行为：成功后显示消息（含「查看详情」链接）、原地清空可继续提单、重复单据弹确认框、失败按行级错误回填。

**泛型规范**：泛型用**内联的提交 payload 类型**（只描述实际提交的 `details` 结构），禁止复用详情类型（`Oracle.Xxx` 继承 `ResourcePoolDetailBase`，含 `clusters`/`specs` 等仅后端返回的字段，提单不传，类型不匹配报红）。禁止抽独立 `SubmitDetails` interface 再引用（用户约定：能内联就内联）。

### useTicketDetail

```typescript
useTicketDetail<Oracle.YourNewType>(TicketTypes.ORACLE_YOUR_NEW_TYPE, {
  onSuccess(ticketDetail) { /* 从 details 映射回 formData */ },
});
```

自动从 `route.query.ticketId` 获取单据 ID，仅当 `ticket_type` 匹配时触发回填。**回填泛型用详情类型**（与 `useCreateTicket` 相反），`Oracle.YourNewType` 需在第 2.5 步注册。

**回填完整度自查**：提单页有的每一列，回填都必须有对应赋值。高频遗漏：资源标签（`labels` 配合 `label_names` 组装）、规格（`spec_id`）。`clusters` 用可选链兜底（`clusters?.[id]?.immute_domain || ''`）。

**回填期间防模式切换误清**：回填赋值会触发模式 watch（如切换 mode 清空表格），用 `isApplying` 标志位包裹赋值，`nextTick` 后复位。见 [row-editing-pitfalls.md](references/row-editing-pitfalls.md)。

### createToolboxRoute

```typescript
const { createRouteItem } = createToolboxRoute(DBTypes.ORACLE);
createRouteItem(ticketType, navName, { dbConsole?: string });
```

自动生成 `path`、`name`、`component`（懒加载）、`meta`（含 `ticketType`、`fullscreen: true`、`hideTitle: true`）。

### 类型检查环境说明

`yarn type-check`（`vue-tsc --build`）在当前环境**跑不了**：`tsconfig.json` 的 `ignoreDeprecations: "6.0"` 与本机 TS 5.9.3 不兼容报 TS5103，且默认堆内存不足会 OOM。替代方案：

```powershell
node --max-old-space-size=8192 node_modules/vue-tsc/bin/vue-tsc.js -p tsconfig.check.json --noEmit
```

日志中可能存在与本次改动无关的存量报错，以「改动文件相关报错清零」为通过标准，必要时用 `git stash` 对比基线。**跑校验命令前先经用户确认**。

---

## 编码约定

### 导入规则

- `vue` / `vue-router` API 已 auto-import，不要显式 import `ref`、`computed`、`watch`、`useRouter`、`useRoute`、`nextTick`
- `useI18n`、`useTemplateRef`、`reactive` 必须显式 import
- 类型导入遵守 `verbatimModuleSyntax`：`import type { Oracle } from '@services/model/ticket/ticket';` 与 `import type TicketModel from '@services/model/ticket/ticket';` 拆两行写（合并写报 TS1363）
- 路径别名优先：`@services/*`、`@common/const`、`@views/*`、`@hooks`、`@utils`、`@components/*`
- `CardCheckbox` 从 `@components/db-card-checkbox/CardCheckbox.vue` 导入

### 组件命名

- 页面 `defineOptions({ name })` 设为 `TicketTypes.ORACLE_XXX`
- 详情页 `defineOptions({ name: TicketTypes.ORACLE_XXX, inheritAttrs: false })`
- 目录名 kebab-case，入口固定 `Index.vue`，仅本组件使用的子文件放同级 `components/`；**无复用价值的列不抽子组件**（`ClusterColumn` 教训：单行只读反查列内联到 `Index.vue` 用 `EditableBlock` 即可）

### 间距约定

- `BkAlert` 加 `class="mb-20"`
- `BatchInput` 下方紧跟的 `BkForm` 或 `EditableTable` 必须加 `class="mt-16"`
- `EditableTable` 加 `class="mb-20"`
- `CardCheckbox` 多个卡片之间用 `class="ml-8"` 间隔

### 数据模式

- `formData` 用 `reactive`，不用 `ref`
- `tableRef` 用 `useTemplateRef('tableRef')`
- `tableKey` 用 `ref(random())`，批量录入清空时 `tableKey.value = random()` 强制重渲染
- 行数据通过 `createTableRow(data?)` 工厂创建，协议字段工厂放同级 `types.ts`（如 `createUpstreamInstance` / `buildHostInfo`），缺省字段统一兜底默认值
- 表单默认值通过 `defaultData()` 工厂创建

### 提交数据映射

- 表格行字段名用驼峰（前端），提交时转为下划线（后端）
- `ip` + `port` → `instance_address: '${ip}:${port}'`；回填反向拆分时无 port 存量单据仅取 ip
- `ip_source` 固定为 `'resource_pool'`（资源池场景）
- `db_version` 后端要求前端拼接：`Oracle-${实例版本号}`（回填时 `replace(/^Oracle-/, '')` 还原）
- `resource_spec` 双字段：`labels` 传标签 id 字符串列表（`String(label.id)`），`label_names` 传标签名列表（`label.value`）
- 协议主机要素（`old_node`/`old_master` 等）：用 `buildHostInfo` 工厂组装，缺省字段按默认值兜底，不手写对象字面量

### 国际化

所有文案走 `t()`，语言包在 `src/locales/`。`routes.ts` 和 `toolboxMenuList.ts` 中的 `t()` 从 `@locales/index` 导入。

### 版权头

新建 `.vue` / `.ts` 文件带 MIT 版权头，照抄同目录已有文件的头部。

---

## 实现检查清单

- [ ] **TAPD 需求已拉取**：`stories_get` 获取需求详情，`description` 字段已分析
- [ ] **原型图已预览**：下载 HTML 并 `web_preview` 预览，UI 结构已分析
- [ ] **单据类型数量已与后端确认**：每个独立 `ticket_type` 都注册了独立枚举值和独立页面，枚举值后端真实存在
- [ ] **TicketType 常量已注册**：在 `ticketTypes.ts` 中添加，与后端一致
- [ ] **页面组件已创建**：含 MIT 版权头，`defineOptions` name 设为 `TicketTypes` 枚举值
- [ ] **BkAlert title 文案从原型图获取**：放在 `SmartAction` 内第一个元素位置
- [ ] **CardCheckbox title/desc 文案从原型图获取**：禁止自行编造
- [ ] **模式选择正确**：同一 ticket_type 内子类型用页级 `BkFormItem` + `CardCheckbox`；无独立 ticket_type 的第二模式（Oracle 无双 ticket_type 共用页面）
- [ ] **协议样例已核对**：提交体与 `cypress/fixtures/oracle/<TICKET_TYPE>/createTicket.json` 结构一致
- [ ] **`useCreateTicket` 泛型是内联提交类型**：禁止复用 `Oracle.Xxx` 详情类型，禁止抽独立 SubmitDetails interface
- [ ] **`useTicketDetail` 泛型是详情类型**：`Oracle.Xxx` 已在 `services/model/ticket/details/oracle/` 注册并从 `oracle/index.ts` 导出
- [ ] **回填完整度**：提单页每一列在回填里都有对应赋值（重点自查资源标签 `labels`+`label_names` 组装、规格 `spec_id`）
- [ ] **回填防误清**：模式切换 watch 有 `isApplying` 守卫，回填赋值不触发清空
- [ ] **`clusters`/`specs` 可选链兜底**：`details.clusters?.[id]?.immute_domain || '--'`、`details.specs?.[spec_id]?.name || ''`
- [ ] **`BatchInput` 下方加 `mt-16`**：紧跟的 `BkForm` 或 `EditableTable` 必须加
- [ ] **`OperationColumn` 已包含**：行操作列必须存在
- [ ] **`TicketPayload` 已包含**：备注表单项必须存在
- [ ] **路由已注册**：`routes.ts` 中 `createRouteItem(DBTypes.ORACLE)`
- [ ] **详情类型已注册**：`services/model/ticket/details/oracle/` 新建类型文件并导出
- [ ] **单据详情页已创建**：`com-factory/oracle/YourType.vue`，`name` 与 `TicketTypes` 一致，Props 用 `TicketModel<Oracle.Xxx>` 强类型
- [ ] **详情页与提单页一致**：列集合、列序、显隐逻辑照搬提单页实现，未照搬原型图
- [ ] **`defineExpose({ routerBack })`**：返回 `OracleToolboxIndex`
- [ ] **工具箱菜单已添加**：`toolboxMenuList.ts` 中注册，含 `desc` 描述
- [ ] **`ticket-inventory.md` 已更新**：新单据的模式与特殊组件已登记
- [ ] **批量录入配置**：`batchInputConfig` 的 `key` 与后端字段名一致
- [ ] **重置功能**：`handleReset` 调用 `defaultData()` 重置表单
- [ ] **国际化**：所有文案走 `t()`，无硬编码中文
- [ ] **类型安全**：`useCreateTicket<T>` 内联泛型与 `useTicketDetail<T>` 详情泛型已正确指定
- [ ] **类型导入规范**：`import type` 拆行写，遵守 `verbatimModuleSyntax`
- [ ] **ESLint 通过**：`npx eslint <改动文件> --fix` 通过（跑前经用户确认）
