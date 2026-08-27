---
name: mysql-toolbox
description: >-
  MySQL 工具箱提单页的完整实现指南，涵盖 TAPD 需求拉取、原型图预览、目录结构、路由注册、
  页面组件、列组件清单（含目标集群列模式）、单据详情页、工具箱菜单、提交流程与编辑回填的编码模式与约定。
  新建或修改 MySQL 工具箱提单页（MYSQL_xxx 类单据）、添加工具箱菜单项、
  注册单据详情页时使用，或当用户询问工具箱提单流程、可编辑表格列组件用法、
  createToolboxRoute / useCreateTicket / useTicketDetail 的使用方式时使用。
---

# MySQL 工具箱提单实现指南

本 skill 沉淀 MySQL 工具箱提单页的完整编码模式，基于 `src/views/db-manage/mysql/` 下已有工具箱的真实代码提炼。

**动手前先通读本文件**，实现时按「实现检查清单」逐条核对。

---

## 第 0 步：TAPD 需求与原型图获取（必做）

实现任何新工具箱前，**必须先从 TAPD 获取需求详情和附件**，确保实现与产品意图一致。

### 0.1 拉取 TAPD 需求详情

使用 TAPD MCP 的 `stories_get` 工具，传入 `workspace_id`（从 `agent-flow.config.json` 的 `projectId` 获取）和需求 ID。

重点关注 `description` 字段中的：单据标识（ticket_type 值、单据名称）、工具页录入规范（列序、必填、通配、批量录入字段对齐）、页级表单项、提交校验规则、单据详情展示要求、验收标准。

### 0.2 获取并预览原型图

TAPD 需求大概率包含 HTML 原型图附件。流程：

1. 调用 `get_attachment_info`（`type=story`）获取附件列表
2. 对 `.html` 附件调用 `get_attachment_download_url` 获取下载链接
3. 用 `Invoke-WebRequest -Uri <url> -OutFile <workspace>/prototype.html` 下载到工作区
4. 用 `web_preview`（`previewMode=static`）预览原型页面
5. 读取 HTML 源码，分析 UI 结构：模式选择组件类型、表格列序与列内控件、批量录入弹窗格式、侧滑结构、单据详情展示列序

**原型图是产品意图的最权威参考**。以下文案必须从原型图 HTML 中提取原文，禁止自行编造：

- BkAlert 的 `title`（顶部提示文案）
- CardCheckbox 的 `title`、`desc`（模式选择卡片文案）
- BkRadioGroup 各选项的 label 和显示文本
- 批量录入弹窗的示例文本和字段标签
- 表格列头文本

### 0.3 确认单据类型数量

仔细阅读 TAPD 需求，确认需求涉及的是**一个单据类型还是多个独立单据类型**。

- 如果需求描述了多种模式/方式，且每种模式对应**独立的 ticket_type**，则应为每种模式创建**独立的工具箱页面**（各自 `Index.vue`）
- 判断依据：后端是否为每种模式分配了不同的 `ticket_type` 枚举值
- **严禁将多个独立 ticket_type 合并到一个共用页面中用 CardCheckbox/BkTab 切换**——每个 ticket_type 必须有自己的 `Index.vue`

### 0.4 对照项目 UI 规范

原型图展示了产品意图，落地时需对照项目已有组件：

- **模式选择（迁移方式等）**：项目标准用 `CardCheckbox`（`@components/db-card-checkbox/CardCheckbox.vue`），参见 `MYSQL_ROLLBACK/Index.vue`
- **单选表单项**：用 `BkRadioGroup` + `BkRadio`（非 `BkRadioButton`，除非原型明确要求按钮组样式）
- **表格**：`EditableTable` + `EditableRow` + 列组件
- **侧滑**：`BkSideslider`
- **批量录入**：`BatchInput`

---

## 页面模式

MySQL 工具箱有 6 种已验证的页面模式，新工具箱必须归入其中一种。

### 模式 A：标准可编辑表格型（最常见）

`MYSQL_ADD_SLAVE`、`MYSQL_CHECKSUM`、`MYSQL_PROXY_ADD` 等 80% 的工具箱使用此模式。

结构：`SmartAction` > `BkAlert` + `BatchInput` + `BkForm` > `EditableTable` + `TicketPayload`，底部 `#action` 提交 + 重置。

**当 `BatchInput` 存在时，其下方的 `BkForm` 或 `EditableTable` 必须加 `class="mt-16"`**：

