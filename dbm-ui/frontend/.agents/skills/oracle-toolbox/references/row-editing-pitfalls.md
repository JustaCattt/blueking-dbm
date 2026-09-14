# 行编辑与回填易错点（Oracle）

基于 `ORACLE_ADD_SLAVE` 开发过程中实际踩过的坑沉淀。表格含联动列 / 批量录入 / 资源标签列时必读。

## 模式切换清空表格（联动防误清）

页内子类型（如 `formData.mode`）变化时通常要重置表格（列集合随模式变化，残留旧列数据会报错）。两个必须处理的点：

- **切换逻辑**：`watch(() => formData.mode, ...)` 里 `tableKey.value = random()` 强制重渲染 + `formData.tableData = [createTableRow()]`
- **回填守卫**：`useTicketDetail` 的 `onSuccess` 赋值 `formData.mode` 也会触发上面的 watch，把刚回填的 tableData 清掉。用 `isApplying` 标志位包裹：赋值前置 `true`，`nextTick` 后复位，watch 开头 `if (isApplying.value) return;`

```typescript
const isApplying = ref(false);

useTicketDetail(TicketTypes.ORACLE_XXX, {
  onSuccess(ticketDetail) {
    isApplying.value = true;
    Object.assign(formData, { mode: ..., tableData: ... });
    nextTick(() => {
      isApplying.value = false;
    });
  },
});

watch(
  () => formData.mode,
  () => {
    if (isApplying.value) {
      return;
    }
    tableKey.value = random();
    formData.tableData = [createTableRow()];
  },
);
```

## 批量录入去重规则

`appendRows(rows, isClear)` 统一承接批量录入与列批量填充的追加语义：

- `isClear = true`（批量录入弹窗点确认）：`tableKey` 重渲染 + 整表替换 `[...rows]`
- `isClear = false`（追加）：仅首行是空表单（首行主字段为空）时保留既有行 `[...keep, ...rows]`，否则整表替换——避免「首行手填一半 + 批量录入」时丢用户输入

列批量填充（表头批量编辑图标）的行集去重用 `Set`：按实例地址等唯一键过滤已在表格中的行。

## batch-edit 的 field 与行字段名映射

列组件 `@batch-edit` 抛出的 `field` 是协议字段名，与行数据字段名可能不一致，需要显式映射：

```typescript
// ResourceTagColumn 批量填充 field 为 labels，映射到行字段 resourceTags
const handleBatchEditColumn = (value: unknown, field: string) => {
  const targetField = field === 'labels' ? 'resourceTags' : field;
  formData.tableData.forEach((item) => {
    Object.assign(item, { [targetField]: value });
  });
};
```

## 资源标签回填组装

回填时 `resource_spec.oracle.labels` 是 id 列表、`label_names` 是名称列表，按序 zip 成 `{ id, value }[]` 回显：

```typescript
resourceTags: (item.resource_spec?.oracle?.labels || []).map((labelId: number, index: number) => ({
  id: Number(labelId),
  value: item.resource_spec?.oracle?.label_names?.[index] || '',
})),
```

提交时反向拆：`labels: tags.map((tag) => String(tag.id))`、`label_names: tags.map((tag) => tag.value)`。

## 上游实例的两种进入路径

- **选择器选择**：`InstanceSelector` 返回完整实例模型（含 `bk_host_id` / `cluster_id` / `master_domain` / `version`），直接 `createTableRow({ upstreamInstance: ... })`
- **手输 IP:Port**：先只填 `instance_address`，watch 检测 `instance_address` 有值且 `bk_host_id` 为空时调 `checkInstance` 反查补全字段。校验规则「上游实例不存在」靠 `bk_host_id` 是否被反查填充判定（`trigger: 'blur'`）

注意 `checkInstance` 实际返回 Oracle 实例模型（含 `version`），`InstanceInfos` 类型未覆盖该字段，需 `as unknown as` 断言后取值。

## 复制源推导列（ReplicationSourceColumn 模式）

只读推导列（选完上游实例后自动查询展示）：`watch(() => props.clusterId, { immediate: true })` 里先清空 modelValue 再按需查询，避免切换集群时残留上一集群的推导值。推导结果同时写回父级行数据（如 `copySource.master` / `copySource.node`），提交时按该字段判断级联场景。

「正常」实例的判定当前按 `status === 'running'` + `role` 推导（待 PEER 确认 DG 应用无中断、延迟阈值的判定字段），新单据复用此模式时先确认判定字段。
