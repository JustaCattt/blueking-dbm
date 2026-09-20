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
  <EditableColumn
    :append-rules="rules"
    field="host.ip"
    fixed="left"
    :label="t('主机')"
    :loading="loading"
    :min-width="190"
    required>
    <template #headAppend>
      <span
        v-bk-tooltips="t('从单节点主机与从库所在主机中选择')"
        class="batch-host-select"
        @click="handleShowSelector">
        <DbIcon type="batch-host-select" />
      </span>
    </template>
    <EditableInput
      v-model.trim="modelValue.ip"
      :placeholder="t('请输入主机 IP')"
      @change="handleInputChange" />
  </EditableColumn>
  <EditableColumn
    field="host.role"
    :label="t('角色')"
    :loading="loading"
    :min-width="110"
    readonly>
    <EditableBlock :placeholder="t('自动生成')">
      <span v-if="modelValue.role">{{ modelValue.role }}</span>
    </EditableBlock>
  </EditableColumn>
  <EditableColumn
    field="host.status"
    :label="t('状态')"
    :loading="loading"
    :min-width="100"
    readonly>
    <EditableBlock :placeholder="t('自动生成')">
      <ClusterInstanceStatus
        v-if="modelValue.status"
        :data="modelValue.status" />
    </EditableBlock>
  </EditableColumn>
  <EditableColumn
    field="host.master_domain"
    :label="t('所属集群')"
    :loading="loading"
    :min-width="220"
    readonly>
    <EditableBlock :placeholder="t('自动生成')">
      <span v-if="modelValue.master_domain">{{ modelValue.master_domain }}</span>
    </EditableBlock>
  </EditableColumn>
  <EditableColumn
    field="host.replication_source"
    :label="t('复制源')"
    :loading="loading"
    :min-width="200"
    readonly>
    <EditableBlock :placeholder="t('自动生成')">
      <template v-if="modelValue.replication_source.address">
        <span class="replication-source">
          <span class="replication-source__addr">{{ modelValue.replication_source.address }}</span>
          <span class="replication-source__role">{{ modelValue.replication_source.role }}</span>
        </span>
      </template>
    </EditableBlock>
  </EditableColumn>
  <EditableColumn
    field="host.cluster_type_name"
    :label="t('集群类型')"
    :loading="loading"
    :min-width="110"
    readonly>
    <EditableBlock :placeholder="t('自动生成')">
      <span v-if="modelValue.cluster_type_name">{{ modelValue.cluster_type_name }}</span>
    </EditableBlock>
  </EditableColumn>
  <InstanceSelector
    v-model="selectedInstances"
    v-model:is-show="showSelector"
    :cluster-types="[ClusterTypes.ORACLE_PRIMARY_STANDBY, ClusterTypes.ORACLE_SINGLE_NONE]"
    :data-source-map="dataSourceMap"
    :disable-select-method="disableSelectMethod"
    @change="handleSelectorChange" />
