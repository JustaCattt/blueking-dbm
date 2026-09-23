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
      theme="warning"
      :title="t('主库故障切换：主库异常时强制提升从库为主，仅适用于主从集群。')" />
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
        class="mt-16 mb-16"
        :model="formData.tableData">
        <EditableRow
          v-for="(item, index) in formData.tableData"
          :key="index">
          <MasterColumn
            v-model="item.master"
            :selected="selectedMasters"
            @batch-edit="handleBatchEdit" />
          <SlaveColumn
            v-model="item.slave"
            :master="item.master" />
          <EditableColumn
            field="master.master_domain"
            :label="t('关联集群')"
            :min-width="220"
            readonly
            required>
            <EditableBlock :placeholder="t('自动生成')">
              <span v-if="item.master.master_domain">{{ item.master.master_domain }}</span>
            </EditableBlock>
          </EditableColumn>
          <OperationColumn
            v-model:table-data="formData.tableData"
            :create-row-method="createTableRow" />
        </EditableRow>
      </EditableTable>
      <BkFormItem class="mb-8">
        <BkCheckbox v-model="formData.is_check_process">
          {{ t('检查业务连接') }}
        </BkCheckbox>
      </BkFormItem>
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
  import type { Oracle } from '@services/model/ticket/ticket';

  import { useCreateTicket, useTicketDetail } from '@hooks';

  import { TicketTypes } from '@common/const';

  import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
  import OperationColumn from '@views/db-manage/common/toolbox-field/column/operation-column/Index.vue';
  import TicketPayload, {
    createTicketPayload,
  } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';

  import { random } from '@utils';

  import MasterColumn from './components/MasterColumn.vue';
  import SlaveColumn from './components/SlaveColumn.vue';
  import type { FailOverMaster, HostInfo } from './types';
  import { createFailOverMaster } from './types';

  interface RowData {
    master: FailOverMaster;
    slave: HostInfo;
  }

  defineOptions({ name: TicketTypes.ORACLE_MASTER_FAIL_OVER });

  const { t } = useI18n();
  const router = useRouter();
  const tableRef = useTemplateRef('tableRef');

  const batchInputConfig = [
    {
      case: '10.1.20.31',
      key: 'ip',
      label: t('主库主机'),
    },
  ];

  const createTableRow = (data: DeepPartial<RowData> = {}): RowData => ({
    master: createFailOverMaster(data.master),
    slave: {
      bk_biz_id: data.slave?.bk_biz_id || 0,
      bk_cloud_id: data.slave?.bk_cloud_id || 0,
      bk_host_id: data.slave?.bk_host_id || 0,
      ip: data.slave?.ip || '',
    },
  });

  const defaultData = () => ({
    is_check_process: true,
    payload: createTicketPayload(),
    tableData: [createTableRow()],
  });

  const formData = reactive(defaultData());
  const tableKey = ref(random());

  const selectedMasters = computed(() =>
    formData.tableData.filter((item) => item.master.bk_host_id).map((item) => item.master),
  );

  // 回填：单据详情 infos 还原表格行
  useTicketDetail<Oracle.oracleMasterFailOver>(TicketTypes.ORACLE_MASTER_FAIL_OVER, {
    onSuccess(ticketDetail) {
      const { infos, is_check_process: isCheckProcess } = ticketDetail.details;
      Object.assign(formData, {
        is_check_process: isCheckProcess,
        payload: createTicketPayload(ticketDetail),
        tableData: infos.map((item) =>
          createTableRow({
            master: createFailOverMaster({
              ip: item.master.ip,
            }),
            slave: {
              ip: item.slave.ip,
            },
          }),
        ),
      });
    },
  });

  const { loading: isSubmitting, run: runCreateTicket } = useCreateTicket<{
    infos: {
      cluster_id: number;
      master: HostInfo;
      slave: HostInfo;
    }[];
    is_check_process: boolean;
  }>(TicketTypes.ORACLE_MASTER_FAIL_OVER);

  // 批量追加：仅首行为空表单时保留全部既有行，否则清空重建
  const appendRows = (rows: RowData[], isClear = false) => {
    if (isClear) {
      tableKey.value = random();
      formData.tableData = [...rows];
      return;
    }
    const keep = formData.tableData[0].master.ip ? formData.tableData : [];
    formData.tableData = [...keep, ...rows];
  };

  const handleSubmit = () => {
    tableRef.value!.validate().then(() => {
      runCreateTicket({
        details: {
          infos: formData.tableData.map((item) => ({
            cluster_id: item.master.cluster_id,
            master: {
              bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
              bk_cloud_id: item.master.bk_cloud_id,
              bk_host_id: item.master.bk_host_id,
              ip: item.master.ip,
            },
            slave: {
              bk_biz_id: item.slave.bk_biz_id,
              bk_cloud_id: item.slave.bk_cloud_id,
              bk_host_id: item.slave.bk_host_id,
              ip: item.slave.ip,
            },
          })),
          is_check_process: formData.is_check_process,
        },
        ...formData.payload,
      });
    });
  };

  const handleReset = () => {
    Object.assign(formData, defaultData());
  };

  const handleBatchEdit = (list: OracleHaInstanceModel[]) => {
    const selectedIps = new Set(selectedMasters.value.map((item) => item.ip));
    const dataList = list
      .filter((item) => !selectedIps.has(item.ip))
      .map((item) =>
        createTableRow({
          master: createFailOverMaster({
            bk_cloud_id: item.bk_cloud_id,
            bk_host_id: item.bk_host_id,
            cluster_id: item.cluster_id,
            ip: item.ip,
            master_domain: item.master_domain,
            role: item.role,
          }),
        }),
      );
    appendRows(dataList);
  };

  const handleBatchInput = (data: Record<string, any>[], isClear: boolean) => {
    const dataList = data.map((item) =>
      createTableRow({
        master: createFailOverMaster({
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
