# 单据详情页实现

文件：`src/views/ticket-center/common/ticket-detail/components/task-info/com-factory/oracle/YourNewType.vue`

## 核心原则：详情跟提单保持一致

单据详情页的行级表格列与页级信息，必须与**提单页实际实现**保持一致——列集合、列序、列头文案、显隐逻辑全部照搬提单页 `Index.vue`，**不要被原型图误导**。原型图描述的是提单页的产品意图；详情页的职责是忠实回显用户提交的数据，当原型图中的详情展示与提单页实现冲突时，一律以提单页为准。

判定方法：打开提单页 `Index.vue`，逐一对照其表格列（含条件列，如仅某模式出现的 `v-if` 列），详情页按相同顺序建列，`v-if` 条件映射为 `computed` 显隐；提单页的页级表单项（如模式选择）映射为 `InfoItem`。提单页的辅助列（如 `AvailableResourceColumn` 可用资源预览）不属于单据数据，详情页不展示。

参考实现：`ORACLE_ADD_SLAVE` 提单页数据列（上游实例、所属集群、复制源[仅主库]、目标规格、资源标签）与详情页 `AddSlave.vue` 一一对应，`copy_source` 列的显隐 `computed` 与提单页 `v-if="formData.mode === 'master'"` 逻辑对齐。

## 结构模板

```vue
<template>
  <div>
    <!-- 页级信息 -->
    <InfoList>
      <InfoItem :label="t('上游类型')">{{ details.upstream_type }}</InfoItem>
      <!-- 更多页级字段 -->
    </InfoList>
    <!-- 行级表格 -->
    <TicketInfoTable
      :data="details.infos"
      row-key="cluster_id">
      <TicketInfoTableColumn
        field="instance_address"
        :label="t('上游实例')" />
      <TicketInfoTableColumn
        field="resource_spec.slave.spec_name"
        :label="t('目标规格')" />
      <!-- 更多列 -->
    </TicketInfoTable>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n';
  import TicketModel from '@services/model/ticket/ticket';

  interface Props {
    ticketDetail: TicketModel<unknown>;
  }

  defineOptions({ name: TicketTypes.ORACLE_YOUR_NEW_TYPE, inheritAttrs: false });

  const props = defineProps<Props>();
  const { t } = useI18n();

  const details = computed(() => props.ticketDetail.details);
</script>
```

## 取值兜底

- 空列表、缺失域名均显示 `--`
- 资源标签空时显示绿色「通用无标签」
- 规格名取顶层 `specs`：`details.specs?.[spec_id]?.name`，不在 `resource_spec.xxx.spec_name` 取

## 行键

`TicketInfoTable` 的 `row-key` 必须唯一。如果同一集群可能有多行（如不同上游实例指向同一集群），使用 `index` 而非 `cluster_id`。
