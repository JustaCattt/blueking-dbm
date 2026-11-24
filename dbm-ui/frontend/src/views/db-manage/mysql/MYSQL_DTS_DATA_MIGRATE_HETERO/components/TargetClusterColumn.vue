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
  <EditableColumn
    ref="column"
    :append-rules="rules"
    :disabled-method="() => (sourceId ? '' : t('请先选择源集群'))"
    field="target_cluster.master_domain"
    :label="t('目标集群')"
    :loading="loading"
    :min-width="280"
    required>
    <EditableInput
      v-model="modelValue.master_domain"
      :placeholder="t('请输入集群域名')"
      @change="handleInput">
      <template #append>
        <DbIcon
          class="target-cluster-select"
          type="host-select"
          @click="showSelector = true" />
      </template>
    </EditableInput>
  </EditableColumn>
  <ClusterSelector
    v-model:is-show="showSelector"
    :append-mode="false"
    :cluster-types="[ClusterTypes.TENDBCLUSTER]"
    :selected="{ [ClusterTypes.TENDBCLUSTER]: modelValue.id ? [modelValue] : [] }"
    :tab-list-config="tabListConfig"
    @change="handleSelect" />
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import TendbClusterModel from '@services/model/tendbcluster/tendbcluster';
  import { getTendbClusterList } from '@services/source/tendbcluster';

  import { ClusterTypes } from '@common/const';
  import { domainRegex } from '@common/regex';

  import ClusterSelector, { type TabConfig } from '@components/cluster-selector/Index.vue';

  interface Props {
    sourceId: number;
  }
  defineProps<Props>();
  const modelValue = defineModel<TendbClusterModel>({ required: true });
  const { t } = useI18n();
  const columnRef = useTemplateRef('column');
  const showSelector = ref(false);
  const loading = ref(false);
  // 单选是「替换当前值」，不追加；id、name 由 ClusterSelector 的默认 tab 配置补齐
  const tabListConfig = {
    [ClusterTypes.TENDBCLUSTER]: { multiple: false } as TabConfig,
  } as Record<string, TabConfig>;
  let queryVersion = 0;
  const rules = [
    {
      message: t('集群域名格式不正确'),
      trigger: 'change',
      validator: (value: string) => !value || domainRegex.test(value),
    },
    {
      message: t('目标集群不存在'),
      trigger: 'blur',
      validator: (value: string) => !value || Boolean(modelValue.value.id),
    },
    {
      message: t('目标集群必须属于当前业务'),
      trigger: 'blur',
      validator: () => !modelValue.value.id || modelValue.value.bk_biz_id === window.PROJECT_CONFIG.BIZ_ID,
    },
  ];
  const handleInput = (domain: string) => {
    modelValue.value = new TendbClusterModel({ master_domain: domain } as ConstructorParameters<
      typeof TendbClusterModel
    >[0]);
  };
  const handleSelect = (selected: Record<string, TendbClusterModel[]>) => {
    const cluster = selected[ClusterTypes.TENDBCLUSTER]?.[0];
    if (cluster) modelValue.value = cluster;
  };
  watch(
    () => modelValue.value.master_domain,
    async (domain) => {
      const version = ++queryVersion;
      if (!domain || modelValue.value.id) {
        loading.value = false;
        return;
      }
      loading.value = true;
      try {
        const result = await getTendbClusterList({ exact_domain: domain });
        if (version !== queryVersion || modelValue.value.master_domain !== domain) return;
        const cluster = result.results[0];
        if (cluster) modelValue.value = cluster;
        else columnRef.value?.validate().catch(() => {});
      } catch {
        // 请求层展示错误，目标 ID 保持为空，提交时存在性校验拦截。
      } finally {
        if (version === queryVersion) loading.value = false;
      }
    },
    { immediate: true },
  );
</script>
<style lang="less" scoped>
  .target-cluster-select {
    font-size: 14px;
    color: #979ba5;
    cursor: pointer;

    &:hover {
      color: #3a84ff;
    }
  }
</style>
