<template>
  <div class="spider-manage-paritition-page">
    <div class="header-action mb-16">
      <AuthButton
        action-id="mysql_partition_create"
        class="w-88"
        theme="primary"
        @click="handleCreate">
        {{ t('添加策略') }}
      </AuthButton>
      <AuthButton
        action-id="mysql_partition_create"
        class="w-88 ml-8"
        @click="handleShowExcelImport">
        {{ t('导入策略') }}
      </AuthButton>
      <BkDropdown
        v-bk-tooltips="{
          disabled: !disabled,
          content: t('请选择策略'),
        }"
        class="batch-operation ml-8"
        :disabled="disabled"
        :popover-options="{
          renderDirective: 'show',
          hideIgnoreReference: true,
        }">
        <template #default="{ popoverShow }">
          <BkButton :disabled="disabled">
            {{ t('批量操作') }}
            <DbIcon
              class="batch-operation-icon ml-4"
              :class="[{ 'batch-operation-icon-active': popoverShow }]"
              type="up-big " />
          </BkButton>
        </template>
        <template #content>
          <BkDropdownMenu>
            <BkDropdownItem>
              <BkButton
                :disabled="disabled"
                text
                @click="handleBatchExecute">
                {{ t('批量执行') }}
              </BkButton>
            </BkDropdownItem>
            <BkDropdownItem>
              <BkButton
                :disabled="disabled"
                text
                @click="handleBatchExport">
                {{ t('批量导出') }}
              </BkButton>
            </BkDropdownItem>
            <BkDropdownItem>
              <BkButton
                :disabled="disabled"
                text
                @click="handleBatchEnable">
                {{ t('批量启用') }}
              </BkButton>
            </BkDropdownItem>
            <BkDropdownItem>
              <BkButton
                :disabled="disabled"
                text
                @click="handleBatchDisable">
                {{ t('批量禁用') }}
              </BkButton>
            </BkDropdownItem>
            <BkDropdownItem>
              <BkButton
                :disabled="disabled"
                text
                @click="handleBatchRemove">
                {{ t('批量删除') }}
              </BkButton>
            </BkDropdownItem>
          </BkDropdownMenu>
        </template>
      </BkDropdown>
      <DbQuickSearch
        v-model="searchValue"
        :data="serachData"
        parse-url
        :placeholder="t('输入关键字或选择条件搜索')"
        style="width: 500px; margin-left: auto"
        @change="handleSearch" />
    </div>
    <DbTable
      ref="tableRef"
      :bk-ui-settings="tableSetting"
      class="partition-table"
      :data-source="dataSource"
      releate-url-query
      :row-class="getRowClass"
      row-key="id"
      selectable
      @clear-search="handleClearSearch"
      @selection="handleTableSelection"
      @setting-change="handleSettingChange">
      <TableColumn
        col-key="id"
        fixed="left"
        title="ID"
        :width="100">
        <template #default="{ row }: { row: PartitionModel }">
          <span
            v-bk-tooltips="{
              content: t('正在执行中，无法编辑'),
              disabled: !row.isRunning,
            }">
            <AuthButton
              action-id="mysql_partition_update"
              :disabled="row.isRunning"
              :permission="row.permission.mysql_partition_update"
              :resource="row.cluster_id"
              text
              theme="primary"
              @click="handleEdit(row)">
              {{ row.id }}
            </AuthButton>
          </span>
          <BkTag
            v-if="row.isNew"
            class="ml-4"
            size="small"
            theme="success">
            NEW
          </BkTag>
          <BkTag
            v-if="row.isOffline"
            class="ml-4"
            size="small">
            {{ t('已禁用') }}
          </BkTag>
        </template>
      </TableColumn>
      <TableColumn
        col-key="immute_domain"
        :title="t('集群')"
        :width="240">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.immute_domain || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="dblike"
        :title="t('DB 名')"
        :width="120">
        <template #default="{ row }: { row: PartitionModel }">
          <span v-if="!row.dblike">--</span>
          <BkTag>{{ row.dblike }}</BkTag>
        </template>
      </TableColumn>
      <TableColumn
        col-key="tblike"
        :title="t('表名')"
        :width="160">
        <template #default="{ row }: { row: PartitionModel }">
          <span v-if="!row.tblike">--</span>
          <BkTag>{{ row.tblike }}</BkTag>
        </template>
      </TableColumn>
      <TableColumn
        col-key="partition_column"
        :title="t('分区字段')"
        :width="140">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.partition_column || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="partition_column_type"
        :title="t('字段类型')"
        :width="140">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.partition_column_type || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="partition_time_interval"
        :title="t('分区间隔（天）')"
        :width="140">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.partition_time_interval || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="expire_time"
        :title="t('数据过期时间（天）')"
        :width="140">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.expire_time || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="status"
        :title="t('最近执行状态')"
        :width="180">
        <template #default="{ row }: { row: PartitionModel }">
          <DbIcon
            :class="{ 'rotate-loading': row.isRunning }"
            style="vertical-align: middle"
            svg
            :type="row.statusIcon" />
          <span class="ml-4">{{ row.statusText }}</span>
          <DbIcon
            v-if="row.status === PartitionModel.STATUS_FAILED"
            v-bk-tooltips="t('查看失败日志')"
            class="ml-4"
            style="vertical-align: middle; cursor: pointer; color: #3a84ff"
            type="bk-dbm-icon db-icon-form"
            @click="handleShowFailLog(row)" />
        </template>
      </TableColumn>
      <TableColumn
        col-key="execute_time"
        :title="t('最近执行时间')"
        :width="240">
        <template #default="{ row }: { row: PartitionModel }">
          {{ row.execute_time || '--' }}
        </template>
      </TableColumn>
      <TableColumn
        col-key="operation"
        fixed="right"
        :title="t('操作')"
        :width="140">
        <template #default="{ row }: { row: PartitionModel }">
          <!-- 执行中状态：显示查看 -->
          <template v-if="row.isRunning">
            <RouterLink
              target="_blank"
              :to="{
                name: 'bizTicketManage',
                params: { ticketId: row.ticket_id },
              }">
              {{ t('查看') }}
            </RouterLink>
          </template>
          <!-- 离线状态：显示启用 -->
          <template v-else-if="!row.isOnline">
            <AuthButton
              action-id="mysql_partition_enable_disable"
              :permission="row.permission.mysql_partition_enable_disable"
              :resource="row.cluster_id"
              text
              theme="primary"
              @click="handleEnable(row)">
              {{ t('启用') }}
            </AuthButton>
          </template>
          <!-- 在线状态：显示执行 -->
          <template v-else>
            <AuthButton
              action-id="mysql_partition"
              :loading="executeLoadingMap[row.id]"
              :permission="row.permission.mysql_partition"
              :resource="row.cluster_id"
              text
              theme="primary"
              @click="handleExecute(row)">
              {{ t('执行') }}
            </AuthButton>
          </template>
          <!-- 编辑按钮 -->
          <span
            v-bk-tooltips="{
              content: t('正在执行中，无法编辑'),
              disabled: !row.isRunning,
            }"
            class="ml-8">
            <AuthButton
              action-id="mysql_partition_update"
              :disabled="row.isRunning"
              :permission="row.permission.mysql_partition_update"
              :resource="row.cluster_id"
              text
              theme="primary"
              @click="handleEdit(row)">
              {{ t('编辑') }}
            </AuthButton>
          </span>
          <!-- 克隆按钮 -->
          <AuthButton
            action-id="mysql_partition_create"
            class="ml-8 mr-8"
            :permission="row.permission.mysql_partition_create"
            text
            theme="primary"
            @click="handleClone(row)">
            {{ t('克隆') }}
          </AuthButton>
          <!-- 更多操作 -->
          <MoreActionExtend>
            <template #default>
              <div v-if="row.isOnline">
                <AuthButton
                  action-id="mysql_partition_enable_disable"
                  :permission="row.permission.mysql_partition_enable_disable"
                  :resource="row.cluster_id"
                  text
                  @click="handleDisable(row)">
                  {{ t('禁用') }}
                </AuthButton>
              </div>
              <div>
                <DbPopconfirm
                  :confirm-handler="() => handleRemove(row)"
                  :content="t('删除操作无法撤回，请谨慎操作！')"
                  :title="t('确认删除该分区策略？')">
                  <div style="height: 100%">
                    <AuthButton
                      action-id="mysql_partition_delete"
                      :permission="row.permission.mysql_partition_delete"
                      :resource="row.cluster_id"
                      text>
                      {{ t('删除') }}
                    </AuthButton>
                  </div>
                </DbPopconfirm>
              </div>
            </template>
          </MoreActionExtend>
        </template>
      </TableColumn>
    </DbTable>
    <PartitionOperation
      v-model:is-show="isShowOperation"
      :data="operationData"
      @create-success="handleOperationCreateSuccess"
      @edit-success="handleOperationEditSuccess" />
    <DbSideslider
      v-model:is-show="isShowExecuteLog"
      :show-footer="false"
      :title="t(`查看执行记录`)"
      :width="1000">
      <ExecuteLog
        v-if="operationData"
        :data="operationData" />
    </DbSideslider>
    <DbSideslider
      v-model:is-show="isShowFailLog"
      quick-close
      render-directive="if"
      :show-footer="false"
      :title="t(`查看失败日志`)"
      :width="1000">
      <template #header>
        <span>{{ t('查看失败日志') }}</span>
        <div class="sub-title">{{ operationData?.id }} | {{ operationData?.execute_time }}</div>
      </template>
      <FailLog
        v-if="operationData"
        :data="operationData" />
    </DbSideslider>
    <!-- excel 导入 -->
    <ExcelImport
      v-model:is-show="isShowExcelImport"
      @success="handleExcelImportSuccess" />
  </div>
