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
  <DtsMigrateWrapper
    ref="wrapper"
    :data="formData">
    <BatchInput
      :config="batchInputConfig"
      @change="handleBatchInput" />
    <EditableTable
      :key="tableKey"
      ref="table"
      class="mt-16 mb-20"
      :model="formData.tableData">
      <EditableRow
        v-for="(item, index) in formData.tableData"
        :key="index">
        <ClusterColumn
          v-model="item.source_cluster"
          allow-repeat
          :cluster-types="[ClusterTypes.TENDBHA, ClusterTypes.TENDBSINGLE]"
          :disable-rule="sourceDisableRule"
          field="source_cluster.master_domain"
          :label="t('源集群')"
          :selected="selectedSourceClusters"
          @batch-edit="handleBatchEditSourceCluster" />
        <DbNameColumn
          v-model="item.source_db_list"
          check-not-exist
          :cluster-id="item.source_cluster.id"
          field="source_db_list"
          :label="t('源 DB')"
          required
          @batch-edit="handleBatchEdit" />
        <DbNameColumn
          v-model="item.ignore_db_list"
          :cluster-id="item.source_cluster.id"
          field="ignore_db_list"
          :label="t('忽略 DB')"
          @batch-edit="handleBatchEdit" />
        <TableNameColumn
          v-model="item.source_table_list"
          check-not-exist
          :cluster-id="item.source_cluster.id"
          field="source_table_list"
          :label="t('源表')"
          required
          @batch-edit="handleBatchEdit" />
        <TableNameColumn
          v-model="item.ignore_table_list"
          :cluster-id="item.source_cluster.id"
          field="ignore_table_list"
          :label="t('忽略表')"
          @batch-edit="handleBatchEdit" />
        <TargetClusterColumn
          v-model="item.target_cluster"
          :source-id="item.source_cluster.id" />
        <SpiderMntColumn
          v-model="item.spider_mnt"
          :cluster="item.target_cluster" />
        <EditableColumn
          :append-rules="schemaRules"
          field="target_schema_sql"
          :label="t('目标表结构')"
          :min-width="220"
          required>
          <EditableBlock
            v-if="!canFetch(item)"
            :placeholder="t('待选源表与目标集群')" />
          <EditableBlock v-else :model-value="schemaSummary(item)">
            <span v-if="item.schema_status === 'loading'">{{ t('加载中…') }}</span>
            <template v-else-if="item.schema_status === 'error'">
              <span class="schema-danger">{{ t('加载失败') }}</span>
              <BkButton
                class="ml-8"
                text
                theme="primary"
                @click="handleOpenSql(item)">
                {{ t('重新获取') }}
              </BkButton>
            </template>
            <BkButton
              v-else
              text
              :theme="hasMissingShardKey(item) ? 'danger' : 'primary'"
              @click="handleOpenSql(item)">
              {{ schemaSummary(item) }}
            </BkButton>
          </EditableBlock>
        </EditableColumn>
        <SpecColumn
          v-model="item.spec_id"
          :cluster-type="DBTypes.MYSQL"
          :current-spec-id-list="getSpecIdList(item.source_cluster)"
          field="spec_id"
          :label="t('dts-worker 规格')"
          :machine-type="MachineTypes.MYSQL_BACKEND"
          required
          selectable
          @batch-edit="handleBatchEdit" />
        <ResourceTagColumn
          v-model="item.labels"
          @batch-edit="handleBatchEdit" />
        <AvailableResourceColumn
          :params="{
            city: item.source_cluster.region,
            subzones: (item.source_cluster.cluster_subzones || []).join(','),
            for_bizs: [currentBizId, 0],
            resource_types: [DBTypes.MYSQL, 'PUBLIC'],
            spec_id: item.spec_id,
            labels: item.labels.map((label) => label.id).join(','),
          }" />
        <OperationColumn
          v-model:table-data="formData.tableData"
          :create-row-method="createTableRow" />
      </EditableRow>
    </EditableTable>
    <BkFormItem
      :label="t('数据冲突处理')"
      required>
      <BkRadioGroup v-model="formData.conflictHandle">
        <BkRadio label="replace">{{ t('覆盖旧数据') }}</BkRadio>
        <BkRadio label="ignore">{{ t('保留旧数据') }}</BkRadio>
        <BkRadio label="error">{{ t('报错并停止') }}</BkRadio>
      </BkRadioGroup>
    </BkFormItem>
    <BkFormItem
      :label="t('备份位置')"
      required>
      <BkRadioGroup v-model="formData.backupLocale">
        <BkRadio label="master">Master</BkRadio>
        <BkRadio label="slave">Slave</BkRadio>
      </BkRadioGroup>
    </BkFormItem>
    <TicketPayload v-model="formData.payload" />
    <template #action>
      <BkButton
        class="w-88"
        :loading="isSubmitting || checkingPermission"
        theme="primary"
        @click="handleSubmit">
        {{ t('提交') }}
      </BkButton>
      <DbResetButton
        class="ml-8"
        :confirm-handler="handleReset"
        :disabled="isSubmitting || checkingPermission" />
    </template>
  </DtsMigrateWrapper>
  <SchemaSql
    v-if="editingRow"
    v-model:is-show="showSql"
    :focus-missing="focusMissing"
    :request-params="getSchemaParams(editingRow)"
    :source-domain="editingRow.source_cluster.master_domain"
    :sql="editingRow.target_schema_sql"
    :target-domain="editingRow.target_cluster.master_domain"
    @confirm="handleConfirmSql"
    @status="handleSchemaStatus" />