```vue
<BatchInput :config="batchInputConfig" @change="handleBatchInput" />
<BkForm class="mt-16 mb-20" form-type="vertical" :model="formData">
  <EditableTable ... />
</BkForm>
```

参考：`MYSQL_ADD_SLAVE/Index.vue`、`MYSQL_DATA_MIGRATE/Index.vue`。

### 模式 B：多步骤向导型

`MYSQL_IMPORT_SQLFILE` 使用此模式。入口 `Index.vue` 根据 `route.params.step` 动态渲染 `steps/step1`、`step2`、`step3`，路由需带 `{ params: '/:step?' }`。

### 模式 C：子类型选择型

`MYSQL_FLASHBACK` 使用 `BkRadioGroup`；`MYSQL_ROLLBACK` 使用 `CardCheckbox` 选择回档方式。仅适用于**同一 ticket_type 内**的子类型选择，通过 `<Component :is="comMap[type]" />` 或 `v-if` 条件渲染不同列。

**注意**：如果不同模式对应不同的 ticket_type，必须使用模式 F（跨页 Wrapper 导航型），不能用模式 C。

### 模式 D：Wrapper + 子组件型

`MYSQL_HA_TRUNCATE_DATA` 使用此模式。入口 `Index.vue` 只做 `useTicketDetail` 回填代理，实际表单在子目录组件中。

### 模式 E：公共组件复用型

`MYSQL_HA_APPLY`、`MYSQL_SINGLE_APPLY` 使用此模式。入口直接渲染 `<Apply />`（来自 `common/apply/`）。

### 模式 F：跨页 Wrapper 导航型

适用于多个独立 ticket_type 共享同一概念（如"迁移方式"），但每种方式是独立 ticket_type、各自有独立 `Index.vue` 的场景。

**参考实现**：`MYSQL_FIXPOINT_EXIST_CLUSTER`（构造：已有集群 / 新集群跨页切换）

#### 核心思路

创建一个 **Wrapper 组件**（类似 `FixpointWrapper.vue`），包含两个页面共享的元素：

1. `BkAlert`（顶部提示，文案从原型图获取）
2. `BkForm` 内放模式选择的 `CardCheckbox` 或 `BkRadioGroup`，切换时 `router.push` 到对方路由
3. `<slot />` 供各页面放入自己的 `SmartAction` 内容

每个 `Index.vue` 用 `<Wrapper>` 包裹 `<SmartAction>`，不再各自重复 BkAlert 和模式选择代码。

#### Wrapper 组件模板

参考 `MYSQL_FIXPOINT_EXIST_CLUSTER/components/FixpointWrapper.vue`：

```vue
<template>
  <div class="db-toolbox">
    <!-- 1. BkAlert：第一个元素，文案从原型图获取 -->
    <BkAlert
      class="mb-20"
      closable
      :title="t('DTS 数据迁移：按库表将数据从源集群迁到目标集群，一行对应一对源与目标。同名迁移目标库与源库同名，库表支持通配；库改名迁移按整库指定目标库名。库级克隆请使用「MySQL DB 数据克隆」')" />
    <!-- 2. BkForm：模式选择 + slot -->
    <BkForm
      class="mb-24 toolbox-form"
      form-type="vertical"
      :model="formData">
      <BkFormItem
        :label="t('迁移方式')"
        required>
        <CardCheckbox
          v-model="formData.migrateMethod"
          :desc="t('目标库与源库同名，支持按库表筛选和通配')"
          icon="bk-dbm-icon db-icon-copy"
          :title="t('同名迁移')"
          true-value="MYSQL_DTS_DATA_MIGRATE" />
        <CardCheckbox
          v-model="formData.migrateMethod"
          class="ml-8"
          :desc="t('逐库指定目标库名，按整库迁移')"
          icon="bk-dbm-icon db-icon-edit"
          :title="t('库改名迁移')"
          true-value="MYSQL_DTS_DATA_MIGRATE_RENAME" />
      </BkFormItem>
      <!-- 3. slot：各页面放入 SmartAction -->
      <slot />
    </BkForm>
  </div>
</template>

<script lang="ts" setup>
  import { useI18n } from 'vue-i18n';

  import { TicketTypes } from '@common/const';

  import CardCheckbox from '@components/db-card-checkbox/CardCheckbox.vue';

  const { t } = useI18n();
  const router = useRouter();
  const route = useRoute();

  const formData = reactive({
    migrateMethod: (route.meta.ticketType as TicketTypes) || TicketTypes.MYSQL_DTS_DATA_MIGRATE,
  });

  watch(
    () => formData.migrateMethod,
    (val) => {
      if (val !== route.meta.ticketType) {
        router.push({ name: val });
      }
    },
  );
</script>
```

