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
  <BkSideslider
    :is-show="isShow"
    :title="t('编辑库映射')"
    :width="640"
    @closed="handleClose">
    <div class="db-mapping-sideslider">
      <div class="mb-16">
        <BkButton
          theme="primary"
          @click="handleAddRow">
          {{ t('新增映射') }}
        </BkButton>
      </div>
      <EditableTable
        ref="mappingTableRef"
        :model="mappingData">
        <EditableRow
          v-for="(item, index) in mappingData"
          :key="index">
          <EditableColumn
            :append-rules="sourceDbRules(index)"
            field="source_db"
            :label="t('源库')"
            :min-width="200"
            required>
            <EditableInput
              v-model="item.source_db"
              :placeholder="t('请输入源库名')" />
          </EditableColumn>
          <EditableColumn
            :append-rules="targetDbRules(index)"
            field="target_db"
            :label="t('目标库')"
            :min-width="200"
            required>
            <DbInput
              v-model="item.target_db"
              :placeholder="t('请输入目标库名')" />
          </EditableColumn>
          <OperationColumn
            v-model:table-data="mappingData"
            :create-row-method="createMappingRow" />
        </EditableRow>
      </EditableTable>
    </div>
    <template #footer>
      <BkButton
        class="mr-8"
        theme="primary"
        @click="handleConfirm">
        {{ t('确定') }}
      </BkButton>
      <BkButton @click="handleClose">
        {{ t('取消') }}
      </BkButton>
    </template>
  </BkSideslider>
</template>
<script lang="ts" setup>
  import _ from 'lodash';
  import { reactive, useTemplateRef } from 'vue';
  import { useI18n } from 'vue-i18n';

  import OperationColumn from '@views/db-manage/common/toolbox-field/column/operation-column/Index.vue';

  interface DbMapping {
    source_db: string;
    target_db: string;
  }

  const props = defineProps<{
    data: DbMapping[];
    isShow: boolean;
  }>();

  const emits = defineEmits<{
    (e: 'update:isShow', value: boolean): void;
    (e: 'confirm', value: DbMapping[]): void;
  }>();

  const { t } = useI18n();

  const mappingTableRef = useTemplateRef('mappingTableRef');

  const mappingData = reactive<DbMapping[]>([]);

  const createMappingRow = () => ({
    source_db: '',
    target_db: '',
  });

  const sourceDbRules = (currentIndex: number) => [
    {
      message: t('源库不可重复'),
      trigger: 'change',
      validator: (value: string) =>
        !value || mappingData.filter((_, i) => i !== currentIndex).every((item) => item.source_db !== value),
    },
  ];

  const targetDbRules = (currentIndex: number) => [
    {
      message: t('目标库不可重复'),
      trigger: 'change',
      validator: (value: string) =>
        !value || mappingData.filter((_, i) => i !== currentIndex).every((item) => item.target_db !== value),
    },
  ];

  watch(
    () => props.isShow,
    (show) => {
      if (show) {
        mappingData.splice(
          0,
          mappingData.length,
          ...(props.data.length ? _.cloneDeep(props.data) : [createMappingRow()]),
        );
      }
    },
  );

  const handleAddRow = () => {
    mappingData.push(createMappingRow());
  };

  const handleConfirm = async () => {
    const result = await mappingTableRef.value?.validate();
    if (!result) {
      return;
    }
    emits('confirm', _.cloneDeep(mappingData));
    emits('update:isShow', false);
  };

  const handleClose = () => {
    emits('update:isShow', false);
  };
</script>
<style lang="less" scoped>
  .db-mapping-sideslider {
    padding: 20px 24px;
  }
</style>
