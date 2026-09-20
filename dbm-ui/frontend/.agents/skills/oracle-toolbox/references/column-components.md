# 列组件与表单项清单

## Oracle 专属列组件

路径前缀：`@views/db-manage/oracle/ORACLE_ADD_SLAVE/components/`（当前仅 ADD_SLAVE 有自研列，新单据的专属列放各自 `ORACLE_XXX/components/` 下）

| 组件 | 路径 | 用途 |
|------|------|------|
| `UpstreamInstanceColumn` | `UpstreamInstanceColumn.vue` | 上游实例输入列（`EditableInput` + `#headAppend` 批量选择图标触发 `InstanceSelector`）。Props：`mode`（single 时选单节点实例、master/slave 时选主从实例，决定候选集群类型与 `checkInstance` 的 `cluster_type`）、`selected`（已选实例列表，用于去重校验）。内置校验：IP:Port 格式、实例重复、实例存在（`checkInstance` 反查 `bk_host_id` 判定）。emit `batch-edit` 抛选择器选中列表 |
| `ReplicationSourceColumn` | `ReplicationSourceColumn.vue` | 复制源只读推导列（仅主库模式 `v-if` 显示）。Props：`clusterId`。`watch` clusterId 先清空再查 `getOracleHaInstanceList` 推导：running 从库取实例 ID 最小者（级联场景，同时记录主库与从库）；无从库时取主库。展示 `IP:Port` + 灰色角色小字（primary/standby）。**待 PEER 确认**：「正常」的判定字段（DG 应用无中断、延迟阈值），当前按 `status === 'running'` 推导 |

单行只读反查列（如所属集群域名）不抽子组件，直接在 `Index.vue` 内联：

```vue
<EditableColumn :label="t('所属集群')" :min-width="220" readonly>
  <EditableBlock :placeholder="t('自动生成')">
    {{ item.upstreamInstance.master_domain || '' }}
  </EditableBlock>
</EditableColumn>
```

## 跨库通用列组件

路径前缀：`@views/db-manage/common/toolbox-field/column/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `OperationColumn` | `operation-column/Index.vue` | 行操作列（增删行），**必须包含** |
| `SpecColumn` | `spec-column/Index.vue` | 规格选择，Props：`cluster-type`（传 `DBTypes.ORACLE`）、`selectable`、`required`，emit `batch-edit` |
| `ResourceTagColumn` | `resource-tag-column/Index.vue` | 资源标签，emit `batch-edit`（field 为 `labels`，注意映射到行字段，见 [row-editing-pitfalls.md](row-editing-pitfalls.md)） |
| `AvailableResourceColumn` | `available-resource-column/Index.vue` | 可用资源展示（辅助列，不参与提交，详情页不展示），见下方 params 说明 |

## 跨库通用表单项

路径前缀：`@views/db-manage/common/toolbox-field/form-item/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `TicketPayload` | `ticket-payload/Index.vue` | 备注输入，**必须包含**，导出 `createTicketPayload` 工厂函数（回填时传 `ticketDetail` 透传 remark） |

## 模式选择组件

路径：`@components/db-card-checkbox/CardCheckbox.vue`

Props：`modelValue`、`true-value`、`icon`、`title`、`desc`。页级使用时包在 `BkFormItem` 内，多个卡片用 `class="ml-8"` 间隔。

**注意**：CardCheckbox 仅用于同一 ticket_type 内的子类型切换（Oracle 无双 ticket_type 共用页面模式）。

## AvailableResourceColumn 的 params

`AvailableResourceColumn` 的 `params` 类型与 `ResourcePreviewSiderslider` 的 `params` 一致：

```typescript
interface Params {
  city?: string;
  subzones?: string[];
  for_bizs?: number[];
  resource_types?: string[];
  spec_id?: number;
  labels?: string; // 逗号分隔的标签 ID
}
```

典型用法：

```vue
<AvailableResourceColumn
  :params="{
    for_bizs: [currentBizId, 0],
    resource_types: [DBTypes.ORACLE, 'PUBLIC'],
    spec_id: item.specId,
    labels: item.resourceTags.map((tag) => tag.id).join(','),
  }" />
```