</template>
<script setup lang="tsx">
  import { InfoBox, Table as BkTable } from 'bkui-vue';
  import _ from 'lodash';
  import { ref, shallowRef } from 'vue';
  import { useI18n } from 'vue-i18n';

  const BkTableColumn = BkTable.Column;

  import PartitionModel from '@services/model/partition/partition';
  import {
    batchRemove,
    disablePartition,
    enablePartition,
    executeV2,
    exportPartitions,
    getList,
    queryConfByStatus,
  } from '@services/source/partitionManage';

  import { useTicketMessage } from '@hooks';

  import { ClusterTypes } from '@common/const';

  import { type Props as QuickSearchProps } from '@components/db-quick-search/bk-quick-search/Index.vue';
  import DbTable from '@components/db-table/IndexNew.vue';
  import MoreActionExtend from '@components/more-action-extend/Index.vue';

  import { messageSuccess } from '@utils';

  import ExcelImport from './components/ExcelImport.vue';
  import ExecuteLog from './components/ExecuteLog.vue';
  import FailLog from './components/fail-log/Index.vue';
  import PartitionOperation from './components/Operation.vue';
  import useTableSetting from './hooks/useTableSetting';

  const { t } = useI18n();
  const ticketMessage = useTicketMessage();
  const { handleChange: handleSettingChange, setting: tableSetting } = useTableSetting();

  const tableRef = ref();
  const searchValue = ref<Record<string, string>>({});
  const isShowOperation = ref(false);
  const isShowExecuteLog = ref(false);
  const isShowExcelImport = ref(false);
  const isShowFailLog = ref(false);
  const executeLoadingMap = ref<Record<number, boolean>>({});

  const operationData = shallowRef<PartitionModel>();
  const selectionList = shallowRef<number[]>([]);

  const disabled = computed(() => selectionList.value.length === 0);

  const serachData = [
    {
      id: 'ids',
      name: t('策略 ID'),
      type: 'multiple-input',
      validator: (value: string) => {
        return !isNaN(Number(value)) ? true : t('ID 只支持数字');
      },
    },
    {
      description: t('单个值支持模糊搜索'),
      id: 'immute_domains',
      name: t('域名'),
      type: 'multiple-input',
    },
    {
      description: t('单个值支持模糊搜索'),
      id: 'dblikes',
      name: t('DB 名'),
      type: 'multiple-input',
    },
    {
      description: t('单个值支持模糊搜索'),
      id: 'tblikes',
      name: t('表名'),
      type: 'multiple-input',
    },
    {
      id: 'status',
      list: [
        {
          label: t('执行失败'),
          value: PartitionModel.STATUS_FAILED,
        },
        {
          label: t('执行成功'),
          value: PartitionModel.STATUS_FINISHED,
        },
        {
          label: t('等待执行'),
          value: PartitionModel.STATUS_PENDING,
        },
        {
          label: t('执行中'),
          value: PartitionModel.STATUS_READY,
        },
        {
          label: t('执行中'),
          value: PartitionModel.STATUS_RUNNING,
        },
        {
          label: t('执行成功'),
          value: PartitionModel.STATUS_SUCCEEDED,
        },
      ],
      name: t('最近执行状态'),
      type: 'multiple',
    },
  ] as QuickSearchProps['data'];

  watch(searchValue, () => {
    tableRef.value!.clearSelected();
  });

  const getRowClass = (data: PartitionModel) => {
    const classList: string[] = [];
    if (data.isOffline) {
      classList.push('is-offline');
    }
    if (data.isNew) {
      classList.push('is-new-row');
    }
    return classList.join(' ');
  };

  const dataSource = () => {
    if (searchValue.value.status) {
      return queryConfByStatus({
        bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
        cluster_type: ClusterTypes.TENDBHA,
        status: searchValue.value.status,
      });
    }
    return getList(
      Object.assign(searchValue.value, {
        bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
        cluster_type: ClusterTypes.TENDBHA,
      }),
    );
  };

  const fetchData = () => {
    tableRef.value?.fetchData(searchValue.value, {
      cluster_type: ClusterTypes.TENDBHA,
    });
  };

  // 新建
  const handleCreate = () => {
    operationData.value = undefined;
    isShowOperation.value = true;
  };

  // 批量启用
  const handleBatchEnable = () => {
    operationData.value = undefined;
    InfoBox({
      cancelText: t('取消'),
      confirmButtonTheme: 'primary',
      confirmText: t('启用'),
      content: () => {
        const tableData = selectionList.value.map((id) => ({ id }));
        return (
          <>
            <BkTable
              border='outer'
              data={tableData}>
              <BkTableColumn
                align='left'
                field='id'
                label={t('已选择以下 n 个策略', { n: selectionList.value.length })}
                minWidth={100}
              />
            </BkTable>
          </>
        );
      },
      footerAlign: 'center',
      headerAlign: 'center',
      onConfirm: async () => {
        const result = await enablePartition({
          cluster_type: ClusterTypes.TENDBHA,
          ids: selectionList.value,
        });
        if (result) {
          fetchData();
          messageSuccess(t('启用成功'));
          return true;
        }
        return false;
      },
      title: t('确定启用 n 个策略？', { n: selectionList.value.length }),
    });
  };

  // 批量禁用
  const handleBatchDisable = () => {
    operationData.value = undefined;
    InfoBox({
      cancelText: t('取消'),
      confirmButtonTheme: 'danger',
      confirmText: t('禁用'),
      content: () => {
        const tableData = selectionList.value.map((id) => ({ id }));
        return (
          <>
            <div style='margin-bottom:16px;padding: 12px 16px;display: flex;background: #F5F7FA;'>
              {t('停用后，策略将立即失效，请谨慎操作！')}
            </div>
            <BkTable
              border='outer'
              data={tableData}>
              <BkTableColumn
                align='left'
                field='id'
                label={t('已选择以下 n 个策略', { n: selectionList.value.length })}
                minWidth={100}
              />
            </BkTable>
          </>
        );
      },
      footerAlign: 'center',
      headerAlign: 'center',
      onConfirm: async () => {
        const result = await disablePartition({
          cluster_type: ClusterTypes.TENDBHA,
          ids: selectionList.value,
        });
        if (result) {
          fetchData();
          messageSuccess(t('禁用成功'));
          return true;
        }
        return false;
      },
      title: t('确定禁用 n 个策略？', { n: selectionList.value.length }),
    });
  };

  // 批量删除
  const handleBatchRemove = () => {
    operationData.value = undefined;
    InfoBox({
      cancelText: t('取消'),
      confirmButtonTheme: 'danger',
      confirmText: t('删除'),
      content: () => {
        const tableData = selectionList.value.map((id) => ({ id }));
        return (
          <>
            <div style='margin-bottom:16px;padding: 12px 16px;display: flex;background: #F5F7FA;'>
              {t('删除策略后无法恢复，请谨慎操作！')}
            </div>
            <BkTable
              border='outer'
              data={tableData}>
              <BkTableColumn
                align='left'
                field='id'
                label={t('已选择以下 n 个策略', { n: selectionList.value.length })}
                minWidth={100}
              />
            </BkTable>
          </>
        );
      },
      footerAlign: 'center',
      headerAlign: 'center',
      onConfirm: async () => {
        const result = await batchRemove({
          cluster_type: ClusterTypes.TENDBHA,
          ids: selectionList.value,
        });
        if (result) {
          fetchData();
          Object.values(selectionList.value).forEach((hostId) => {
            tableRef.value.removeSelectByKey(hostId);
          });
          selectionList.value = [];
          messageSuccess(t('删除成功'));
          return true;
        }
        return false;
      },
      title: t('确定删除 n 个策略？', { n: selectionList.value.length }),
    });
  };

  const handleBatchExecute = () => {
    operationData.value = undefined;
    InfoBox({
      cancelText: t('取消'),
      confirmButtonTheme: 'primary',
      confirmText: t('执行'),
      content: () => {
        const tableData = selectionList.value.map((id) => ({ id }));
        return (
          <>
            <BkTable
              border='outer'
              data={tableData}>
              <BkTableColumn
                align='left'
                field='id'
                label={t('已选择以下 n 个策略', { n: selectionList.value.length })}
                minWidth={100}
              />
            </BkTable>
          </>
        );
      },
      footerAlign: 'center',
      headerAlign: 'center',
      onConfirm: async () => {
        const tableData = tableRef.value?.getData() || [];
        const selectionRows = tableData.filter((data: PartitionModel) => selectionList.value.includes(data.id));
        const result = await executeV2({
          bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
          partition_infos: selectionRows.map((data: PartitionModel) => ({
            cluster_id: data.cluster_id,
            configs: [
              {
                config_id: data.id,
                dblike: data.dblike,
                expire_time: data.expire_time,
                extra_partition: data.extra_partition,
                partition_column: data.partition_column,
                partition_column_type: data.partition_column_type,
                partition_time_interval: data.partition_time_interval,
                partition_type: data.partition_type,
                phase: data.phase,
                tblike: data.tblike,
                time_zone: data.time_zone,
              },
            ],
            force: false,
          })),
        });
        if (result) {
          fetchData();
          messageSuccess(t('执行成功'));
          return true;
        }
        return false;
      },
      title: t('确定执行 n 个策略？', { n: selectionList.value.length }),
    });
  };

  const handleBatchExport = () => {
    operationData.value = undefined;
    InfoBox({
      cancelText: t('取消'),
      confirmButtonTheme: 'primary',
      confirmText: t('导出'),
      content: () => {
        const tableData = selectionList.value.map((id) => ({ id }));
        return (
          <>
            <BkTable
              border='outer'
              data={tableData}>
              <BkTableColumn
                align='left'
                field='id'
                label={t('已选择以下 n 个策略', { n: selectionList.value.length })}
                minWidth={100}
              />
            </BkTable>
          </>
        );
      },
      footerAlign: 'center',
      headerAlign: 'center',
      onConfirm: async () => {
        await exportPartitions({
          bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
          cluster_type: ClusterTypes.TENDBHA,
          export_type: selectionList.value.length > 0 ? 'selected' : 'all',
          selected_ids: selectionList.value,
        });
        return true;
      },
      title: t('确定导出 n 个策略？', { n: selectionList.value.length }),
    });
  };

  // 搜索
  const handleSearch = () => {
    fetchData();
  };

  const handleTableSelection = (payload: string[]) => {
    selectionList.value = payload.map((item) => Number(item));
  };

  // 清空搜索
  const handleClearSearch = () => {
    searchValue.value = {};
    fetchData();
  };

  // 执行
  const handleExecute = async (data: PartitionModel) => {
    executeLoadingMap.value[data.id] = true;
    operationData.value = data;
    try {
      const executeResult = await executeV2({
        bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
        partition_infos: [
          {
            cluster_id: data.cluster_id,
            configs: [
              {
                config_id: data.id,
                dblike: data.dblike,
                expire_time: data.expire_time,
                extra_partition: data.extra_partition,
                partition_column: data.partition_column,
                partition_column_type: data.partition_column_type,
                partition_time_interval: data.partition_time_interval,
                partition_type: data.partition_type,
                phase: data.phase,
                tblike: data.tblike,
                time_zone: data.time_zone,
              },
            ],
            force: false,
          },
        ],
      });
      ticketMessage(executeResult[0].id);
    } finally {
      executeLoadingMap.value[data.id] = false;
    }
  };

  // 编辑
  const handleEdit = (payload: PartitionModel) => {
    isShowOperation.value = true;
    operationData.value = payload;
  };

  // 导入策略
  const handleShowExcelImport = () => {
    isShowExcelImport.value = true;
  };

  // Excel 导入成功
  const handleExcelImportSuccess = () => {
    fetchData();
  };

  // 编辑成功
  const handleOperationEditSuccess = () => {
    fetchData();
  };
  // 新建成功
  const handleOperationCreateSuccess = () => {
    operationData.value = undefined;
    fetchData();
  };

  const handleDisable = (payload: PartitionModel) => {
    disablePartition({
      cluster_type: ClusterTypes.TENDBHA,
      ids: [payload.id],
    }).then(() => {
      fetchData();
      messageSuccess(t('禁用成功'));
    });
  };

  const handleEnable = (payload: PartitionModel) => {
    enablePartition({
      cluster_type: ClusterTypes.TENDBHA,
      ids: [payload.id],
    }).then(() => {
      fetchData();
      messageSuccess(t('启用成功'));
    });
  };

  const handleClone = (payload: PartitionModel) => {
    const rowDataClone = _.cloneDeep(payload);
    rowDataClone.id = 0;
    operationData.value = rowDataClone;
    isShowOperation.value = true;
  };

  const handleRemove = (payload: PartitionModel) =>
    batchRemove({
      cluster_type: ClusterTypes.TENDBHA,
      ids: [payload.id],
    }).then(() => {
      fetchData();
      messageSuccess(t('移除成功'));
    });

  const handleShowFailLog = (payload: PartitionModel) => {
    operationData.value = payload;
    isShowFailLog.value = true;
  };

  onMounted(() => {
    fetchData();
  });
</script>
<style lang="less">
  .spider-manage-paritition-page {
    .header-action {
      display: flex;
    }

    .batch-operation {
      .batch-operation-icon {
        transform: rotate(0);
        transition: all 0.2s;
      }

      .batch-operation-icon-active {
        transform: rotate(180deg);
      }
    }

    .more-action {
      display: flex;
      width: 32px;
      height: 32px;
      font-size: 14px;
      cursor: pointer;
      border-radius: 50%;
      align-items: center;
      justify-content: center;

      &:hover {
        background: #dcdee5;
      }
    }

    .partition-table {
      .id-container {
        display: flex;
        align-items: center;
      }
    }

    .sub-title {
      position: relative;
      display: flex;
      height: 22px;
      padding-left: 9px;
      margin-left: 16px;
      font-family: MicrosoftYaHei, sans-serif;
      font-size: 14px;
      line-height: 22px;
      letter-spacing: 0;
      color: #979ba5;

      &::before {
        position: absolute;
        top: 4px;
        left: 0;
        width: 1px;
        height: 14px;
        background-color: #979ba580;
        content: '';
      }

      .sub-title-label {
        margin-right: 8px;
      }

      .sub-title-value {
        margin-right: 20px;
      }
    }
  }
</style>
