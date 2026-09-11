# 列组件与表单项清单

## Oracle 专属列组件

路径前缀：`@views/db-manage/oracle/ORACLE_ADD_SLAVE/components/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `UpstreamInstanceColumn` | `UpstreamInstanceColumn.vue` | 上游实例输入（IP:Port + 弹窗选择器），包裹 `EditableInput` + `#append` 插槽放 `DbIcon` 触发 `BkSideslider` |
| `ClusterColumn` | `ClusterColumn.vue` | 所属集群反查列（只读），`EditableBlock` 内渲染 `cluster.master_domain` |
| `ReplicationSourceColumn` | `ReplicationSourceColumn.vue` | 复制源反查列（只读），仅主库模式显示；查询集群实例列表推导：正常从库取实例 ID 最小者，无从库/全异常取主库；展示 `IP:Port` + 灰色角色小字（primary/standby）。**待 PEER 确认**：①「正常」的判定字段（DG 应用无中断、延迟阈值），当前先按 `status === 'running'` 推导；② 实例 `role` 字段实际取值（假设 `primary` / `standby`，需对照后端接口）；③ 提交 payload 的 `copy_source_instance` / `copy_source_role` 字段名待后端协议确认 |

## 跨库通用列组件

路径前缀：`@views/db-manage/common/toolbox-field/column/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `OperationColumn` | `operation-column/Index.vue` | 行操作列（增删行），**必须包含** |
| `SpecColumn` | `spec-column/Index.vue` | 规格选择，Props：`cluster-type`、`selectable`、`required` |
| `ResourceTagColumn` | `resource-tag-column/Index.vue` | 资源标签 |
| `AvailableResourceColumn` | `available-resource-column/Index.vue` | 可用资源展示，见下方 params 说明 |

## 跨库通用表单项

路径前缀：`@views/db-manage/common/toolbox-field/form-item/`

| 组件 | 路径 | 用途 |
|------|------|------|
| `TicketPayload` | `ticket-payload/Index.vue` | 备注输入，**必须包含**，导出 `createTicketPayload` 工厂函数 |

## 模式选择组件

路径：`@components/db-card-checkbox/CardCheckbox.vue`

Props：`modelValue`、`true-value`、`icon`、`title`、`desc`。

## AvailableResourceColumn 的 params

`AvailableResourceColumn` 的 `params` 类型与 `ResourcePreviewSiderslider` 的 `params` 一致：

```typescript
interface Params {
  city?: string;
  subzones?: string;
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

## 双 ticket_type 共用页面

当原型图要求多个 ticket_type 共用同一页（通过 CardCheckbox 切换子类型，提交时动态选择 ticket_type）时使用。需要：

- 两个 `useCreateTicket` 实例（各自绑定不同 ticket_type）
- 两个 `useTicketDetail` 实例（各自监听不同 ticket_type 的回填）
- 提交时根据 `submitTicketType` 计算属性选择调用哪个 `run`

参考实现：`ORACLE_ADD_SLAVE/Index.vue`。