#### Index.vue 模板（使用 Wrapper）

```vue
<template>
  <DtsMigrateWrapper>
    <SmartAction>
      <BatchInput :config="batchInputConfig" @change="handleBatchInput" />
      <EditableTable
        :key="tableKey"
        ref="tableRef"
        class="mt-16 mb-20"
        :model="formData.tableData">
        <EditableRow v-for="(item, index) in formData.tableData" :key="index">
          <!-- 列组件 -->
        </EditableRow>
      </EditableTable>
      <!-- 页级表单项 -->
      <BkFormItem :label="t('数据冲突处理')" required>
        <BkRadioGroup v-model="formData.conflictHandle">
          <BkRadio label="overwrite">{{ t('覆盖旧数据') }}</BkRadio>
          <BkRadio label="keep">{{ t('保留旧数据') }}</BkRadio>
          <BkRadio label="error">{{ t('报错并停止') }}</BkRadio>
        </BkRadioGroup>
      </BkFormItem>
      <TicketPayload v-model="formData.payload" />
      <template #action>
        <BkButton class="mr-8 w-88" :loading="isSubmitting" theme="primary" @click="handleSubmit">
          {{ t('提交') }}
        </BkButton>
        <DbResetButton class="ml-8" :confirm-handler="handleReset" :disabled="isSubmitting" />
      </template>
    </SmartAction>
  </DtsMigrateWrapper>
</template>
```

关键点：

- Wrapper 放在其中一个 ticket_type 的 `components/` 目录下（如 `MYSQL_DTS_DATA_MIGRATE/components/DtsMigrateWrapper.vue`），另一个页面通过 `@views/...` 别名导入
- `BkAlert` 和模式选择代码只写一次（在 Wrapper 中），不在每个 Index.vue 重复
- `EditableTable` 直接在 `SmartAction` 内（Wrapper 的 `BkForm` 通过 slot 包裹），不需要额外包一层 `BkForm`
- `BatchInput` 下方的 `EditableTable` 加 `class="mt-16 mb-20"`
- 模式切换通过 `route.meta.ticketType` 判断当前页，`watch` 监听变化时 `router.push`
- `CardCheckbox` 的 `title`、`desc`、`BkAlert` 的 `title` 必须从原型图提取原文

---

## 实现步骤

### 第 1 步：注册 TicketType 常量

文件：`src/common/const/ticketTypes.ts`

```typescript
export enum TicketTypes {
  MYSQL_YOUR_NEW_TYPE = 'MYSQL_YOUR_NEW_TYPE',
}
```

命名规则：`MYSQL_` 前缀 + 全大写下划线分隔，枚举值必须与后端 `ticket_type` 完全一致。**每个独立的 ticket_type 都必须注册**。

### 第 2 步：创建页面组件

**每个独立的 ticket_type 创建独立的 `Index.vue`**。

文件：`src/views/db-manage/mysql/MYSQL_YOUR_NEW_TYPE/Index.vue`

核心结构（模式 A 标准型，保持顺序不变）：

```vue
<!-- MIT 版权头 -->
<template>
  <SmartAction>
    <!-- 1. 顶部提示条（SmartAction 内第一个元素，文案从原型图获取） -->
    <BkAlert class="mb-20" closable :title="t('业务说明文案')" />
    <!-- 2. 批量录入（可选） -->
    <BatchInput :config="batchInputConfig" @change="handleBatchInput" />
    <!-- 3. 表单（BatchInput 下方必须加 mt-16） -->
    <BkForm class="mt-16 mb-20" form-type="vertical" :model="formData">
      <!-- 4. 可编辑表格 -->
      <EditableTable :key="tableKey" ref="tableRef" class="mb-20" :model="formData.tableData">
        <EditableRow v-for="(item, index) in formData.tableData" :key="index">
          <!-- 首列：源集群 -->
          <ClusterColumn v-model="item.cluster" :selected="selected" @batch-edit="handleBatchEdit" />
          <!-- 非首列目标集群：用 TargetClusterColumn -->
          <TargetClusterColumn v-model="item.targetCluster" :cluster="item.cluster" :selected="selectedTargetClusters" />
          <!-- 操作列（必须） -->
          <OperationColumn v-model:table-data="formData.tableData" :create-row-method="createTableRow" />
        </EditableRow>
      </EditableTable>
      <!-- 5. 页级表单项（可选） -->
      <BkFormItem :label="t('数据冲突处理')" required>
        <BkRadioGroup v-model="formData.conflictHandle">...</BkRadioGroup>
      </BkFormItem>
      <!-- 6. 单据负载（必须） -->
      <TicketPayload v-model="formData.payload" />
    </BkForm>
    <!-- 7. 底部操作栏 -->
    <template #action>
      <BkButton class="mr-8 w-88" :loading="isSubmitting" theme="primary" @click="handleSubmit">{{ t('提交') }}</BkButton>
      <DbResetButton class="ml-8" :confirm-handler="handleReset" :disabled="isSubmitting" />
    </template>
  </SmartAction>
</template>
```

