<!--
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License athttps://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
-->

<template>
  <div class="mb-16">
    <span class="mr-8">{{ t('数据冲突处理') }}：</span>
    <BkTag>
      {{ conflictHandleText }}
    </BkTag>
  </div>
  <TicketInfoTable
    :data="tableData"
    row-key="task_name">
    <TicketInfoTableColumn
      col-key="source_cluster"
      fixed="left"
      :get-copy-value="(row: RowData) => getClusterDomain(row.source_cluster)"
      :min-width="240"
      :title="t('源集群')">
      <template #default="{ row }: { row: RowData }">
        {{ getClusterDomain(row.source_cluster) }}
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="db_mapping"
      :min-width="280"
      :title="t('库映射')">
      <template #default="{ row }: { row: RowData }">
        <div
          v-for="(item, index) in row.db_mapping"
          :key="index">
          {{ item.source_db }} → {{ item.target_db }}
        </div>
        <span v-if="row.db_mapping.length < 1">--</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="target_cluster"
      :min-width="240"
      :title="t('目标集群')">
      <template #default="{ row }: { row: RowData }">
        {{ getClusterDomain(row.target_cluster) }}
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="resource_spec"
      :min-width="160"
      :title="t('DTS 规格')">
      <template #default="{ row }: { row: RowData }">
        {{ row.spec_name || '--' }}
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="label_names"
      :min-width="140"
      :title="t('资源标签')">
      <template #default="{ row }: { row: RowData }">
        <template v-if="row.label_names.length">
          <DbTag
            v-for="item in row.label_names"
            :key="item">
            {{ item }}
          </DbTag>
        </template>
        <DbTag
          v-else
          theme="success">
          {{ t('通用无标签') }}
        </DbTag>
      </template>
    </TicketInfoTableColumn>
  </TicketInfoTable>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import TicketModel, { type Mysql } from '@services/model/ticket/ticket';

  import { TicketTypes } from '@common/const';

  interface RowData {
    db_mapping: {
      source_db: string;
      target_db: string;
    }[];
    label_names: string[];
    source_cluster: number;
    spec_name: string;
    target_cluster: number;
    task_name: string;
  }

  interface Props {
    ticketDetails: TicketModel<Mysql.DtsDataMigrateRename>;
  }

  defineOptions({
    name: TicketTypes.MYSQL_DTS_DATA_MIGRATE_RENAME,
    inheritAttrs: false,
  });

  const props = defineProps<Props>();

  const { t } = useI18n();

  const conflictHandleTextMap = {
    error: t('报错并停止'),
    ignore: t('保留旧数据'),
    replace: t('覆盖旧数据'),
  } as const;

  const conflictHandleText = computed(() => {
    const { on_duplicate: onDuplicate } = props.ticketDetails.details.task || {};
    return (onDuplicate && conflictHandleTextMap[onDuplicate]) || t('报错并停止');
  });

  // 详情可能未注入 clusters，兜底显示 --
  const getClusterDomain = (clusterId: number) =>
    props.ticketDetails.details.clusters?.[clusterId]?.immute_domain || '--';

  // 从 infos[].migrate.one_to_one 提取行数据
  const tableData = computed<RowData[]>(() =>
    props.ticketDetails.details.infos.map((item) => ({
      db_mapping: (item.migrate.one_to_one.source.sync_scope.table_routes || []).map((route) => ({
        source_db: route.source_db,
        target_db: route.target_db,
      })),
      label_names: item.resource_spec?.master?.label_names || [],
      source_cluster: item.migrate.one_to_one.source.cluster_id,
      spec_name: item.resource_spec?.master?.spec_name || '',
      target_cluster: item.migrate.one_to_one.target.cluster_id,
      task_name: item.migrate.one_to_one.task_name || '',
    })),
  );
</script>
