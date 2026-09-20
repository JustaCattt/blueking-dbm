# 单据详情页实现

## 详情类型注册（第 2.5 步前半）

文件：`src/services/model/ticket/details/oracle/<ticketType 驼峰>.ts`（如 `oracleAddSlave.ts`）

```typescript
import type { ResourcePoolDetailBase } from '../resource-pool';

export interface oracleAddSlave extends ResourcePoolDetailBase {
  db_version: string;
  infos: {
    cluster_id: number;
    old_master?: { ip: string; port?: number; bk_cloud_id: number; bk_host_id: number; bk_biz_id: number };
    old_node: { ip: string; port?: number; bk_cloud_id: number; bk_host_id: number; bk_biz_id: number };
    resource_spec: { oracle: { count: number; spec_id: number; label_names?: string[]; labels?: string[] } };
  }[];
  upstream_type: 'master' | 'single' | 'slave';
}
```

在 `oracle/index.ts` 导出：`export * from './oracleAddSlave';`，经 `ticket.ts` 的 `export type * as Oracle from './details/oracle'` 命名空间生效。命名保持与后端 ticket_type 驼峰一致（如 `ORACLE_ADD_SLAVE` → `oracleAddSlave`，首字母小写是既有约定，勿改成 `AddSlave`——sqlserver 用 `AddSlave`、mysql 用 `AddSlave`，oracle 现有文件是 `oracleAddSlave`，跟随现状）。

## 核心原则：详情跟提单保持一致

单据详情页的行级表格列与页级信息，必须与**提单页实际实现**保持一致——列集合、列序、列头文案、显隐逻辑全部照搬提单页 `Index.vue`，**不要被原型图误导**。原型图描述的是提单页的产品意图；详情页的职责是忠实回显用户提交的数据，当原型图中的详情展示与提单页实现冲突时，一律以提单页为准。

判定方法：打开提单页 `Index.vue`，逐一对照其表格列（含条件列，如仅某模式出现的 `v-if` 列），详情页按相同顺序建列，`v-if` 条件映射为 `computed` 显隐；提单页的页级表单项（如模式选择）映射为 `InfoItem`。提单页的辅助列（如 `AvailableResourceColumn` 可用资源预览）不属于单据数据，详情页不展示。

参考实现：`ORACLE_ADD_SLAVE` 提单页数据列（上游实例、所属集群、复制源[仅主库]、目标规格、资源标签）与详情页 `AddSlave.vue` 一一对应，复制源列的显隐 `computed` 与提单页 `v-if="formData.mode === 'master'"` 逻辑对齐（均取 `upstream_type`）。

## 结构模板

```vue
<template>
  <InfoList>
    <InfoItem :label="t('上游类型')">{{ upstreamTypeLabel }}</InfoItem>
  </InfoList>
  <TicketInfoTable :data="ticketDetails.details.infos" row-key="index">
    <TicketInfoTableColumn col-key="old_node" fixed="left" :min-width="210" :title="t('上游实例')">
      <template #default="{ row }: { row: IRowData }">
        {{ formatInstanceAddress(row.old_node) }}
      </template>
    </TicketInfoTableColumn>
    <!-- 更多列 -->
  </TicketInfoTable>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import type { Oracle } from '@services/model/ticket/ticket';
  import type TicketModel from '@services/model/ticket/ticket';

  import { TicketTypes } from '@common/const';

  import InfoList, { Item as InfoItem } from '../components/info-list/Index.vue';

  type IRowData = Props['ticketDetails']['details']['infos'][number];

  interface Props {
    ticketDetails: TicketModel<Oracle.oracleAddSlave>;
  }

  defineOptions({ name: TicketTypes.ORACLE_YOUR_NEW_TYPE, inheritAttrs: false });

  const props = defineProps<Props>();
  const { t } = useI18n();
</script>
```

要点：

- Props 用 `TicketModel<Oracle.Xxx>` 强类型（**不要 `any`**），`IRowData` 从 Props 类型推导获得真实行类型
- 类型导入遵守 `verbatimModuleSyntax`：`import type { Oracle }` 与 `import type TicketModel` 拆两行写
- `defineOptions` 的 `name` 与 `TicketTypes` 枚举值一致，组件经 `import.meta.glob` 自动注册

## 取值兜底

- 空列表、缺失域名均显示 `--`
- 资源标签空时显示绿色「通用无标签」
- 规格名取顶层 `specs`：`details.specs?.[row.resource_spec?.oracle?.spec_id]?.name || '--'`
- 集群域名：`details.clusters?.[row.cluster_id]?.immute_domain || '--'`
- 枚举值展示（如上游类型）用 `upstreamTypeMap[details.upstream_type] || '--'`，存量单据无该字段时落 `--`，不做 flow_type / 集群类型推导
- 实例地址展示兼容无 port 存量单据：`host.port ? \`${host.ip}:${host.port}\` : host.ip`

## 行键

`TicketInfoTable` 的 `row-key` 必须唯一。如果同一集群可能有多行（如不同上游实例指向同一集群），使用 `index` 而非 `cluster_id`。