模式 F 的 Index.vue 结构见上方「模式 F」章节，用 `<Wrapper>` 包裹 `<SmartAction>`，BkAlert 和模式选择在 Wrapper 中。

#### script setup 核心结构

```typescript
defineOptions({ name: TicketTypes.MYSQL_YOUR_NEW_TYPE });

// --- 导入 ---
import { reactive, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import TendbhaModel from '@services/model/mysql/tendbha';
import type { Mysql } from '@services/model/ticket/ticket';
import { useCreateTicket, useTicketDetail } from '@hooks';
import { TicketTypes } from '@common/const';
import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
import OperationColumn from '@views/db-manage/common/toolbox-field/column/operation-column/Index.vue';
import TicketPayload, { createTicketPayload } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';
import ClusterColumn from '@views/db-manage/mysql/common/toolbox-field/cluster-column/Index.vue';
import { random } from '@utils';

// --- 类型定义 ---
interface RowData { cluster: TendbhaModel; /* ... */ }

// --- 基础设置 ---
const { t } = useI18n();
const router = useRouter();
const tableRef = useTemplateRef('tableRef');
const tableKey = ref(random());

// --- 行数据工厂 ---
const createTableRow = (data: DeepPartial<RowData> = {}) => ({ /* ... */ });

// --- 表单默认值工厂 ---
const defaultData = () => ({ payload: createTicketPayload(), tableData: [createTableRow()] });
const formData = reactive(defaultData());

// --- 计算属性 ---
const selected = computed(() => formData.tableData.filter(i => i.cluster.id).map(i => i.cluster));

// --- 编辑/克隆回填 ---
useTicketDetail<Mysql.YourNewType>(TicketTypes.MYSQL_YOUR_NEW_TYPE, {
  onSuccess(ticketDetail) {
    const { details } = ticketDetail;
    const { clusters, infos } = details;
    Object.assign(formData, {
      payload: createTicketPayload(ticketDetail),
      tableData: infos.map(item => createTableRow({
        cluster: { master_domain: clusters[item.cluster_id].immute_domain } as TendbhaModel,
      })),
    });
  },
});

// --- 提交 ---
const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<SubmitDetailsType>(TicketTypes.MYSQL_YOUR_NEW_TYPE);
const handleSubmit = async () => {
  const result = await tableRef.value!.validate();
  if (!result) return;
  createTicketRun({ details: { /* ... */ }, ...formData.payload });
};

// --- 重置 ---
const handleReset = () => { Object.assign(formData, defaultData()); };

// --- 批量编辑 ---
const handleBatchEdit = (list: TendbhaModel[]) => { /* ... */ };

// --- 批量录入 ---
const handleBatchInput = (data: Record<string, any>[], isClear: boolean) => { /* ... */ };

// --- 返回工具箱 ---
defineExpose({ routerBack() { router.push({ name: 'MysqlToolboxIndex' }); } });
```

### 第 3 步：注册路由

文件：`src/views/db-manage/mysql/routes.ts`

```typescript
const { createRouteItem } = createToolboxRoute(DBTypes.MYSQL);

createRouteItem(TicketTypes.MYSQL_YOUR_NEW_TYPE, t('功能名称'), { dbConsole: 'mysql.toolbox.yourFeature' });
```

`createToolboxRoute` 自动设置 `fullscreen: true`、`hideTitle: true`、`ticketType` meta，组件路径自动推导为 `@views/db-manage/mysql/${ticketType}/Index.vue`。**每个独立的 ticket_type 注册独立路由**。