</template>
<script lang="ts" setup>
  import { useI18n } from 'vue-i18n';
  import { useRequest } from 'vue-request';

  import type OracleHaInstanceModel from '@services/model/oracle/oracle-ha-instance';
  import type OracleSingleInstanceModel from '@services/model/oracle/oracle-single-instance';
  import { checkInstance } from '@services/source/dbbase';
  import { getOracleHaInstanceList } from '@services/source/oracleHaCluster';
  import { getOracleSingleInstanceList } from '@services/source/oracleSingleCluster';

  import { ClusterInstStatusKeys, clusterTypeInfos, ClusterTypes, DBTypes } from '@common/const';
  import { ipv4 } from '@common/regex';

  import ClusterInstanceStatus from '@components/cluster-instance-status/Index.vue';
  import InstanceSelector from '@components/instance-selector-new/Index.vue';

  import type { ReplaceHost } from '../types';
  import { createReplaceHost } from '../types';

  type InstanceModel = OracleHaInstanceModel | OracleSingleInstanceModel;

  interface Props {
    selected: {
      instance_address?: string;
      ip: string;
    }[];
  }

  type Emits = (e: 'batch-edit', list: InstanceModel[]) => void;

  const props = defineProps<Props>();

  const emits = defineEmits<Emits>();

  const modelValue = defineModel<ReplaceHost>({
    required: true,
  });

  const { t } = useI18n();

  // 主从 tab 只列从库实例，单节点 tab 列单点实例
  const dataSourceMap = {
    [ClusterTypes.ORACLE_PRIMARY_STANDBY]: (params: ServiceParameters<typeof getOracleHaInstanceList>) =>
      getOracleHaInstanceList({
        ...params,
        role: 'standby',
      }),
    [ClusterTypes.ORACLE_SINGLE_NONE]: (params: ServiceParameters<typeof getOracleSingleInstanceList>) =>
      getOracleSingleInstanceList(params),
  };

  // 表格已录入主机在选择器中禁选
  const disableSelectMethod = (data: InstanceModel) => {
    const existHost = props.selected.find((item) => item.ip === data.ip);
    return existHost ? t('该主机已在表格中') : false;
  };

  const showSelector = ref(false);
  const selectedInstances = computed(() => {
    const list = props.selected.map(
      (item) =>
        ({
          instance_address: item.instance_address || item.ip,
        }) as InstanceModel,
    );
    return {
      [ClusterTypes.ORACLE_PRIMARY_STANDBY]: list,
      [ClusterTypes.ORACLE_SINGLE_NONE]: list,
    };
  });

  const rules = [
    {
      message: t('IP格式有误，请输入合法IP'),
      trigger: 'change',
      validator: (value: string) => !value || ipv4.test(value),
    },
    {
      message: t('主机重复'),
      trigger: 'change',
      validator: (value: string) => !value || props.selected.filter((item) => item.ip === value).length < 2,
    },
    {
      message: t('主机不包含任何从库实例'),
      trigger: 'blur',
      validator: (value: string) => !value || Boolean(modelValue.value.bk_host_id),
    },
  ];

  // 手输主机校验（Oracle 单机单实例，实例即主机；返回 InstanceInfos，无 cluster_type_name/version，需派生）
  const { loading, run: queryHost } = useRequest(checkInstance, {
    manual: true,
    onSuccess: async (data) => {
      const [currentHost] = data;
      // 仅单点实例与从库实例可替换，主库/空主机/非 Oracle 主机报「主机不包含任何从库实例」
      if (
        currentHost &&
        (currentHost.cluster_type === ClusterTypes.ORACLE_SINGLE_NONE || currentHost.role === 'standby')
      ) {
        // 关联集群版本（按 cluster_id 匹配）
        const majorVersion = currentHost.related_clusters?.find(
          (item) => item.id === currentHost.cluster_id,
        )?.major_version;

        // §2.4 复制源推导：
        // - 单节点：复制源为该单点实例 {IP:Port} primary
        // - 从库正常：复制源为该从库 {IP:Port} standby
        // - 从库异常：复制源为主库 {IP:Port} primary（需反查主库实例）
        let replicationSource: { address: string; role: string } = { address: '', role: '' };

        if (currentHost.cluster_type === ClusterTypes.ORACLE_SINGLE_NONE) {
          // 单节点：复制源为自身实例
          replicationSource = {
            address: currentHost.instance_address,
            role: 'primary',
          };
        } else if (currentHost.role === 'standby') {
          if (currentHost.status === ClusterInstStatusKeys.RUNNING) {
            // 从库正常：复制源为该从库自身
            replicationSource = {
              address: currentHost.instance_address,
              role: 'standby',
            };
          } else {
            // 从库异常：复制源为主库，需反查
            try {
              const [masterInstance] = (
                await getOracleHaInstanceList({
                  cluster_id: currentHost.cluster_id,
                  role: 'primary',
                })
              ).results;
              if (masterInstance) {
                replicationSource = {
                  address: masterInstance.instance_address,
                  role: 'primary',
                };
              }
            } catch {
              // 反查失败：复制源留空，后端 validate 兜底
            }
          }
        }

        modelValue.value = createReplaceHost({
          bk_cloud_id: currentHost.bk_cloud_id,
          bk_host_id: currentHost.bk_host_id,
          cluster_id: currentHost.cluster_id,
          cluster_type: currentHost.cluster_type,
          // 返回无 cluster_type_name，按集群类型映射派生
          cluster_type_name: clusterTypeInfos[currentHost.cluster_type]?.name || '',
          instance_address: currentHost.instance_address,
          ip: currentHost.ip,
          master_domain: currentHost.master_domain,
          port: currentHost.port,
          replication_source: replicationSource,
          role: currentHost.role,
          specId: currentHost.spec_config?.id || 0,
          status: currentHost.status,
          // version 兜底：关联集群版本 / 单据回显版本，均无则空串（提交仍拼 Oracle-）
          version: (majorVersion || modelValue.value.version || '').replace(/^Oracle-/, ''),
        });
      }
    },
  });

  const handleShowSelector = () => {
    showSelector.value = true;
  };

  const handleInputChange = (value: string) => {
    // 手输 IP：重置反查要素，触发 watch 校验主机候选资格
    modelValue.value = createReplaceHost({
      ip: value,
    });
  };

  const handleSelectorChange = (selected: {
    [ClusterTypes.ORACLE_PRIMARY_STANDBY]: OracleHaInstanceModel[];
    [ClusterTypes.ORACLE_SINGLE_NONE]: OracleSingleInstanceModel[];
  }) => {
    emits(
      'batch-edit',
      Object.values(selected).flatMap((item) => item),
    );
  };

  // §2.4 选择器路径补充：异常从库复制源地址为空（role=primary），需反查主库实例填充
  const { run: queryMasterForReplicationSource } = useRequest(getOracleHaInstanceList, {
    manual: true,
    onSuccess: (data) => {
      const [masterInstance] = data.results;
      if (masterInstance) {
        modelValue.value = {
          ...modelValue.value,
          replication_source: {
            address: masterInstance.instance_address,
            role: 'primary',
          },
        };
      }
    },
  });

  watch(
    modelValue,
    () => {
      if (modelValue.value.ip && !modelValue.value.bk_host_id) {
        queryHost({
          bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
          cluster_type: [ClusterTypes.ORACLE_SINGLE_NONE, ClusterTypes.ORACLE_PRIMARY_STANDBY],
          db_type: DBTypes.ORACLE,
          instance_addresses: [modelValue.value.ip],
        });
      }
      // 选择器路径：异常从库复制源地址缺失，反查主库补充
      if (
        modelValue.value.bk_host_id &&
        modelValue.value.cluster_type === ClusterTypes.ORACLE_PRIMARY_STANDBY &&
        modelValue.value.role === 'standby' &&
        modelValue.value.status !== ClusterInstStatusKeys.RUNNING &&
        !modelValue.value.replication_source.address
      ) {
        queryMasterForReplicationSource({
          cluster_id: modelValue.value.cluster_id,
          role: 'primary',
        });
      }
    },
    {
      immediate: true,
    },
  );
</script>
<style lang="less" scoped>
  .batch-host-select {
    font-size: 14px;
    color: #3a84ff;
    cursor: pointer;
  }

  .replication-source {
    display: inline-flex;
    column-gap: 8px;
    align-items: baseline;

    &__addr {
      color: #313238;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 12px;
    }

    &__role {
      color: #979ba5;
      font-size: 12px;
    }
  }
</style>