</template>
<script setup lang="ts">
  import _ from 'lodash';
  import type { ComponentProps } from 'vue-component-type-helpers';
  import { useI18n } from 'vue-i18n';

  import TendbhaModel from '@services/model/mysql/tendbha';
  import TendbClusterModel from '@services/model/tendbcluster/tendbcluster';
  import type { Mysql } from '@services/model/ticket/ticket';
  import { simpleCheckAllowed } from '@services/source/iam';

  import { useCreateTicket, useTicketDetail } from '@hooks';

  import { ClusterTypes, DBTypes, MachineTypes, TicketTypes } from '@common/const';

  import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
  import AvailableResourceColumn from '@views/db-manage/common/toolbox-field/column/available-resource-column/Index.vue';
  import ResourceTagColumn from '@views/db-manage/common/toolbox-field/column/resource-tag-column/Index.vue';
  import SpecColumn from '@views/db-manage/common/toolbox-field/column/spec-column/Index.vue';
  import TicketPayload, {
    createTicketPayload,
  } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';
  import ClusterColumn from '@views/db-manage/mysql/common/toolbox-field/cluster-column/Index.vue';
  import DbNameColumn from '@views/db-manage/mysql/common/toolbox-field/db-name-column/Index.vue';
  import TableNameColumn from '@views/db-manage/mysql/common/toolbox-field/table-name-column/Index.vue';
  import DtsMigrateWrapper from '@views/db-manage/mysql/MYSQL_DTS_DATA_MIGRATE/components/DtsMigrateWrapper.vue';

  import { permissionDialog, random } from '@utils';

  import SchemaSql from './components/schema-sql/Index.vue';
  import SpiderMntColumn from './components/SpiderMntColumn.vue';
  import TargetClusterColumn from './components/TargetClusterColumn.vue';
  import { parseSchemaSql } from './schemaSql';

  interface RowData {
    ignore_db_list: string[];
    ignore_table_list: string[];
    labels: ComponentProps<typeof ResourceTagColumn>['modelValue'];
    schema_scope: string;
    schema_status: 'idle' | 'loading' | 'error';
    source_cluster: TendbhaModel;
    source_db_list: string[];
    source_table_list: string[];
    spec_id: number;
    spider_mnt: string;
    target_cluster: TendbClusterModel;
    target_schema_sql: string;
  }

  const { t } = useI18n();
  const router = useRouter();
  const wrapperRef = useTemplateRef('wrapper');
  const tableRef = useTemplateRef('table');
  const tableKey = ref(random());
  const currentBizId = window.PROJECT_CONFIG.BIZ_ID;
  const showSql = ref(false);
  const focusMissing = ref(false);
  const editingRow = ref<RowData>();
  const checkingPermission = ref(false);
  const sourceDisableRule = {
    handler: (cluster: TendbhaModel) => cluster.bk_biz_id !== currentBizId,
    tip: t('源集群必须属于当前业务'),
  };

  const scopeKey = (row: RowData) =>
    JSON.stringify([
      row.source_cluster.master_domain,
      row.target_cluster.master_domain,
      row.source_db_list,
      row.source_table_list,
      row.ignore_db_list,
      row.ignore_table_list,
    ]);

  const createTableRow = (data: Partial<RowData> = {}): RowData => {
    const row: RowData = {
      ignore_db_list: data.ignore_db_list || [],
      ignore_table_list: data.ignore_table_list || [],
      labels: data.labels || [],
      schema_scope: '',
      schema_status: 'idle',
      source_cluster: new TendbhaModel(data.source_cluster as ConstructorParameters<typeof TendbhaModel>[0]),
      source_db_list: data.source_db_list || [],
      source_table_list: data.source_table_list || ['*'],
      spec_id: data.spec_id || 0,
      spider_mnt: data.spider_mnt || '',
      target_cluster: new TendbClusterModel(data.target_cluster as ConstructorParameters<typeof TendbClusterModel>[0]),
      target_schema_sql: data.target_schema_sql || '',
    };
    row.schema_scope = scopeKey(row);
    return row;
  };
  const defaultData = () => ({
    backupLocale: 'slave' as 'master' | 'slave',
    checkNonTableObject: true,
    cleanupAfterMigrate: false,
    conflictHandle: 'error' as 'error' | 'replace' | 'ignore',
    destroyAfterMigrate: true,
    payload: createTicketPayload(),
    recycleHosts: true,
    tableData: [createTableRow()],
  });
  const formData = reactive(defaultData());
  const selectedSourceClusters = computed(() =>
    formData.tableData.filter((row) => row.source_cluster.id).map((row) => row.source_cluster),
  );
  const getSpecIdList = (cluster: TendbhaModel) =>
    [...(cluster.masters || []), ...(cluster.slaves || [])].map((node) => node.spec_config.id);
  const canFetch = (row: RowData) =>
    Boolean(
      row.source_cluster.id && row.target_cluster.id && row.source_db_list.length && row.source_table_list.length,
    );
  const hasMissingShardKey = (row: RowData) => parseSchemaSql(row.target_schema_sql).some((table) => !table.shardKey);
  const schemaSummary = (row: RowData) => {
    if (!row.target_schema_sql) return t('获取');
    const tables = parseSchemaSql(row.target_schema_sql);
    const missing = tables.filter((table) => !table.shardKey).length;
    return `${t('共 n 张表', { n: tables.length })}${missing ? `，${t('n 张缺 shardkey', { n: missing })}` : ''}`;
  };
  const schemaRules = [
    {
      message: t('该行尚未获取目标表结构，请重新获取'),
      trigger: 'blur',
      validator: (sql: string) => parseSchemaSql(sql || '').length > 0,
    },
    {
      message: t('存在缺 shardkey 的表，请确认目标表结构'),
      trigger: 'blur',
      validator: (sql: string) => !parseSchemaSql(sql || '').some((table) => !table.shardKey),
    },
  ];
  const getSchemaParams = (row: RowData) => ({
    cluster_id: row.source_cluster.id,
    db_patterns: [...row.source_db_list],
    ignore_dbs: [...row.ignore_db_list],
    ignore_tables: [...row.ignore_table_list],
    table_patterns: [...row.source_table_list],
    target_cluster_id: row.target_cluster.id,
  });
  const handleOpenSql = (row: RowData, locateMissing = false) => {
    if (!canFetch(row) || row.schema_status === 'loading') return;
    editingRow.value = row;
    focusMissing.value = locateMissing;
    showSql.value = true;
  };
  const handleConfirmSql = (sql: string) => {
    if (!editingRow.value) return;
    editingRow.value.target_schema_sql = sql;
    editingRow.value.schema_scope = scopeKey(editingRow.value);
  };
  const handleSchemaStatus = (status: RowData['schema_status']) => {
    if (editingRow.value) editingRow.value.schema_status = status;
  };
  // 用域名归属而非异步解析的 ID 判断变化，避免批量录入和再次提单的结果被误清。
  watch(
    () => formData.tableData.map(scopeKey),
    () => {
      formData.tableData.forEach((row) => {
        const scope = scopeKey(row);
        if (row.schema_scope === scope) return;
        row.target_schema_sql = '';
        row.schema_status = 'idle';
        row.schema_scope = scope;
        if (editingRow.value === row) showSql.value = false;
      });
      if (editingRow.value && !formData.tableData.includes(editingRow.value)) showSql.value = false;
    },
  );

  const batchInputConfig = [
    { case: 'tendbha.test.dba.db', key: 'source_master_domain', label: t('源集群') },
    { case: 'test_db', key: 'source_db_list', label: t('源 DB') },
    { case: 'NULL', key: 'ignore_db_list', label: t('忽略 DB') },
    { case: '*', key: 'source_table_list', label: t('源表') },
    { case: 'NULL', key: 'ignore_table_list', label: t('忽略表') },
    { case: 'spider.test.dba.db', key: 'target_master_domain', label: t('目标集群') },
  ];
  const handleBatchInput = (data: Record<string, string>[], clear: boolean) => {
    const listValue = (value?: string) => (value && value !== 'NULL' ? value.split('\n').filter(Boolean) : []);
    const rows = data.map((item) =>
      createTableRow({
        ignore_db_list: listValue(item.ignore_db_list),
        ignore_table_list: listValue(item.ignore_table_list),
        source_cluster: { master_domain: item.source_master_domain } as TendbhaModel,
        source_db_list: listValue(item.source_db_list),
        source_table_list: listValue(item.source_table_list),
        target_cluster: { master_domain: item.target_master_domain } as TendbClusterModel,
      }),
    );
    formData.tableData = [
      ...(clear ? [] : formData.tableData.filter((row) => row.source_cluster.master_domain)),
      ...rows,
    ];
    if (!formData.tableData.length) formData.tableData = [createTableRow()];
    tableKey.value = random();
  };
  const handleBatchEditSourceCluster = (clusters: TendbhaModel[]) => {
    formData.tableData = [
      ...formData.tableData.filter((row) => row.source_cluster.master_domain),
      ...clusters.map((cluster) => createTableRow({ source_cluster: cluster })),
    ];
    tableKey.value = random();
  };
  const handleBatchEdit = (value: unknown, field: string) => {
    formData.tableData.forEach((row) => Object.assign(row, { [field]: _.cloneDeep(value) }));
  };

  useTicketDetail<Mysql.DtsDataMigrateHetero>(TicketTypes.MYSQL_DTS_DATA_MIGRATE_HETERO, {
    onSuccess(ticket) {
      const { details } = ticket;
      const rows = details.infos.map((info) => {
        const { source, target } = info.migrate.one_to_one;
        const sourceSnapshot = details.clusters?.[source.cluster_id];
        const targetSnapshot = details.clusters?.[target.cluster_id];
        return createTableRow({
          ignore_db_list: source.sync_scope.ignore_dbs,
          ignore_table_list: source.sync_scope.ignore_tables,
          labels: (info.resource_spec.worker.labels || []).map((id, index) => ({
            id: Number(id),
            value: info.resource_spec.worker.label_names?.[index] || '',
          })) as RowData['labels'],
          source_cluster: {
            ...sourceSnapshot,
            id: source.cluster_id,
            master_domain: sourceSnapshot?.immute_domain || '',
          } as TendbhaModel,
          source_db_list: source.sync_scope.db_patterns,
          source_table_list: source.sync_scope.table_patterns,
          spec_id: info.resource_spec.worker.spec_id,
          spider_mnt: target.spider_mnt,
          target_cluster: {
            ...targetSnapshot,
            id: target.cluster_id,
            master_domain: targetSnapshot?.immute_domain || '',
          } as TendbClusterModel,
          target_schema_sql: info.target_schema_sql,
        });
      });
      Object.assign(formData, {
        backupLocale: details.backup_locale || 'slave',
        checkNonTableObject: details.check_non_table_object ?? true,
        cleanupAfterMigrate: details.cleanup_after_migrate ?? false,
        conflictHandle: details.task?.on_duplicate || 'error',
        destroyAfterMigrate: details.destroy_after_migrate ?? true,
        payload: createTicketPayload(ticket),
        recycleHosts: details.recycle_hosts ?? true,
        tableData: rows.length ? rows : [createTableRow()],
      });
      tableKey.value = random();
    },
  });

  const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<{
    backup_locale: 'master' | 'slave';
    check_non_table_object: boolean;
    cleanup_after_migrate: boolean;
    destroy_after_migrate: boolean;
    infos: {
      dts_resource: { deploy: { bk_cloud_id: number } };
      migrate: {
        one_to_one: {
          source: {
            cluster_id: number;
            sync_scope: {
              db_patterns: string[];
              ignore_dbs: string[];
              ignore_tables: string[];
              table_patterns: string[];
            };
          };
          target: { cluster_id: number; spider_mnt: string };
        };
        topology: 'one_to_one';
      };
      resource_spec: { worker: { count: number; label_names: string[]; labels: string[]; spec_id: number } };
      target_schema_sql: string;
    }[];
    recycle_hosts: boolean;
    task: { on_duplicate: 'error' | 'replace' | 'ignore'; task_mode: 'all' };
  }>(TicketTypes.MYSQL_DTS_DATA_MIGRATE_HETERO);

  const handleSubmit = async () => {
    if (checkingPermission.value || isSubmitting.value) return;
    const missingRow = formData.tableData.find(hasMissingShardKey);
    try {
      await wrapperRef.value!.validate();
      await tableRef.value!.validate();
    } catch {
      if (missingRow) handleOpenSql(missingRow, true);
      return;
    }
    checkingPermission.value = true;
    // 鉴权和提交使用同一份已校验快照，避免等待接口时修改集群造成检查对象与提交对象不一致。
    const snapshot = _.cloneDeep(formData);
    try {
      const resourceIds = [
        ...new Set(snapshot.tableData.flatMap((row) => [row.source_cluster.id, row.target_cluster.id])),
      ];
      const checks = await Promise.all(
        resourceIds.map(async (resourceId) => ({
          allowed: await simpleCheckAllowed({
            action_id: 'mysql_dts_data_migrate_hetero',
            bk_biz_id: currentBizId,
            resource_id: resourceId,
          }),
          resourceId,
        })),
      );
      const denied = checks.find((check) => !check.allowed);
      if (denied) {
        permissionDialog(undefined, {
          action_id: 'mysql_dts_data_migrate_hetero',
          bk_biz_id: currentBizId,
          resource_id: denied.resourceId,
        });
        return;
      }
      await createTicketRun({
        details: {
          backup_locale: snapshot.backupLocale,
          check_non_table_object: snapshot.checkNonTableObject,
          cleanup_after_migrate: snapshot.cleanupAfterMigrate,
          destroy_after_migrate: snapshot.destroyAfterMigrate,
          infos: snapshot.tableData.map((row) => ({
            dts_resource: { deploy: { bk_cloud_id: row.source_cluster.bk_cloud_id } },
            migrate: {
              one_to_one: {
                source: {
                  cluster_id: row.source_cluster.id,
                  sync_scope: {
                    db_patterns: row.source_db_list,
                    ignore_dbs: row.ignore_db_list,
                    ignore_tables: row.ignore_table_list,
                    table_patterns: row.source_table_list,
                  },
                },
                target: { cluster_id: row.target_cluster.id, spider_mnt: row.spider_mnt },
              },
              topology: 'one_to_one',
            },
            resource_spec: {
              worker: {
                count: 1,
                label_names: row.labels.map((label) => label.value),
                labels: row.labels.map((label) => String(label.id)),
                spec_id: Number(row.spec_id),
              },
            },
            target_schema_sql: row.target_schema_sql,
          })),
          recycle_hosts: snapshot.recycleHosts,
          task: { on_duplicate: snapshot.conflictHandle, task_mode: 'all' },
        },
        ...snapshot.payload,
      });
    } catch {
      // 鉴权失败由请求层提示；不继续提单。
    } finally {
      checkingPermission.value = false;
    }
  };
  const handleReset = () => {
    showSql.value = false;
    Object.assign(formData, defaultData());
    tableKey.value = random();
  };
  defineExpose({ routerBack: () => router.push({ name: 'MysqlToolboxIndex' }) });
</script>
<style lang="less" scoped>
  .schema-danger {
    color: #ea3636;
  }
</style>