### 第 4 步：注册单据详情页

文件：`src/views/ticket-center/common/ticket-detail/components/task-info/com-factory/mysql/YourNewType.vue`

组件通过 `import.meta.glob` 自动注册，`defineOptions` 的 `name` 必须与 `TicketTypes` 枚举值一致。**每个独立的 ticket_type 创建独立的详情页**。

### 第 5 步：添加工具箱菜单

文件：`src/views/db-manage/mysql/toolbox/toolboxMenuList.ts`

```typescript
{
  dbConsoleValue: 'mysql.toolbox.yourFeature',
  desc: t('功能描述'),
  id: TicketTypes.MYSQL_YOUR_NEW_TYPE,
  name: t('功能名称'),
},
```

**每个独立的 ticket_type 添加独立的菜单项**。

---

## 列组件清单

### MySQL 专属列组件

路径前缀：`@views/db-manage/mysql/common/toolbox-field/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `ClusterColumn` | `cluster-column/Index.vue` | **首列**源集群选择，支持 `cluster-types`、`allow-repeat`、`selected` |
| `DbNameColumn` | `db-name-column/Index.vue` | DB 名输入，支持 `cluster-id` 联动、`check-not-exist`（校验 DB 是否在集群中不存在）、`field` |
| `TableNameColumn` | `table-name-column/Index.vue` | 表名输入，同 DbNameColumn 接口 |
| `TargetClusterColumn` | `target-cluster-column/Index.vue` | **非首列**目标集群选择（单目标），见下方详解 |
| `MultipleClusterColumn` | `multiple-cluster-column/Index.vue` | 多集群选择 |
| `WithRelatedClustersColumn` | `with-related-clusters-column/Index.vue` | 集群选择（含关联集群） |

### 目标集群列组件（TargetClusterColumn）

当表格中需要选择**目标集群**（非首列的源集群）时，**不能直接用 `ClusterColumn`**，应使用 `TargetClusterColumn`。

**参考实现**：`MYSQL_FIXPOINT_EXIST_CLUSTER/components/target-cluster-column/Index.vue`（原始实现），`@views/db-manage/mysql/common/toolbox-field/target-cluster-column/Index.vue`（已提取的公共版本）

特征：

- `EditableInput` + `#append` 插槽放 `DbIcon`（`type="host-select"`）触发 `ClusterSelector`
- `ClusterSelector` 支持 `TENDBHA` + `TENDBSINGLE`，`multiple: false`
- `disabledRowConfig` 排除源集群（提示「不能选择源集群」）
- `disabledMethod`：源集群未选时禁用目标集群列，提示「请先选择源集群」
- 手动输入域名时清空 `id`，通过 `watch` + `filterClusters` API 自动查询补全
- 校验规则：域名格式（`domainRegex`）、目标集群重复、目标集群不存在

Props：

```typescript
interface Props {
  cluster: { id: number; master_domain: string };  // 源集群信息
  field?: string;           // 默认 'target_cluster.master_domain'
  selected: { id: number; master_domain: string }[]; // 已选目标集群（去重校验）
  sourceField?: string;     // 默认 'source_cluster'，用于 disabledMethod 判断
}
```

**复用决策**：

1. 优先使用公共版本 `@views/db-manage/mysql/common/toolbox-field/target-cluster-column/Index.vue`
2. 如需定制（多目标集群等），在当前单据 `components/` 下独立实现，参考 `MYSQL_DATA_MIGRATE/components/TargetClusterColumn.vue`

### 跨库通用列组件

路径前缀：`@views/db-manage/common/toolbox-field/column/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `OperationColumn` | `operation-column/Index.vue` | 行操作列（增删行），**必须包含** |
| `SpecColumn` | `spec-column/Index.vue` | 规格选择 |
| `ResourceTagColumn` | `resource-tag-column/Index.vue` | 资源标签 |
| `AvailableResourceColumn` | `available-resource-column/Index.vue` | 可用资源展示 |
| `MultipleResourceHostColumn` | `multiple-resource-host-column/Index.vue` | 多主机选择 |
| `SingleResourceHostColumn` | `single-resource-host-column/Index.vue` | 单主机选择 |
| `DbTableNameColumn` | `db-table-name-column/Index.vue` | DB + 表名组合输入 |

### 跨库通用表单项

路径前缀：`@views/db-manage/common/toolbox-field/form-item/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `TicketPayload` | `ticket-payload/Index.vue` | 备注输入，**必须包含**，导出 `createTicketPayload` 工厂函数 |
| `BackupSource` | `backup-source/Index.vue` | 备份源选择（本地/远程） |

