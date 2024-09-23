<template>
  <DbCard
    class="summary-view-list"
    mode="collapse"
    :title="t('分布情况')">
    <SearchBox
      ref="searchRef"
      v-model="dbType"
      @change="handleChangeDbType"
      @search="fetchListData" />
    <div class="opearte-row">
      <DimensionSelect
        v-model="dimension"
        @change="handleChangeDimension" />
      <Export
        :data="tableData"
        :dimension="dimension" />
    </div>
    <BkLoading
      ref="loadingRef"
      :loading="loading">
      <BkTable
        class="summary-view-table"
        :data="tableData"
        :pagination="pagination"
        remote-pagination
        show-overflow-tooltip
        @page-limit-change="handeChangeLimit"
        @page-value-change="handleChangePage">
        <BkTableColumn
          :label="t('地域')"
          prop="city"
          :width="150" />
        <template v-if="isSpec">
          <BkTableColumn
            :label="t('规格类型')"
            prop="spec_type_display" />
          <BkTableColumn
            :label="t('规格')"
            prop="spec_name" />
        </template>
        <template v-else>
          <BkTableColumn
            :label="t('机型（硬盘）')"
            prop="device_display" />
          <BkTableColumn
            :label="t('CPU 内存')"
            prop="cpu_mem_summary" />
        </template>
        <BkTableColumn
          :label="t('园区分布（台）')"
          prop="sub_zone_detail">
          <template #default="{ row }">
            <span
              v-for="(item, subzoneId, index) in row.sub_zone_detail"
              :key="subzoneId">
              <span>{{ item.name }} : </span>
              <span
                class="cell-num"
                @click="handleClick(row, subzoneId)">
                {{ item.count }}
              </span>
              <span>{{ index === Object.keys(row.sub_zone_detail).length - 1 ? '' : ' , ' }}</span>
            </span>
          </template>
        </BkTableColumn>
        <BkTableColumn
          :label="t('总数（台）')"
          prop="count"
          :width="100">
          <template #default="{ row }">
            <span
              class="cell-num"
              :class="{
                'cell-num--zero': row.count === 0,
              }"
              @click="handleClick(row)">
              {{ row.count }}
            </span>
          </template>
        </BkTableColumn>
      </BkTable>
    </BkLoading>
  </DbCard>
</template>

<script setup lang="ts">
  import BkLoading from 'bkui-vue/lib/loading';
  import { useI18n } from 'vue-i18n';
  import { useRequest } from 'vue-request';

  import type SummaryModel from '@services/model/db-resource/summary';
  import { getSummaryList } from '@services/source/dbresourceResource';

  import { useDefaultPagination } from '@hooks';

  import { DBTypes } from '@common/const';

  import DimensionSelect from './DimensionSelect.vue';
  import Export from './Export.vue';
  import type { DbSelectValue } from './search-box/components/Db.vue';
  import SearchBox from './search-box/Index.vue';

  const { t } = useI18n();
  const router = useRouter();

  const searchRef = ref<InstanceType<typeof SearchBox>>();
  const loadingRef = ref();
  const dbType = ref<DbSelectValue>(DBTypes.REDIS);
  const dimension = ref<'spec' | 'device_class'>('spec');
  const pagination = ref(useDefaultPagination());
  const isAnomalies = ref(false);
  const allTableData = shallowRef<SummaryModel[]>([]);

  const isSpec = computed(() => dimension.value === 'spec');
  const tableData = computed(() => {
    const { current, limit } = pagination.value;
    // 计算起始索引
    const startIndex = (current - 1) * limit;
    // 计算结束索引
    const endIndex = startIndex + limit;
    return allTableData.value.slice(startIndex, endIndex);
  });

  const { run: fetchData, loading } = useRequest(getSummaryList, {
    manual: true,
    onSuccess(data) {
      allTableData.value = data.results;
      pagination.value.count = data.count;
      isAnomalies.value = false;
    },
    onError() {
      allTableData.value = [];
      pagination.value.count = 0;
      isAnomalies.value = true;
    },
  });

  const fetchListData = async () => {
    const params = await searchRef.value?.getValue();
    fetchData({
      group_by: dimension.value,
      ...params,
    } as ServiceParameters<typeof getSummaryList>);
  };

  const handleChangeDbType = (value: DbSelectValue) => {
    dbType.value = value;
  };

  const handleChangeDimension = (value: string) => {
    dimension.value = value as 'spec' | 'device_class';
    fetchListData();
  };

  const handleChangePage = (value: number) => {
    pagination.value.current = value;
  };

  const handeChangeLimit = (value: number) => {
    pagination.value.limit = value;
    handleChangePage(1);
  };

  const handleClick = (row: SummaryModel, subzoneId?: number) => {
    const params = {
      for_biz: row.dedicated_biz,
      resource_type: dbType.value,
      city: row.city,
      subzone_ids: subzoneId,
      spec_id: row.spec_id,
    };
    router.push({
      name: 'resourcePool',
      query: {
        tab: 'host-list',
        ...params,
        timestamp: new Date().getTime(), // 添加时间戳以确保每次跳转的 URL 都是唯一的
      },
    });
  };

  onMounted(() => {
    fetchListData();
  });
</script>

<style lang="less" scoped>
  .summary-view-list {
    :deep(.db-card__content) {
      padding: 14px 22px;
    }

    .opearte-row {
      display: flex;
      align-items: center;
    }

    .summary-view-table {
      height: calc(100vh - 400px) !important;
      max-height: none !important;

      :deep(.cell) {
        .cell-num {
          font-weight: bold;
          color: #3a84ff;
          cursor: pointer;
        }

        .cell-num--zero {
          color: #000;
        }
      }
    }
  }
</style>
