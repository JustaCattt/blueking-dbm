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
  <InfoList>
    <InfoItem :label="t('数据冲突处理')">{{ conflictText }}</InfoItem>
    <InfoItem :label="t('备份位置')">{{
      ticketDetails.details.backup_locale === 'master' ? 'Master' : 'Slave'
    }}</InfoItem>
  </InfoList>
  <TicketInfoTable
    :data="tableData"
    row-key="row_key">
    <TicketInfoTableColumn
      col-key="source_domain"
      ellipsis
      fixed="left"
      :get-copy-value="(row: RowData) => row.source_domain"
      :min-width="280"
      :title="t('源集群')">
      <template #default="{ row }: { row: RowData }">{{ row.source_domain }}</template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      v-for="column in scopeColumns"
      :key="column.key"
      :col-key="column.key"
      :get-copy-value="(row: RowData) => row[column.key].join(',')"
      :min-width="200"
      :title="column.title">
      <template #default="{ row }: { row: RowData }">
        <TagBlock :data="row[column.key]" />
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="target_domain"
      ellipsis
      :get-copy-value="(row: RowData) => row.target_domain"
      :min-width="280"
      :title="t('目标集群')">
      <template #default="{ row }: { row: RowData }">{{ row.target_domain }}</template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="spider_mnt"
      :get-copy-value="(row: RowData) => row.spider_mnt"
      :min-width="200"
      :title="t('Spider 运维节点')">
      <template #default="{ row }: { row: RowData }">{{ row.spider_mnt || '--' }}</template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="target_schema_sql"
      :min-width="220"
      :title="t('目标表结构')">
      <template #default="{ row }: { row: RowData }">
        <BkButton
          v-if="row.target_schema_sql"
          text
          :theme="hasMissingShardKey(row) ? 'danger' : 'primary'"
          @click="handleViewSql(row)">
          {{ getSchemaSummary(row.target_schema_sql, t) }}
        </BkButton>
        <span v-else>--</span>
      </template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="spec_name"
      :min-width="220"
      :title="t('dts-worker 规格')">
      <template #default="{ row }: { row: RowData }">{{ row.spec_name || '--' }}</template>
    </TicketInfoTableColumn>
    <TicketInfoTableColumn
      col-key="label_names"
      :min-width="200"
      :title="t('资源标签')">
      <template #default="{ row }: { row: RowData }">
        <TagBlock
          v-if="row.label_names.length"
          :data="row.label_names" />
        <DbTag
          v-else
          theme="success">
          {{ t('通用无标签') }}
        </DbTag>
      </template>
    </TicketInfoTableColumn>
  </TicketInfoTable>
  <SchemaSql
    v-if="selectedRow"
    v-model:is-show="showSql"
    readonly
    :source-domain="selectedRow.source_domain"
    :sql="selectedRow.target_schema_sql"
    :target-domain="selectedRow.target_domain" />
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import type TicketModel from '@services/model/ticket/ticket';
  import type { Mysql } from '@services/model/ticket/ticket';

  import { TicketTypes } from '@common/const';

  import TagBlock from '@components/tag-block/Index.vue';

  import SchemaSql from '@views/db-manage/mysql/MYSQL_DTS_DATA_MIGRATE_HETERO/components/schema-sql/Index.vue';
  import { getSchemaSummary, parseSchemaSql } from '@views/db-manage/mysql/MYSQL_DTS_DATA_MIGRATE_HETERO/schemaSql';

  import InfoList, { Item as InfoItem } from '../components/info-list/Index.vue';

  interface Props {
    ticketDetails: TicketModel<Mysql.DtsDataMigrateHetero>;
  }
  interface RowData {
    db_patterns: string[];
    ignore_dbs: string[];
    ignore_tables: string[];
    label_names: string[];
    row_key: number;
    source_domain: string;
    spec_name: string;
    spider_mnt: string;
    table_patterns: string[];
    target_domain: string;
    target_schema_sql: string;
  }
  defineOptions({ name: TicketTypes.MYSQL_DTS_DATA_MIGRATE_HETERO, inheritAttrs: false });
  const props = defineProps<Props>();
  const { t } = useI18n();
  const showSql = ref(false);
  const selectedRow = ref<RowData>();
  const scopeColumns = [
    { key: 'db_patterns', title: t('源 DB') },
    { key: 'ignore_dbs', title: t('忽略 DB') },
    { key: 'table_patterns', title: t('源表') },
    { key: 'ignore_tables', title: t('忽略表') },
  ] as const;
  const conflictText = computed(
    () =>
      ({
        error: t('报错并停止'),
        ignore: t('保留旧数据'),
        replace: t('覆盖旧数据'),
      })[props.ticketDetails.details.task?.on_duplicate || 'error'],
  );
  const tableData = computed<RowData[]>(() => {
    const { details } = props.ticketDetails;
    return details.infos.map((info, index) => {
      const { source, target } = info.migrate.one_to_one;
      return {
        db_patterns: source.sync_scope.db_patterns || [],
        ignore_dbs: source.sync_scope.ignore_dbs || [],
        ignore_tables: source.sync_scope.ignore_tables || [],
        label_names: info.resource_spec?.worker?.label_names || [],
        row_key: index,
        source_domain: details.clusters?.[source.cluster_id]?.immute_domain || '--',
        spec_name: details.specs?.[info.resource_spec?.worker?.spec_id]?.name || '',
        spider_mnt: target.spider_mnt,
        table_patterns: source.sync_scope.table_patterns || [],
        target_domain: details.clusters?.[target.cluster_id]?.immute_domain || '--',
        target_schema_sql: info.target_schema_sql || '',
      };
    });
  });
  const handleViewSql = (row: RowData) => {
    selectedRow.value = row;
    showSql.value = true;
  };
  const hasMissingShardKey = (row: RowData) => parseSchemaSql(row.target_schema_sql).some((table) => !table.shardKey);
</script>
