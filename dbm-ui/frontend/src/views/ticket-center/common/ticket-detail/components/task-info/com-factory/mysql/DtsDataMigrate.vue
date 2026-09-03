<!--
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License athttps://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
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
      col-key="source_db_list"
      :min-width="180"
      :title="t('源 DB')">
      <template #default="{ row, rowIndex }: { row: RowData; rowIndex: number }">
        <template v-if="row.source_db_list.length">
          <template v-if="expandedKeys.has(row.task_name || String(rowIndex))">
            <DbTag
              v-for="item in row.source_db_list"
              :key="item">
              {{ item }}
            </DbTag>
            <DbTag
              v-if="row.source_db_list.length > 5"
              @click="handleToggleExpand(row, rowIndex)">
              {{ t('收起') }}
            </DbTag>
          </template>
          <template v-else>
            <DbTag
              v-for="item in row.source_db_list.slice(0, 5)"
              :key="item">
              {{ item }}
            </DbTag>
            <DbTag
              v-if="row.source_db_list.length > 5"
              @click="handleToggleExpand(row, rowIndex)">
              {{ t('共n个', [row.source_db_list.length]) }}
            </DbTag>
          </template>
        </template>
        <span v-else>-</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="ignore_db_list"
      :min-width="180"
      :title="t('忽略 DB')">
      <template #default="{ row }: { row: RowData }">
        <DbTag
          v-for="item in row.ignore_db_list"
          :key="item">
          {{ item }}
        </DbTag>
        <span v-if="row.ignore_db_list.length < 1">-</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="source_table_list"
      :min-width="180"
      :title="t('源表')">
      <template #default="{ row }: { row: RowData }">
        <DbTag
          v-for="item in row.source_table_list"
          :key="item">
          {{ item }}
        </DbTag>
        <span v-if="row.source_table_list.length < 1">-</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="ignore_table_list"
      :min-width="180"
      :title="t('忽略表')">
      <template #default="{ row }: { row: RowData }">
        <DbTag
          v-for="item in row.ignore_table_list"
          :key="item">
          {{ item }}
        </DbTag>
        <span v-if="row.ignore_table_list.length < 1">-</span>
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
    ignore_db_list: string[];
    ignore_table_list: string[];
    label_names: string[];
    source_cluster: number;
    source_db_list: string[];
    source_table_list: string[];
    spec_name: string;
    target_cluster: number;
    task_name: string;
  }

  interface Props {
    ticketDetails: TicketModel<Mysql.DtsDataMigrate>;
  }

  defineOptions({
    name: TicketTypes.MYSQL_DTS_DATA_MIGRATE,
    inheritAttrs: false,
  });

  const props = defineProps<Props>();

  const { t } = useI18n();

  // 源 DB 折叠展开状态（key 为行标识）
  const expandedKeys = ref(new Set<string>());

  const getRowKey = (row: RowData, index: number) => row.task_name || String(index);

  const handleToggleExpand = (row: RowData, index: number) => {
    const key = getRowKey(row, index);
    const newSet = new Set(expandedKeys.value);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    expandedKeys.value = newSet;
  };

  const conflictHandleTextMap = {
    error: t('报错并停止'),
    keep: t('保留旧数据'),
    overwrite: t('覆盖旧数据'),
  } as const;

  // 新协议 on_duplicate → 前端枚举
  const onDuplicateToConflictHandle = (value?: string) => {
    const map: Record<string, string> = {
      error: 'error',
      ignore: 'keep',
      replace: 'overwrite',
    };
    return map[value || ''] || 'error';
  };

  const conflictHandleValue = computed(() => {
    const { details } = props.ticketDetails;
    return onDuplicateToConflictHandle(details.task?.on_duplicate);
  });

  const conflictHandleText = computed(() => conflictHandleTextMap[conflictHandleValue.value as keyof typeof conflictHandleTextMap] || t('报错并停止'));

  // 详情可能未注入 clusters，兜底显示 --
  const getClusterDomain = (clusterId: number) =>
    props.ticketDetails.details.clusters?.[clusterId]?.immute_domain || '--';

  // 从 infos[].migrate.one_to_one 提取行数据
  const tableData = computed<RowData[]>(() => {
    const { details } = props.ticketDetails;
    return details.infos.map((item) => ({
      ignore_db_list: item.migrate.one_to_one.source.sync_scope.ignore_dbs || [],
      ignore_table_list: item.migrate.one_to_one.source.sync_scope.ignore_tables || [],
      label_names: item.resource_spec?.master?.label_names || [],
      source_cluster: item.migrate.one_to_one.source.cluster_id,
      source_db_list: item.migrate.one_to_one.source.sync_scope.do_dbs || [],
      source_table_list: item.migrate.one_to_one.source.sync_scope.do_tables || [],
      spec_name: item.resource_spec?.master?.spec_name || '',
      target_cluster: item.migrate.one_to_one.target.cluster_id,
      task_name: item.migrate.one_to_one.task_name || '',
    }));
  });
</script>