### 模式选择组件

路径：`@components/db-card-checkbox/CardCheckbox.vue`

用于回档方式、迁移方式等卡片式单选。参考 `MYSQL_ROLLBACK/Index.vue`。Props：`modelValue`、`true-value`、`icon`、`title`、`desc`。

---

## 核心 Hook 与工具函数

### useCreateTicket

```typescript
const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<SubmitDetailsType>(
  TicketTypes.MYSQL_YOUR_NEW_TYPE,
);
createTicketRun({ details: { /* ... */ }, ...formData.payload });
```

内置行为：成功后显示消息（含「查看详情」链接）、原地清空可继续提单、重复单据弹确认框、失败按行级错误回填。

### useTicketDetail

```typescript
useTicketDetail<Mysql.YourNewType>(TicketTypes.MYSQL_YOUR_NEW_TYPE, {
  onSuccess(ticketDetail) { /* 从 details 映射回 formData */ },
});
```

自动从 `route.query.ticketId` 获取单据 ID，仅当 `ticket_type` 匹配时触发回填。

### createToolboxRoute

```typescript
const { createRouteItem } = createToolboxRoute(DBTypes.MYSQL);
createRouteItem(ticketType, navName, { dbConsole?: string });
```

自动生成 `path`、`name`、`component`（懒加载）、`meta`（含 `ticketType`、`fullscreen: true`、`hideTitle: true`）。

---

## 编码约定

### 导入规则

- `vue` / `vue-router` API 已 auto-import，不要显式 import `ref`、`computed`、`watch`、`useRouter`、`useRoute`
- `useI18n`、`useTemplateRef`、`reactive` 必须显式 import
- 路径别名优先：`@services/*`、`@common/const`、`@views/*`、`@hooks`、`@utils`、`@components/*`
- `CardCheckbox` 从 `@components/db-card-checkbox/CardCheckbox.vue` 导入

### 组件命名

- 页面 `defineOptions({ name })` 设为 `TicketTypes.MYSQL_XXX`
- 详情页 `defineOptions({ name: TicketTypes.MYSQL_XXX, inheritAttrs: false })`
- 目录名 kebab-case，入口固定 `Index.vue`，仅本组件使用的子文件放同级 `components/`

### 间距约定

- `BkAlert` 加 `class="mb-20"`
- `BatchInput` 下方紧跟的 `BkForm` 或 `EditableTable` 必须加 `class="mt-16"`
- `EditableTable` 加 `class="mb-20"`
- `CardCheckbox` 多个卡片之间用 `class="ml-8"` 间隔
- 模式 F 的 Wrapper `BkForm` 加 `class="mb-24 toolbox-form"`

### 列禁用约定

- **未选择源集群时，其他所有依赖源集群的列应被禁用**，提示「请先选择源集群」
- `DbNameColumn` / `TableNameColumn`：设置 `check-not-exist` 时，组件内置 `disabledMethod` 在 `clusterId` 为空时自动禁用
- `TargetClusterColumn`：通过 `disabledMethod` 在源集群 `id` 为空时禁用
- 自定义列组件通过 `EditableColumn` 的 `:disabled-method` prop 实现条件禁用

### 库表存在校验约定

- **源 DB / 源表列应校验在源集群中是否存在**：传 `check-not-exist` prop，DB/表在集群中不存在时校验失败
- **忽略 DB / 忽略表列不需要校验存在性**
- 通配符 `*` `%` `?` 不参与存在校验

### 数据模式

- `formData` 用 `reactive`，不用 `ref`
- `tableRef` 用 `useTemplateRef('tableRef')`
- `tableKey` 用 `ref(random())`，批量录入清空时 `tableKey.value = random()` 强制重渲染
- 行数据通过 `createTableRow(data?)` 工厂创建
- 表单默认值通过 `defaultData()` 工厂创建

### 提交数据映射

- 表格行字段名用驼峰（前端），提交时转为下划线（后端）
- `cluster.id` → `cluster_id`
- `ip` + `port` → `instance_address: '${ip}:${port}'`
- `ip_source` 固定为 `'resource_pool'`（资源池场景）

