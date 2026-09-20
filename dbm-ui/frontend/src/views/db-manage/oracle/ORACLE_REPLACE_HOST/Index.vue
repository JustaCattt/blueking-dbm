<!--
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
-->

<template>
  <SmartAction>
    <BkAlert
      class="mb-20"
      closable
      theme="info"
      :title="t('整机替换：替换所选主机，支持单节点以及主从集群的从库。')" />
    <BkForm
      class="mb-20"
      form-type="vertical"
      :model="formData">
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
          <HostColumnGroup
            v-model="item.host"
            :selected="selectedHosts"
            @batch-edit="handleBatchEditHost" />
          <SpecColumn
            v-model="item.specId"
            :cluster-type="DBTypes.ORACLE"
            :current-spec-id-list="[item.host.specId]"
            required
            selectable
            @batch-edit="handleBatchEditColumn" />
          <ResourceTagColumn
            v-model="item.resourceTags"
            @batch-edit="handleBatchEditColumn" />
          <AvailableResourceColumn
            :params="{
              for_bizs: [currentBizId, 0],
              labels: item.resourceTags.map((tag) => tag.id).join(','),
              resource_types: [DBTypes.ORACLE, 'PUBLIC'],
              spec_id: item.specId,
            }" />
          <OperationColumn
            v-model:table-data="formData.tableData"
            :create-row-method="createTableRow" />
        </EditableRow>
      </EditableTable>
      <TicketPayload v-model="formData.payload" />
    </BkForm>
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
</template>
<script setup lang="ts">
  import { reactive, useTemplateRef } from 'vue';
  import { useI18n } from 'vue-i18n';

  import type OracleHaInstanceModel from '@services/model/oracle/oracle-ha-instance';
  import type OracleSingleInstanceModel from '@services/model/oracle/oracle-single-instance';
  import type { Oracle } from '@services/model/ticket/ticket';
  import { getOracleHaInstanceList } from '@services/source/oracleHaCluster';

  import { useCreateTicket, useTicketDetail } from '@hooks';

  import { ClusterInstStatusKeys, ClusterTypes, DBTypes, TicketTypes } from '@common/const';

  import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
  import AvailableResourceColumn from '@views/db-manage/common/toolbox-field/column/available-resource-column/Index.vue';
  import ResourceTagColumn from '@views/db-manage/common/toolbox-field/column/resource-tag-column/Index.vue';
  import SpecColumn from '@views/db-manage/common/toolbox-field/column/spec-column/Index.vue';
  import TicketPayload, {
    createTicketPayload,
  } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';

  import { random } from '@utils';

  import HostColumnGroup from './components/HostColumnGroup.vue';
  import type { HostInfo, ReplaceHost } from './types';
  import { buildHostInfo, createReplaceHost } from './types';

  // 选择器返回的实例模型（Oracle 单机单实例，实例即主机）
  type SelectorInstance = OracleHaInstanceModel | OracleSingleInstanceModel;

  interface RowData {
    host: ReplaceHost;
    resourceTags: {
      id: number;
      value: string;
    }[];
    specId: number;
  }

  defineOptions({ name: TicketTypes.ORACLE_REPLACE_HOST });

  const { t } = useI18n();
  const router = useRouter();
  const tableRef = useTemplateRef('tableRef');

  const currentBizId = window.PROJECT_CONFIG.BIZ_ID;

  const batchInputConfig = [
    {
      case: '10.1.20.31',
      key: 'ip',
      label: t('主机'),
    },
  ];

  const createTableRow = (data: DeepPartial<RowData> = {}): RowData => ({
    host: createReplaceHost(data.host),
    resourceTags: (data.resourceTags || []) as RowData['resourceTags'],
    specId: data.specId || 0,
  });

  const defaultData = () => ({
    payload: createTicketPayload(),
    tableData: [createTableRow()],
  });

  const formData = reactive(defaultData());
  const tableKey = ref(random());

  const selectedHosts = computed(() =>
    formData.tableData.filter((item) => item.host.bk_host_id).map((item) => item.host),
  );

  // 回填：单据详情 infos 还原表格行
  useTicketDetail<Oracle.oracleReplaceHost>(TicketTypes.ORACLE_REPLACE_HOST, {
    onSuccess(ticketDetail) {
      const { db_version: dbVersion, infos } = ticketDetail.details;
      Object.assign(formData, {
        payload: createTicketPayload(ticketDetail),
        tableData: infos.map((item) =>
          createTableRow({
            // 协议回填 ip/port/role，bk_host_id 留空触发 HostColumnGroup 反查补齐
            host: createReplaceHost({
              bk_biz_id: item.old_node.bk_biz_id,
              bk_cloud_id: item.old_node.bk_cloud_id,
              ip: item.old_node.ip,
              port: item.old_node.port,
              // §2.4 回填复制源：协议 old_node 即被替换实例，old_master 为级联场景主库
              // 单节点/异常从库：old_node 即复制源（role=primary）
              // 正常从库：old_node 为从库（role=standby）
              replication_source: {
                address: item.old_node.port ? `${item.old_node.ip}:${item.old_node.port}` : item.old_node.ip,
                role: item.old_node.role || '',
              },
              role: item.old_node.role,
              version: (dbVersion || '').replace(/^Oracle-/, ''),
            }),
            resourceTags: (item.resource_spec.oracle.labels || []).map((labelId: string, index: number) => ({
              id: Number(labelId),
              value: item.resource_spec.oracle.label_names?.[index] || '',
            })),
            specId: item.resource_spec.oracle.spec_id,
          }),
        ),
      });
    },
  });

  // 两个场景共用 ORACLE_REPLACE_HOST 单据，仅 flow_type 区分：ORACLE_ADD_SLAVE（单节点/异常从库）与 ORACLE_ADD_SLAVE_VIA_CASCADING（主从正常从库，级联）
  const { loading: isSubmitting, run: runCreateTicket } = useCreateTicket<{
    db_version: string;
    flow_type: string;
    infos: {
      cluster_id: number;
      // 级联场景：old_master 为主库
      old_master?: HostInfo;
      old_node: HostInfo;
      replace_flag: boolean;
      // 页面所选主机（被替换主机）
      replace_host: HostInfo;
      resource_spec: {
        oracle: {
          count: number;
          label_names: string[];
          labels: string[];
          spec_id: number;
        };
      };
    }[];
    ip_source: string;
  }>(TicketTypes.ORACLE_REPLACE_HOST);

  // 批量追加：仅首行为空表单时保留全部既有行，否则清空重建
  const appendRows = (rows: RowData[], isClear = false) => {
    if (isClear) {
      tableKey.value = random();
      formData.tableData = [...rows];
      return;
    }
    const keep = formData.tableData[0].host.ip ? formData.tableData : [];
    formData.tableData = [...keep, ...rows];
  };

  const handleSubmit = () => {
    tableRef.value!.validate().then(async () => {
      // 场景分组：主从集群且运行中的从库走级联（ORACLE_ADD_SLAVE_VIA_CASCADING，需反查主库），其余（单节点/异常从库）走 ORACLE_ADD_SLAVE
      const cascadingRows: RowData[] = [];
      const replaceRows: RowData[] = [];
      formData.tableData.forEach((item) => {
        if (
          item.host.cluster_type === ClusterTypes.ORACLE_PRIMARY_STANDBY &&
          item.host.status === ClusterInstStatusKeys.RUNNING
        ) {
          cascadingRows.push(item);
        } else {
          replaceRows.push(item);
        }
      });

      // 组装提交协议（flow_type 与是否级联由行数据决定）
      const buildDetails = (rows: RowData[], flowType: string) => ({
        db_version: `Oracle-${rows[0]?.host.version || ''}`,
        flow_type: flowType,
        infos: rows.map((item) => ({
          cluster_id: item.host.cluster_id,
          old_node: buildHostInfo(item.host),
          replace_flag: true,
          // 页面所选主机（被替换主机）
          replace_host: buildHostInfo(item.host),
          resource_spec: {
            oracle: {
              count: 1,
              label_names: item.resourceTags.map((tag) => tag.value),
              labels: item.resourceTags.map((tag) => String(tag.id)),
              spec_id: item.specId,
            },
          },
        })),
        ip_source: 'resource_pool',
      });

      // 级联场景每行反查主库实例填 old_master，反查失败则缺省（后端按 old_node 处理）
      if (cascadingRows.length) {
        const details = buildDetails(cascadingRows, 'ORACLE_ADD_SLAVE_VIA_CASCADING');
        await Promise.all(
          cascadingRows.map(async (item, index) => {
            const [master] = (
              await getOracleHaInstanceList({
                cluster_id: item.host.cluster_id,
                role: 'primary',
              })
            ).results;
            if (master) {
              details.infos[index].old_master = buildHostInfo(master);
            }
          }),
        );
        await runCreateTicket({ details, ...formData.payload });
      }

      // 单节点与异常从库共用 flow_type=ORACLE_ADD_SLAVE
      if (replaceRows.length) {
        await runCreateTicket({
          details: buildDetails(replaceRows, 'ORACLE_ADD_SLAVE'),
          ...formData.payload,
        });
      }
    });
  };

  const handleReset = () => {
    Object.assign(formData, defaultData());
  };

  // §2.4 复制源推导（选择器路径）：单点→自身 primary；从库正常→自身 standby；从库异常→需反查主库
  const computeReplicationSource = (item: SelectorInstance): { address: string; role: string } => {
    if (item.cluster_type === ClusterTypes.ORACLE_SINGLE_NONE) {
      return { address: item.instance_address, role: 'primary' };
    }
    if (item.role === 'standby') {
      if (item.status === ClusterInstStatusKeys.RUNNING) {
        return { address: item.instance_address, role: 'standby' };
      }
      // 从库异常：复制源为主库，地址需反查（此处先留空，由 HostColumnGroup watch 补齐）
      return { address: '', role: 'primary' };
    }
    return { address: '', role: '' };
  };

  const handleBatchEditHost = (list: SelectorInstance[]) => {
    const selectedIps = new Set(selectedHosts.value.map((item) => item.ip));
    const dataList = list
      .filter((item) => !selectedIps.has(item.ip))
      .map((item) =>
        createTableRow({
          host: createReplaceHost({
            bk_cloud_id: item.bk_cloud_id,
            bk_host_id: item.bk_host_id,
            cluster_id: item.cluster_id,
            cluster_type: item.cluster_type,
            cluster_type_name: item.cluster_type_name,
            instance_address: item.instance_address,
            ip: item.ip,
            master_domain: item.master_domain,
            port: item.port,
            replication_source: computeReplicationSource(item),
            role: item.role,
            specId: item.spec_config?.id || 0,
            status: item.status,
            version: item.version,
          }),
        }),
      );
    appendRows(dataList);
  };

  const handleBatchEditColumn = (value: any, field: string) => {
    // ResourceTagColumn 批量填充 field 为 labels，映射到行字段 resourceTags
    const targetField = field === 'labels' ? 'resourceTags' : field;
    formData.tableData.forEach((item) => {
      Object.assign(item, { [targetField]: value });
    });
  };

  const handleBatchInput = (data: Record<string, any>[], isClear: boolean) => {
    const dataList = data.map((item) =>
      createTableRow({
        host: createReplaceHost({
          ip: (item.ip as string) || '',
        }),
      }),
    );
    appendRows(dataList, isClear);
    setTimeout(() => {
      tableRef.value?.validate();
    }, 200);
  };

  defineExpose({
    routerBack() {
      router.push({
        name: 'OracleToolboxIndex',
      });
    },
  });
</script>
