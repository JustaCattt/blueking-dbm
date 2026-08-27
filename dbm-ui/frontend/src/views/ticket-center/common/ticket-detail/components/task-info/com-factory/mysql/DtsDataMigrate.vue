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
 * the specific governing permissions and limitations under the License.
-->

<template>
  <div class="mb-16">
    <span class="mr-8">{{ t('数据冲突处理') }}：</span>
    <BkTag>
      {{ conflictHandleText }}
    </BkTag>
  </div>
  <TicketInfoTable
    :data="ticketDetails.details.infos"
    row-key="source_cluster">
    <TicketInfoTableColumn
      col-key="source_cluster"
      fixed="left"
      :get-copy-value="(row: RowData) => ticketDetails.details.clusters[row.source_cluster].immute_domain"
      :min-width="240"
      :title="t('源集群')">
      <template #default="{ row }: { row: RowData }">
        {{ ticketDetails.details.clusters[row.source_cluster].immute_domain }}
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="source_db_list"
      :min-width="180"
      :title="t('源 DB')">
      <template #default="{ row }: { row: RowData }">
        <DbTag
          v-for="item in row.source_db_list"
          :key="item">
          {{ item }}
        </DbTag>
        <span v-if="row.source_db_list.length < 1">--</span>
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
        <span v-if="row.ignore_db_list.length < 1">--</span>
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
        <span v-if="row.source_table_list.length < 1">--</span>
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
        <span v-if="row.ignore_table_list.length < 1">--</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="target_cluster"
      :min-width="240"
      :title="t('目标集群')">
      <template #default="{ row }: { row: RowData }">
        {{ ticketDetails.details.clusters[row.target_cluster].immute_domain }}
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="resource_spec"
      :min-width="180"
      :title="t('DTS 规格')">
      <template #default="{ row }: { row: RowData }">
        {{ row.resource_spec.spec_id || '--' }}
      </template>
    </TicketInfoTableColumn>
  </TicketInfoTable>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import TicketModel, { type Mysql } from '@services/model/ticket/ticket';

  import { TicketTypes } from '@common/const';

  interface Props {
    ticketDetails: TicketModel<Mysql.DtsDataMigrate>;
  }

  type RowData = Props['ticketDetails']['details']['infos'][number];

  defineOptions({
    name: TicketTypes.MYSQL_DTS_DATA_MIGRATE,
    inheritAttrs: false,
  });

  const props = defineProps<Props>();

  const { t } = useI18n();

  const conflictHandleTextMap = {
    error: t('报错并停止'),
    keep: t('保留旧数据'),
    overwrite: t('覆盖旧数据'),
  } as const;

  const conflictHandleText = computed(
    () => conflictHandleTextMap[props.ticketDetails.details.conflict_handle] || t('报错并停止'),
  );
</script>