### 国际化

所有文案走 `t()`，语言包在 `src/locales/`。`routes.ts` 和 `toolboxMenuList.ts` 中的 `t()` 从 `@locales/index` 导入。

### 版权头

新建 `.vue` / `.ts` 文件带 MIT 版权头，照抄同目录已有文件的头部。

---

## 实现检查清单

- [ ] **TAPD 需求已拉取**：`stories_get` 获取需求详情，`description` 字段已分析
- [ ] **原型图已预览**：下载 HTML 并 `web_preview` 预览，UI 结构已分析
- [ ] **单据类型数量已确认**：需求涉及的每个独立 `ticket_type` 都注册了独立枚举值和独立页面
- [ ] **每个 ticket_type 有独立 `Index.vue`**：不共用页面
- [ ] **TicketType 常量已注册**：在 `ticketTypes.ts` 中添加，与后端一致
- [ ] **页面组件已创建**：含 MIT 版权头，`defineOptions` name 设为 `TicketTypes` 枚举值
- [ ] **BkAlert title 文案从原型图获取**：放在 `SmartAction` 内第一个元素位置（模式 F 放在 Wrapper 内第一个元素）
- [ ] **模式选择正确**：同一 ticket_type 内子类型用 `CardCheckbox`（模式 C）；多 ticket_type 跨页切换用 Wrapper + `CardCheckbox` + `router.push`（模式 F），参考 `MYSQL_FIXPOINT_EXIST_CLUSTER`
- [ ] **CardCheckbox title/desc 文案从原型图获取**：禁止自行编造
- [ ] **页级单选表单项**：用 `BkRadioGroup` + `BkRadio`
- [ ] **`BatchInput` 下方加 `mt-16`**：紧跟的 `BkForm` 或 `EditableTable` 必须加
- [ ] **非首列集群选择用 `TargetClusterColumn`**：参考 `MYSQL_FIXPOINT_EXIST_CLUSTER/components/target-cluster-column/Index.vue`
- [ ] **库表存在校验**：源 DB / 源表列传 `check-not-exist`
- [ ] **列禁用**：未选源集群时，依赖源集群的列被禁用提示「请先选择源集群」
- [ ] **路由已注册**：`routes.ts` 中 `createRouteItem`，每个 ticket_type 独立路由
- [ ] **单据详情页已创建**：`com-factory/mysql/YourType.vue`，`name` 与 `TicketTypes` 一致
- [ ] **`OperationColumn` 已包含**：行操作列必须存在
- [ ] **`TicketPayload` 已包含**：备注表单项必须存在
- [ ] **`useCreateTicket` 提交**：`details` 与后端 API 协议一致
- [ ] **`useTicketDetail` 回填**：编辑/克隆场景的表单回填已实现
- [ ] **`defineExpose({ routerBack })`**：返回 `MysqlToolboxIndex`
- [ ] **工具箱菜单已添加**：`toolboxMenuList.ts` 中注册，含 `desc` 描述
- [ ] **批量录入配置**：`batchInputConfig` 的 `key` 与后端字段名一致
- [ ] **重置功能**：`handleReset` 调用 `defaultData()` 重置表单
- [ ] **国际化**：所有文案走 `t()`，无硬编码中文
- [ ] **类型安全**：`useCreateTicket<T>` 和 `useTicketDetail<T>` 泛型已正确指定
- [ ] **eslint 通过**：`npx eslint <改动文件> --fix` 通过

---

## 现有 MySQL 工具箱清单

