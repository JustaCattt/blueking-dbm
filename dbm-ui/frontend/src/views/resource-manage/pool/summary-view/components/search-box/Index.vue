<template>
  <BkForm
    class="search-box"
    form-type="vertical">
    <BkFormItem
      :label="t('所属业务')"
      required>
      <Biz
        ref="bizRef"
        @change="handleSearch" />
    </BkFormItem>
    <BkFormItem
      :label="t('所属DB类型')"
      required>
      <Db
        v-model="dbType"
        @change="handleChange" />
    </BkFormItem>
    <BkFormItem :label="t('地域 - 园区')">
      <Region
        ref="regionRef"
        @change="handleSearch" />
    </BkFormItem>
    <BkFormItem :label="t('规格')">
      <Spec
        ref="specRef"
        :db-type="dbType"
        @change="handleSearch" />
    </BkFormItem>
  </BkForm>
</template>

<script setup lang="ts">
  import _ from 'lodash';
  import { useI18n } from 'vue-i18n';

  import { ClusterTypes, DBTypes, MachineTypes } from '@common/const';

  import Biz from './components/Biz.vue';
  import Db, { type DbSelectValue } from './components/Db.vue';
  import Region from './components/Region.vue';
  import Spec from './components/Spec.vue';

  interface Emits {
    (e: 'search'): void;
    (e: 'change', value: DbSelectValue): void;
  }

  interface Exposes {
    getValue: () => Promise<{
      for_biz: number;
      city?: string;
      sub_zones?: string[];
      spec_param: {
        db_type: DbSelectValue;
        machine_type?: MachineTypes;
        cluster_type?: ClusterTypes;
        spec_id_list?: number[];
      };
    }>;
  }

  const emits = defineEmits<Emits>();

  const dbType = defineModel<DbSelectValue>('dbType', {
    default: DBTypes.REDIS,
  });

  const { t } = useI18n();

  const bizRef = ref<InstanceType<typeof Biz>>();
  const regionRef = ref<InstanceType<typeof Region>>();
  const specRef = ref<InstanceType<typeof Spec>>();

  const handleSearch = () => {
    emits('search');
  };

  const handleChange = (value: DbSelectValue) => {
    specRef.value!.reset();
    emits('change', value);
    nextTick(() => {
      handleSearch();
    });
  };

  const filterEmptyValues = (obj: any): any =>
    _.pickBy(obj, (value) => value !== '' && (!_.isArray(value) || !_.isEmpty(value)));

  defineExpose<Exposes>({
    getValue() {
      return Promise.all([bizRef.value!.getValue(), regionRef.value!.getValue(), specRef.value!.getValue()]).then(
        ([biz, region, spec]) =>
          filterEmptyValues({
            ...biz,
            ...region,
            spec_param: filterEmptyValues(spec.spec_param),
          }),
      );
    },
  });
</script>

<style lang="less" scoped>
  .search-box {
    display: flex;

    :deep(.bk-form-item) {
      margin-bottom: 0;

      .bk-form-label {
        font-weight: initial;
      }

      & ~ .bk-form-item {
        margin-left: 16px;
      }

      &:nth-child(-n + 2) {
        flex: 1;
      }

      &:nth-last-child(2) {
        flex: 1.5;
      }

      &:nth-last-child(1) {
        flex: 2;
      }
    }
  }
</style>
