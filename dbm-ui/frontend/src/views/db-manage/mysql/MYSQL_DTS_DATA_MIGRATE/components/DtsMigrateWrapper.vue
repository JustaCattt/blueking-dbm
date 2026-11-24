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
  <SmartAction>
    <BkAlert
      class="mb-20"
      closable
      :title="t('DTS 数据迁移：按库表把数据从源集群迁到目标集群，一行对应一对源与目标。异构迁移需逐表确认 shardkey。库级克隆请使用「MySQL DB 数据克隆」。')" />
    <DbForm ref="form" class="db-toolbox mb-24 toolbox-form" form-type="vertical" :model="data">
      <BkFormItem :label="t('迁移方式')" required>
        <CardCheckbox
          v-model="migrateMethod"
          :desc="t('目标库与源库同名，支持按库表筛选和通配')"
          icon="bk-dbm-icon db-icon-copy"
          :title="t('同名迁移')"
          true-value="MYSQL_DTS_DATA_MIGRATE" />
        <CardCheckbox
          v-model="migrateMethod"
          class="ml-8"
          :desc="t('逐库指定目标库名，按整库迁移')"
          icon="bk-dbm-icon db-icon-edit"
          :title="t('库改名迁移')"
          true-value="MYSQL_DTS_DATA_MIGRATE_RENAME" />
        <CardCheckbox
          v-model="migrateMethod"
          class="ml-8"
          :desc="t('迁到 TenDBCluster，需确认 shardkey')"
          icon="bk-dbm-icon db-icon-copy"
          :title="t('异构迁移')"
          true-value="MYSQL_DTS_DATA_MIGRATE_HETERO" />
      </BkFormItem>
      <slot />
    </DbForm>
    <template #action>
      <slot name="action" />
    </template>
  </SmartAction>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import { TicketTypes } from '@common/const';

  import CardCheckbox from '@views/db-manage/common/db-card-checkbox/CardCheckbox.vue';

  import { switchSiblingRoute } from '@utils';

  interface Props {
    data: Record<string, unknown>;
  }

  defineProps<Props>();
  const { t } = useI18n();
  const router = useRouter();
  const route = useRoute();
  const formRef = useTemplateRef('form');
  const migrateMethod = ref((route.meta.ticketType as TicketTypes) || TicketTypes.MYSQL_DTS_DATA_MIGRATE);

  watch(migrateMethod, (value, oldValue) => {
    if (value === route.meta.ticketType) return;
    switchSiblingRoute(
      () => router.push({ name: value }),
      () => {
        migrateMethod.value = oldValue;
      },
    );
  });

  defineExpose({ validate: () => formRef.value!.validate() });
</script>