| TicketType | 中文名 | 模式 | 特殊组件 |
|------------|--------|------|----------|
| `MYSQL_ADD_SLAVE` | 添加从库 | A | `WithRelatedClustersColumn`、`MultipleResourceHostColumn`、`BackupSource` |
| `MYSQL_CHECKSUM` | 数据校验修复 | A | `MasterSlaveColumn`、`DbNameColumn`、`TableNameColumn` |
| `MYSQL_CLIENT_CLONE_RULES` | 客户端权限克隆 | A | `SourceColumn`、`TargetColumn` |
| `MYSQL_CLUSTER_STANDARDIZE` | 标准化 | A | - |
| `MYSQL_DATA_MIGRATE` | DB 数据克隆 | A | `TargetClusterColumn`（多目标）、`DataSchemaGrantColumn` |
| `MYSQL_DUMP_DATA` | 数据导出 | A | - |
| `MYSQL_DTS_DATA_MIGRATE` | DTS 同名迁移 | F | `DtsMigrateWrapper`、`TargetClusterColumn`（单目标）、`checkNotExist` 库表校验 |
| `MYSQL_DTS_DATA_MIGRATE_RENAME` | DTS 库改名迁移 | F | `DtsMigrateWrapper`、`TargetClusterColumn`（单目标）、`DbMappingSideslider` |
| `MYSQL_FIXPOINT_EXIST_CLUSTER` | 构造（已有集群） | F | `FixpointWrapper`、`target-cluster-column`、多个子列组件 |
| `MYSQL_FIXPOINT_NEW_CLUSTER` | 构造（新集群） | F | `FixpointWrapper` |
| `MYSQL_FLASHBACK` | 回档 | C | 子类型选择：`RECORD_FLASHBACK`、`TABLE_FLASHBACK` |
| `MYSQL_HA_APPLY` | 主从申请 | E | 复用 `common/apply` |
| `MYSQL_HA_DB_TABLE_BACKUP` | 库表备份 | A | - |
| `MYSQL_HA_FULL_BACKUP` | 全库备份 | A | `BackupLocalColumn` |
| `MYSQL_HA_TRUNCATE_DATA` | 清档（主从） | D | Wrapper + `truncate-data/` 子组件 |
| `MYSQL_IMPORT_SQLFILE` | 变更 SQL 执行 | B | 多步骤向导 `steps/step1-3` |
| `MYSQL_INSTANCE_CLONE_RULES` | DB 实例权限克隆 | A | `SourceColumn`、`TargetColumn` |
| `MYSQL_INSTANCE_FAIL_OVER` | 主库故障切换 | A | `MasterColumn`、`SlaveColumn` |
| `MYSQL_LOCAL_UPGRADE` | 版本升级（本地） | A | `CurrentVersionColumn`、`TargetVersionColumn`、`UpgradeWrapper` |
| `MYSQL_MASTER_FAIL_OVER` | 主库故障切换 | A | `MasterColumn`、`SlaveColumn` |
| `MYSQL_MASTER_SLAVE_SWITCH` | 主从互切 | A | `MasterColumn`、`SlaveColumn` |
| `MYSQL_MIGRATE_CLUSTER` | 迁移主从 | A | `cluster-migrate/`、`machine-migrate/` |
| `MYSQL_MIGRATE_SINGLE` | 单节点迁移 | A | `HostColumnGroup` + `instance-migrate/` |
| `MYSQL_MIGRATE_UPGRADE` | 版本升级（迁移） | A | `ReadonlyHostColumn` |
| `MYSQL_OPEN_AREA` | 开区模版 | A | `create/`、`template-create/` |
| `MYSQL_PROXY_ADD` | 添加 Proxy | A | `AddCountColumn`、`ProxyWrapper` |
| `MYSQL_PROXY_CONF_CHANGE` | Proxy 升降配 | A | - |
| `MYSQL_PROXY_MIGRATE` | 迁移 Proxy（按集群） | A | - |
| `MYSQL_PROXY_MIGRATE_INS` | 迁移 Proxy（按实例） | A | `InstanceColumnGroup` |
| `MYSQL_PROXY_REBUILD` | Proxy 原地重建 | A | `HostColumnGroup` |
| `MYSQL_PROXY_REDUCE` | 减少 Proxy | A | `HostColumn` |
| `MYSQL_PROXY_RESCUE` | Proxy 灾难重建 | A | `TargetCountColumn` |
| `MYSQL_PROXY_SWITCH` | 替换 Proxy | A | - |
| `MYSQL_PROXY_UPGRADE` | 版本升级（Proxy） | A | - |
| `MYSQL_RENAME_DATABASE` | DB 重命名 | A | - |
| `MYSQL_RESTORE_LOCAL_SLAVE` | 重建从库（本地） | A | - |
| `MYSQL_RESTORE_SLAVE` | 重建从库 | A | - |
| `MYSQL_ROLLBACK` | 回档（构造） | C | `CardCheckbox` 回档方式选择 |
| `MYSQL_ROLLBACK_CLUSTER` | 定点构造（旧） | A | `RollbackClusterColumn` |
| `MYSQL_SINGLE_APPLY` | 单节点申请 | E | 复用 `common/apply` |
| `MYSQL_SINGLE_TRUNCATE_DATA` | 清档（单节点） | D | Wrapper + `truncate-data/` |
