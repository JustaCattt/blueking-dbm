<!--
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License athttps://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 * for the specific language governing permissions and limitations under the License.
-->

<template>
  <SmartAction>
    <BkAlert
      class="mb-20"
      closable
      theme="info"
      :title="t('添加从库：为所选上游实例新增 1 个从库。')" />
    <BkForm
      class="mb-20"
      form-type="vertical"
      :model="formData">
      <BkFormItem
        :label="t('上游类型')"
        required>
        <div class="mode-cards">
          <CardCheckbox
            v-model="formData.mode"
            :desc="t('为单节点新增从库，原实例升主')"
            icon="bk-dbm-icon db-icon-plus-fill"
            :title="t('单节点')"
            true-value="single" />
          <CardCheckbox
            v-model="formData.mode"
            class="ml-8"
            :desc="t('为主从集群的主库新增从库')"
            icon="bk-dbm-icon db-icon-shengji"
            :title="t('主库')"
            true-value="master" />
          <CardCheckbox
            v-model="formData.mode"
            class="ml-8"
            :desc="t('为主从集群的从库新增级联从库')"
            icon="bk-dbm-icon db-icon-kelong"
            :title="t('从库')"
            true-value="slave" />
        </div>
      </BkFormItem>
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
          <UpstreamInstanceColumn
            v-model="item.upstreamInstance"
            :mode="formData.mode"
            :selected="selectedInstances"
            @batch-edit="handleBatchEdit" />
          <EditableColumn
            :label="t('所属集群')"
            :min-width="220"
            readonly>
            <EditableBlock :placeholder="t('自动生成')">
              {{
                item.upstreamInstance.ip && item.upstreamInstance.master_domain
                  ? item.upstreamInstance.master_domain
                  : ''
              }}
            </EditableBlock>
          </EditableColumn>
          <ReplicationSourceColumn
            v-if="formData.mode === 'master'"
            v-model="item.copySource"
            :cluster-id="item.upstreamInstance.cluster_id" />
          <SpecColumn
            v-model="item.specId"
            :cluster-type="DBTypes.ORACLE"
            required
            selectable
            @batch-edit="handleBatchEditColumn" />
          <ResourceTagColumn
            v-model="item.resourceTags"
            @batch-edit="handleBatchEditColumn" />
          <AvailableResourceColumn :params="getAvailableResourceParams(item)" />
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

  import { useCreateTicket, useTicketDetail } from '@hooks';

  import { DBTypes, TicketTypes } from '@common/const';

  import CardCheckbox from '@components/db-card-checkbox/CardCheckbox.vue';

  import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
  import AvailableResourceColumn from '@views/db-manage/common/toolbox-field/column/available-resource-column/Index.vue';
  import ResourceTagColumn from '@views/db-manage/common/toolbox-field/column/resource-tag-column/Index.vue';
  import SpecColumn from '@views/db-manage/common/toolbox-field/column/spec-column/Index.vue';
  import TicketPayload, {
    createTicketPayload,
  } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';

  import { random } from '@utils';

  import ReplicationSourceColumn from './components/ReplicationSourceColumn.vue';
  import UpstreamInstanceColumn from './components/UpstreamInstanceColumn.vue';
  import type { HostInfo, UpstreamInstance, UpstreamMode } from './types';
  import { buildHostInfo, createUpstreamInstance } from './types';

  interface RowData {
    // 复制源（主库卡片由后端数据推导，单节点/从库卡片为空）
    copySource: {
      address: string;
      master: HostInfo | null;
      node: HostInfo | null;
      role: string;
    };
    resourceTags: {
      id: number;
      value: string;
    }[];
    specId: number;
    upstreamInstance: UpstreamInstance;
  }

  interface SubmitDetails {
    // 前端拼接：Oracle-{实例版本号}
    db_version: string;
    flow_type: TicketTypes.ORACLE_ADD_SLAVE | TicketTypes.ORACLE_ADD_SLAVE_VIA_CASCADING;
    infos: {
      cluster_id: number;
      old_master?: HostInfo;
      old_node: HostInfo;
      replace_flag: boolean;
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
    // 上游类型：single 单节点 / master 主库 / slave 从库，供单据详情区分
    upstream_type: UpstreamMode;
  }

  defineOptions({ name: TicketTypes.ORACLE_ADD_SLAVE });

  const { t } = useI18n();
  const router = useRouter();
  const tableRef = useTemplateRef('tableRef');

  const currentBizId = window.PROJECT_CONFIG.BIZ_ID;

  const batchInputConfig = [
    {
      case: '10.1.20.40:1521',
      key: 'upstream_instance',
      label: t('上游实例'),
    },
  ];

  const createTableRow = (data: DeepPartial<RowData> = {}): RowData => ({
    copySource: Object.assign(
      {
        address: '',
        master: null as HostInfo | null,
        node: null as HostInfo | null,
        role: '',
      },
      data.copySource,
    ),
    resourceTags: (data.resourceTags || []) as RowData['resourceTags'],
    specId: data.specId || 0,
    upstreamInstance: createUpstreamInstance(data.upstreamInstance),
  });

  const defaultData = () => ({
    mode: 'single' as UpstreamMode,
    payload: createTicketPayload(),
    tableData: [createTableRow()],
  });

  const formData = reactive(defaultData());
  const tableKey = ref(random());

  const selectedInstances = computed(() =>
    formData.tableData.filter((item) => item.upstreamInstance.instance_address).map((item) => item.upstreamInstance),
  );

  // 主库卡片按行推导：推导出正常从库（级联新增）提交 VIA_CASCADING，否则 ORACLE_ADD_SLAVE；单节点/从库固定 ORACLE_ADD_SLAVE
  const submitTicketType = computed(() => {
    if (formData.mode !== 'master') {
      return TicketTypes.ORACLE_ADD_SLAVE;
    }
    const hasCascading = formData.tableData.some(
      (item) => item.upstreamInstance.instance_address && item.copySource.node,
    );
    return hasCascading ? TicketTypes.ORACLE_ADD_SLAVE_VIA_CASCADING : TicketTypes.ORACLE_ADD_SLAVE;
  });

  // AvailableResourceColumn 参数
  const getAvailableResourceParams = (item: RowData) => ({
    for_bizs: [currentBizId, 0],
    labels: item.resourceTags.map((tag) => tag.id).join(','),
    resource_types: [DBTypes.ORACLE, 'PUBLIC'],
    spec_id: item.specId,
  });

  const isApplying = ref(false);

  // 回填：两个 ticket_type 都支持
  [TicketTypes.ORACLE_ADD_SLAVE, TicketTypes.ORACLE_ADD_SLAVE_VIA_CASCADING].forEach((ticketType) => {
    useTicketDetail(ticketType, {
      onSuccess(ticketDetail) {
        applyTicketDetail(ticketDetail);
      },
    });
  });

  // 兼容无 port 的存量单据：有 port 拼接 ip:port，否则仅展示 ip
  const formatAddress = (host?: { ip?: string; port?: number }) => {
    if (!host?.ip) {
      return '';
    }
    return host.port ? `${host.ip}:${host.port}` : host.ip;
  };

  const applyTicketDetail = (ticketDetail: any) => {
    isApplying.value = true;
    const { details } = ticketDetail;
    const { clusters, infos } = details;
    // 回填上游类型：直接取协议 upstream_type，存量单据无该字段时回退 single
    Object.assign(formData, {
      mode: ['master', 'single', 'slave'].includes(details.upstream_type)
        ? details.upstream_type
        : 'single',
      payload: createTicketPayload(ticketDetail),
      tableData: infos.map((item: any) =>
        createTableRow({
          copySource: {
            // 级联场景：old_master 为主库（复制源），old_node 为正常从库（上游实例）
            address: formatAddress(item.old_master),
            master: item.old_master ? buildHostInfo(item.old_master) : null,
            node: item.old_master ? buildHostInfo(item.old_node) : null,
            role: item.old_master ? 'primary' : '',
          },
          resourceTags: (item.resource_spec?.oracle?.labels || []).map((labelId: number, index: number) => ({
            id: Number(labelId),
            value: item.resource_spec?.oracle?.label_names?.[index] || '',
          })),
          specId: item.resource_spec?.oracle?.spec_id || 0,
          upstreamInstance: createUpstreamInstance({
            bk_biz_id: item.old_node?.bk_biz_id || window.PROJECT_CONFIG.BIZ_ID,
            bk_cloud_id: item.old_node?.bk_cloud_id || 0,
            bk_host_id: item.old_node?.bk_host_id || 0,
            cluster_id: item.cluster_id,
            instance_address: formatAddress(item.old_node),
            ip: item.old_node?.ip || '',
            master_domain: clusters?.[item.cluster_id]?.immute_domain || '',
            port: item.old_node?.port || 0,
            role: '',
            version: (details.db_version || '').replace(/^Oracle-/, ''),
          }),
        }),
      ),
    });
    nextTick(() => {
      isApplying.value = false;
    });
  };

  // 两个 ticket_type 的提交 hook
  const { loading: isSubmittingAddSlave, run: runAddSlave } = useCreateTicket<SubmitDetails>(
    TicketTypes.ORACLE_ADD_SLAVE,
  );

  const { loading: isSubmittingViaCascading, run: runViaCascading } = useCreateTicket<SubmitDetails>(
    TicketTypes.ORACLE_ADD_SLAVE_VIA_CASCADING,
  );

  const isSubmitting = computed(() => isSubmittingAddSlave.value || isSubmittingViaCascading.value);

  // 切换上游类型：重置表格并重新渲染，回填场景跳过
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

  // 批量追加：仅首行为空表单时保留全部既有行，否则清空重建
  const appendRows = (rows: RowData[], isClear = false) => {
    if (isClear) {
      tableKey.value = random();
      formData.tableData = [...rows];
      return;
    }
    const keep = formData.tableData[0].upstreamInstance.instance_address ? formData.tableData : [];
    formData.tableData = [...keep, ...rows];
  };

  // 主库卡片按行推导：推导出正常从库（级联新增）提交 VIA_CASCADING 并传 old_master，否则 ORACLE_ADD_SLAVE；单节点/从库固定 ORACLE_ADD_SLAVE
  const buildSubmitDetails = (): SubmitDetails => {
    const infos = formData.tableData.map((item) => {
      const info: SubmitDetails['infos'][number] = {
        cluster_id: item.upstreamInstance.cluster_id,
        old_node: buildHostInfo(item.upstreamInstance),
        replace_flag: false,
        resource_spec: {
          oracle: {
            count: 1,
            label_names: item.resourceTags.map((tag) => tag.value),
            labels: item.resourceTags.map((tag) => String(tag.id)),
            spec_id: item.specId,
          },
        },
      };
      // 级联场景：old_node 为正常从库，old_master 为主库
      if (item.copySource.node) {
        info.old_node = buildHostInfo(item.copySource.node);
        info.old_master = buildHostInfo(item.upstreamInstance);
      }
      return info;
    });
    return {
      // 后端要求前端拼接版本号：Oracle-{实例版本号}
      db_version: `Oracle-${formData.tableData[0]?.upstreamInstance.version || ''}`,
      flow_type: submitTicketType.value,
      infos,
      ip_source: 'resource_pool',
      // 上游类型：与卡片选择一致，单据详情据此区分
      upstream_type: formData.mode,
    };
  };

  const handleSubmit = () => {
    tableRef.value!.validate().then(() => {
      const payload = {
        details: buildSubmitDetails(),
        ...formData.payload,
      };
      if (submitTicketType.value === TicketTypes.ORACLE_ADD_SLAVE_VIA_CASCADING) {
        runViaCascading(payload);
      } else {
        runAddSlave(payload);
      }
    });
  };

  const handleReset = () => {
    Object.assign(formData, defaultData());
  };

  const handleBatchEdit = (list: any[]) => {
    const selectedKeys = new Set(selectedInstances.value.map((item) => item.instance_address));
    const dataList = list
      .filter((item) => !selectedKeys.has(item.instance_address))
      .map((item) =>
        createTableRow({
          upstreamInstance: {
            bk_cloud_id: item.bk_cloud_id || 0,
            bk_host_id: item.bk_host_id || 0,
            cluster_id: item.cluster_id,
            instance_address: item.instance_address,
            ip: item.ip,
            master_domain: item.master_domain,
            port: item.port,
            role: item.role,
            version: item.version || '',
          },
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
        upstreamInstance: {
          instance_address: (item.upstream_instance as string) || '',
          ip: (item.upstream_instance as string)?.split(':')[0] || '',
          port: Number((item.upstream_instance as string)?.split(':')[1]) || 0,
        },
      }),
    );
    appendRows(dataList, isClear);
  };

  defineExpose({
    routerBack() {
      router.push({
        name: 'OracleToolboxIndex',
      });
    },
  });
</script>
<style lang="less" scoped>
  .mode-cards {
    display: flex;
    align-items: stretch;
  }
</style>
