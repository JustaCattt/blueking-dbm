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
  <DtsMigrateWrapper>
    <SmartAction>
      <BatchInput
        :config="batchInputConfig"
        @change="handleBatchInput" />
      <EditableTable
        :key="tableKey"
        ref="tableRef"
        class="mt-16 mb-20"
        :model="formData.tableData">
        <EditableRow
          v-for="(item, index) in formData.tableData"
          :key="index">
          <ClusterColumn
            v-model="item.source_cluster"
            allow-repeat
            field="source_cluster.master_domain"
            :label="t('源集群')"
            :selected="selectedSourceClusters"
            @batch-edit="handleBatchEditSourceCluster"
            @request-success="handleSourceClusterChange(item)" />
          <EditableColumn
            :append-rules="dbMappingRules"
            :disabled-method="disabledDbMapping"
            field="db_mapping"
            :label="t('库映射')"
            :min-width="200"
            required>
            <EditableBlock
              v-model="item.db_mapping_text"
              :placeholder="t('请设置库映射')" />
            <template #headAppend>
              <span
                v-bk-tooltips="t('编辑库映射')"
                class="batch-edit-btn"
                @click="handleOpenMapping(item, index)">
                <DbIcon type="edit" />
              </span>
            </template>
          </EditableColumn>
          <TargetClusterColumn
            v-model="item.target_cluster"
            :cluster="item.source_cluster"
            :selected="selectedTargetClusters"
            source-field="source_cluster" />
          <SpecColumn
            v-model="item.spec_id"
            :cluster-type="DBTypes.MYSQL"
            :current-spec-id-list="getSpecIdList(item.source_cluster)"
            :machine-type="MachineTypes.MYSQL_BACKEND"
            required
            selectable
            @batch-edit="handleBatchEdit" />
          <ResourceTagColumn
            v-model="item.labels"
            @batch-edit="handleBatchEdit" />
          <AvailableResourceColumn
            :params="{
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
          <BkRadio label="overwrite">
            {{ t('覆盖旧数据') }}
          </BkRadio>
          <BkRadio label="keep">
            {{ t('保留旧数据') }}
          </BkRadio>
          <BkRadio label="error">
            {{ t('报错并停止') }}
          </BkRadio>
        </BkRadioGroup>
      </BkFormItem>
      <TicketPayload v-model="formData.payload" />
      <DbMappingSideslider
        v-model:is-show="showMappingSlider"
        :data="currentEditingRow?.db_mapping || []"
        @confirm="handleMappingConfirm" />
      <template #action>
        <BkButton
          class="mr-8 w-88"
          :loading="isSubmitting"
          theme="primary"
          @click="handleSubmit">
          {{ t('提交') }}
        </BkButton>
        <DbResetButton
          class="ml-8"
          :confirm-handler="handleReset"
          :disabled="isSubmitting" />
      </template>
    </SmartAction>
  </DtsMigrateWrapper>
