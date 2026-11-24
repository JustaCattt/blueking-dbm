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
    :append-rules="rules"
    :disabled-method="() => cluster.id ? '' : t('请先选择目标集群')"
    field="spider_mnt"
    :label="t('Spider 运维节点')"
    :loading="loading"
    :min-width="200"
    required>
    <EditableSelect
      v-model="modelValue"
      :loading="loading"
      @focus="fetchNodes">
      <DbOption
        v-for="ip in nodes"
        :key="ip"
        :label="ip"
        :value="ip" />
      <template #extension>
        <BkButton
          class="spider-mnt-add"
          text
          theme="primary"
          @click.stop="handleAdd">
          {{ t('+ 添加运维节点') }}
        </BkButton>
      </template>
    </EditableSelect>
  </EditableColumn>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import type TendbClusterModel from '@services/model/tendbcluster/tendbcluster';
  import { getTendbClusterList } from '@services/source/tendbcluster';

  import { TicketTypes } from '@common/const';

  interface Props { cluster: TendbClusterModel }
  const props = defineProps<Props>();
  const modelValue = defineModel<string>({ required: true });
  const { t } = useI18n();
  const router = useRouter();
  const nodes = ref<string[]>([]);
  const loading = ref(false);
  let version = 0;
  const rules = [{
    message: t('请选择目标集群的 Spider 运维节点'),
    trigger: 'blur',
    validator: (value: string) => !value || (!loading.value && nodes.value.includes(value)),
  }];
  const fetchNodes = async () => {
    const id = props.cluster.id;
    const current = ++version;
    if (!id) {
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const result = await getTendbClusterList({ cluster_ids: String(id) });
      if (current !== version || props.cluster.id !== id) return;
      nodes.value = [...new Set(result.results[0]?.spider_mnt.map((node) => node.ip) || [])];
      if (modelValue.value && !nodes.value.includes(modelValue.value)) modelValue.value = '';
      if (!modelValue.value && nodes.value.length === 1) modelValue.value = nodes.value[0];
    } catch {
      if (current === version) nodes.value = [];
    } finally {
      if (current === version) loading.value = false;
    }
  };
  watch(() => props.cluster.id, (id, oldId) => {
    version += 1;
    nodes.value = [];
    if (oldId !== undefined && oldId !== id) modelValue.value = '';
    fetchNodes();
  }, { immediate: true });
  const handleAdd = () => {
    const url = router.resolve({
      name: TicketTypes.TENDBCLUSTER_SPIDER_MNT_APPLY,
      query: { cluster_id: props.cluster.id, count: 1 },
    }).href;
    window.open(url, '_blank', 'noopener');
  };
</script>
<style lang="less" scoped>
  .spider-mnt-add.bk-button.is-text {
    width: 100%;
    height: 100%;
    padding: 8px 12px;
    font-size: 14px;
    text-align: left;
    justify-content: flex-start;

    &:hover {
      background: #f5f7fa;
    }
  }
</style>