</template>
<script lang="ts" setup>
  import _ from 'lodash';
  import { reactive, useTemplateRef } from 'vue';
  import type { ComponentProps } from 'vue-component-type-helpers';
  import { useI18n } from 'vue-i18n';

  import TendbhaModel from '@services/model/mysql/tendbha';
  import type { Mysql } from '@services/model/ticket/ticket';

  import { useCreateTicket, useTicketDetail } from '@hooks';

  import { DBTypes, MachineTypes, TicketTypes } from '@common/const';

  import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
  import AvailableResourceColumn from '@views/db-manage/common/toolbox-field/column/available-resource-column/Index.vue';
  import OperationColumn from '@views/db-manage/common/toolbox-field/column/operation-column/Index.vue';
  import ResourceTagColumn from '@views/db-manage/common/toolbox-field/column/resource-tag-column/Index.vue';
  import SpecColumn from '@views/db-manage/common/toolbox-field/column/spec-column/Index.vue';
  import TicketPayload, {
    createTicketPayload,
  } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';
  import ClusterColumn from '@views/db-manage/mysql/common/toolbox-field/cluster-column/Index.vue';
  import TargetClusterColumn from '@views/db-manage/mysql/common/toolbox-field/target-cluster-column/Index.vue';
  import DtsMigrateWrapper from '@views/db-manage/mysql/MYSQL_DTS_DATA_MIGRATE/components/DtsMigrateWrapper.vue';

  import { random } from '@utils';

  import DbMappingSideslider from './components/DbMappingSideslider.vue';

  interface DbMapping {
    source_db: string;
    target_db: string;
  }

  interface RowData {
    db_mapping: DbMapping[];
    db_mapping_text: string;
    labels: ComponentProps<typeof ResourceTagColumn>['modelValue'];
    source_cluster: TendbhaModel;
    spec_id: number;
    target_cluster: {
      cluster_type: string;
      id: number;
      master_domain: string;
    };
  }

  defineOptions({
    name: TicketTypes.MYSQL_DTS_DATA_MIGRATE_RENAME,
  });

  const { t } = useI18n();
  const router = useRouter();

  const tableRef = useTemplateRef('tableRef');
  const tableKey = ref(random());
  const currentBizId = window.PROJECT_CONFIG.BIZ_ID;

  const showMappingSlider = ref(false);
  const currentEditingIndex = ref(-1);
  const currentEditingRow = ref<RowData>();

  const batchInputConfig = [
    {
      case: 'tendbha.test.dba.db',
      key: 'source_master_domain',
      label: t('源集群'),
    },
    {
      case: 'source_db target_db',
      key: 'db_mapping',
      label: t('库映射'),
    },
    {
      case: 'bzmigrate.test.dba.db',
      key: 'target_master_domain',
      label: t('目标集群'),
    },
  ];

  const dbMappingRules = [
    {
      message: t('请设置库映射'),
      trigger: 'change',
      validator: (value: string) => Boolean(value),
    },
  ];

  const disabledDbMapping = (rowData?: any) => {
    if (!rowData?.source_cluster?.id) {
      return t('请先选择源集群');
    }
    return '';
  };

  const createTableRow = (data = {} as Partial<RowData>) => ({
    db_mapping: data.db_mapping || [],
    db_mapping_text: data.db_mapping_text || '',
    labels: data.labels || [],
    source_cluster: Object.assign(
      {
        cluster_type: '',
        id: 0,
        master_domain: '',
      } as unknown as TendbhaModel,
      data.source_cluster,
    ),
    spec_id: data.spec_id || 0,
    target_cluster: Object.assign(
      {
        cluster_type: '',
        id: 0,
        master_domain: '',
      },
      data.target_cluster,
    ),
  });

  const defaultData = () => ({
    conflictHandle: 'error' as 'overwrite' | 'keep' | 'error',
    payload: createTicketPayload(),
    tableData: [createTableRow()],
  });

  const formData = reactive(defaultData());

  const selectedSourceClusters = computed(() =>
    formData.tableData.filter((item) => item.source_cluster.id).map((item) => item.source_cluster),
  );

  const selectedTargetClusters = computed(() =>
    formData.tableData
      .filter((item) => item.target_cluster.id)
      .map((item) => ({ id: item.target_cluster.id, master_domain: item.target_cluster.master_domain })),
  );

  const getSpecIdList = (cluster: TendbhaModel) => {
    if (!cluster || !cluster.id) {
      return [];
    }
    const instances = [...(cluster.masters || []), ...(cluster.slaves || [])];
    return instances.map((item) => item.spec_config.id);
  };

  const handleSourceClusterChange = (row: RowData) => {
    Object.assign(row, {
      db_mapping: [],
      db_mapping_text: '',
    });
  };

  const handleOpenMapping = (row: RowData, index: number) => {
    if (!row.source_cluster.id) {
      return;
    }
    currentEditingRow.value = row;
    currentEditingIndex.value = index;
    showMappingSlider.value = true;
  };

  const handleMappingConfirm = (mapping: DbMapping[]) => {
    if (currentEditingRow.value) {
      currentEditingRow.value.db_mapping = mapping;
      currentEditingRow.value.db_mapping_text = mapping
        .map((item) => `${item.source_db} → ${item.target_db}`)
        .join(', ');
    }
  };

  useTicketDetail<Mysql.DtsDataMigrateRename>(TicketTypes.MYSQL_DTS_DATA_MIGRATE_RENAME, {
    onSuccess(ticketDetail) {
      const { details } = ticketDetail;
      const { clusters, infos } = details;
      Object.assign(formData, {
        conflictHandle: details.conflict_handle,
        payload: createTicketPayload(ticketDetail),
        tableData: infos.map((item) =>
          createTableRow({
            db_mapping: item.db_mapping,
            db_mapping_text: item.db_mapping.map((m) => `${m.source_db} → ${m.target_db}`).join(', '),
            source_cluster: {
              master_domain: clusters[item.source_cluster].immute_domain || '',
            } as TendbhaModel,
            spec_id: item.resource_spec.spec_id,
            target_cluster: {
              master_domain: clusters[item.target_cluster].immute_domain || '',
            },
          }),
        ),
      });
    },
  });

  const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<Mysql.DtsDataMigrateRename>(
    TicketTypes.MYSQL_DTS_DATA_MIGRATE_RENAME,
  );

  const handleSubmit = async () => {
    const result = await tableRef.value!.validate();
    if (!result) {
      return;
    }
    createTicketRun({
      details: {
        conflict_handle: formData.conflictHandle,
        infos: formData.tableData.map((item) => ({
          db_mapping: item.db_mapping,
          resource_spec: {
            spec_id: item.spec_id,
          },
          source_cluster: item.source_cluster.id,
          target_cluster: item.target_cluster.id,
        })),
      },
      ...formData.payload,
    });
  };

  const handleReset = () => {
    Object.assign(formData, defaultData());
    tableKey.value = random();
  };

  const handleBatchEditSourceCluster = (list: TendbhaModel[]) => {
    const dataList = list.reduce<RowData[]>((acc, cluster) => {
      acc.push(createTableRow({ source_cluster: cluster }));
      return acc;
    }, []);
    formData.tableData = [...(formData.tableData[0].source_cluster.id ? formData.tableData : []), ...dataList];
  };

  const handleBatchEdit = (value: any, field: string) => {
    formData.tableData.forEach((item) => {
      Object.assign(item, {
        [field]: _.cloneDeep(value),
      });
    });
  };

  const handleBatchInput = (data: Record<string, any>[], isClear: boolean) => {
    const dataList = data.map((item) => {
      const mappingPairs = (item.db_mapping || '').split(/[,\s]+/).filter(Boolean);
      const dbMapping: DbMapping[] = [];
      for (let i = 0; i < mappingPairs.length; i += 2) {
        if (mappingPairs[i] && mappingPairs[i + 1]) {
          dbMapping.push({
            source_db: mappingPairs[i],
            target_db: mappingPairs[i + 1],
          });
        }
      }
      return createTableRow({
        db_mapping: dbMapping,
        db_mapping_text: dbMapping.map((m) => `${m.source_db} → ${m.target_db}`).join(', '),
        source_cluster: {
          master_domain: item.source_master_domain,
        } as TendbhaModel,
        target_cluster: {
          master_domain: item.target_master_domain,
        },
      });
    });
    if (isClear) {
      tableKey.value = random();
      formData.tableData = [...dataList];
    } else {
      formData.tableData = [...(formData.tableData[0].source_cluster.id ? formData.tableData : []), ...dataList];
    }
    setTimeout(() => {
      tableRef.value?.validate();
    }, 200);
  };

  defineExpose({
    routerBack() {
      router.push({
        name: 'MysqlToolboxIndex',
      });
    },
  });
</script>
