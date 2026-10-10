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
  <BkLoading
    :loading="treeState.loading"
    style="height: 100%"
    :z-index="12">
    <div class="config-tree">
      <div class="config-tree-search">
        <DbQuickSearch
          v-model="treeSearchValue"
          :data="searchSelectData"
          @change="handleSearchChange" />
      </div>
      <BkTree
        ref="treeRef"
        :data="displayTreeData"
        :indent="16"
        label="name"
        :node-content-action="['click']"
        node-key="treeId"
        :offset-left="24"
        :prefix-icon="treePrefixIcon"
        :search="treeSearchConfig"
        :selected="treeState.selected"
        virtual-render
        @node-click="handleSelectedTreeNode">
        <template #node="item">
          <div
            class="config-tree-node"
            :class="{ 'is-module-node': item.levelType === ConfLevels.MODULE }">
            <div class="node-main-row">
              <span class="config-tree-tag">
                {{ getIconText(item) }}
              </span>
              <span
                v-overflow-tips="{ content: item.name, placement: 'right' }"
                class="config-tree-name text-overflow">
                {{ item.name }}
              </span>
              <!-- 模块节点右端：关联集群数（灰底小方块，≥1000 显示 999+，纯展示） -->
              <span
                v-if="item.levelType === ConfLevels.MODULE"
                class="cluster-count-tag">
                {{ formatClusterCount(item.clusters?.length ?? 0) }}
              </span>
              <AuthButton
                v-if="item.levelType === ConfLevels.APP && isShowAddBtn"
                v-bk-tooltips="t('新建DB模块')"
                action-id="dbconfig_edit"
                class="config-tree-add-btn"
                :resource="dbType"
                size="small"
                theme="primary"
                @click.stop="createModule">
                <DbIcon type="add" />
              </AuthButton>
            </div>
            <!-- 模块节点第二行：`${存储层系列}，${字符集}` -->
            <div
              v-if="item.levelType === ConfLevels.MODULE && item.subDescription"
              v-overflow-tips="{ content: item.subDescription, placement: 'right' }"
              class="node-sub-row text-overflow">
              {{ item.subDescription }}
            </div>
          </div>
        </template>
        <template #empty>
          <EmptyStatus
            :is-anomalies="treeState.isAnomalies"
            :is-searching="isSearching"
            @clear-search="handleClearSearch"
            @refresh="handleRefresh" />
        </template>
      </BkTree>
    </div>
  </BkLoading>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n';
  import { useRoute } from 'vue-router';

  import { clusterTypeInfos, ClusterTypes, ConfLevels, DBTypes } from '@common/const';

  import AuthButton from '@components/auth-component/button.vue';
  import DbQuickSearch from '@components/db-quick-search/Index.vue';
  import EmptyStatus from '@components/empty-status/EmptyStatus.vue';

  import type { TreeData, TreeState } from '@views/db-configure/common/types';
  import { useTreeData } from '@views/db-configure/hooks/useTreeData';

  const route = useRoute();
  const { t } = useI18n();

  const treeState = reactive<TreeState>({
    data: [],
    isAnomalies: false,
    loading: false,
    search: '',
  });

  const {
    charsetOptions,
    createModule,
    fetchBusinessTopoTree,
    filterTreeBySearch,
    handleSelectedTreeNode,
    treePrefixIcon,
    treeRef,
    treeSearchConfig,
    treeSearchValue,
  } = useTreeData(treeState);

  /** SearchSelect 分字段搜索条件（§3.1）：默认模块名；可选模块名/模块 ID/字符集；多条件同时生效 */
  const searchSelectData = computed(() => [
    {
      id: 'moduleName',
      name: t('模块名'),
      type: 'multiple-input',
    },
    {
      id: 'moduleId',
      name: t('模块 ID'),
      type: 'multiple-input',
    },
    {
      id: 'charset',
      list: charsetOptions.value.map((item) => ({
        label: item,
        value: item,
      })),
      name: t('字符集'),
      type: 'multiple',
    },
  ]);

  /** 应用分字段过滤后的树数据 */
  const displayTreeData = computed(() => filterTreeBySearch(treeState.data));

  /** 是否处于搜索态（含原关键字搜索与分字段条件） */
  const isSearching = computed(
    () => Boolean(treeState.search) || Object.values(treeSearchValue.value).some((v) => Boolean(v)),
  );

  /** 分字段搜索变化（多条件同时生效） */
  const handleSearchChange = () => {
    // 分字段条件即时过滤 displayTreeData；原关键字搜索兜底保留
  };

  /** 关联集群数：≥1000 显示 999+（口径同详情，纯展示） */
  const formatClusterCount = (count: number) => (count >= 1000 ? '999+' : String(count));

  const handleClearSearch = () => {
    treeState.search = '';
    treeSearchValue.value = {};
  };

  const handleRefresh = () => {
    const { dbType } = clusterTypeInfos[clusterType.value as ClusterTypes];
    if (dbType) {
      fetchBusinessTopoTree(dbType);
    }
  };

  const clusterType = computed(() => (route.params.clusterType as ClusterTypes) || ClusterTypes.TENDBSINGLE);
  const dbType = computed(() => clusterTypeInfos[clusterType.value as ClusterTypes]?.dbType || DBTypes.MYSQL);

  const isShowAddBtn = computed(() => {
    return dbType.value ? [DBTypes.MYSQL, DBTypes.SQLSERVER, DBTypes.TENDBCLUSTER].includes(dbType.value) : false;
  });

  const getIconText = (item: TreeData) => {
    if (item.levelType === ConfLevels.APP) {
      return '业';
    }
    if (item.levelType === ConfLevels.MODULE) {
      return '模';
    }
    return '集';
  };

  defineExpose({
    handleRefresh,
    treeState,
  });
</script>

<style lang="less" scoped>
  .config-tree {
    height: 100%;
    padding: 16px;
    background-color: @bg-white;

    .bk-tree {
      height: calc(100% - 42px) !important;
      font-size: 12px;

      :deep(.bk-node-prefix) {
        color: #979ba5;
      }

      :deep(.bk-node-row) {
        padding-left: 8px;

        &:hover {
          background-color: #e1ecff;
        }
      }
    }

    .config-tree-node {
      display: flex;
      padding: 2px 4px;
      flex-direction: column;

      .node-main-row {
        display: flex;
        align-items: center;
        width: 100%;
      }

      .node-sub-row {
        padding-left: 28px;
        font-size: 12px;
        line-height: 16px;
        color: #979ba5;
      }

      .cluster-count-tag {
        min-width: 20px;
        padding: 0 4px;
        margin-right: 4px;
        font-size: 11px;
        line-height: 16px;
        color: #63656e;
        text-align: center;
        background-color: #f0f1f5;
        border-radius: 2px;
        flex-shrink: 0;
      }
    }

    .config-tree-tag {
      width: 20px;
      height: 20px;
      margin-right: 8px;
      line-height: 20px;
      color: white;
      text-align: center;
      background-color: #c4c6cc;
      flex-shrink: 0;
      border-radius: 50%;
    }

    .config-tree-name {
      flex: 1;
      margin-right: 4px;
    }

    .config-tree-add-btn {
      display: none;
      width: 26px;
      height: 26px;
      min-width: 26px;
      padding: 5px;
      border-radius: 2px;
    }

    :deep(.bk-node-row) {
      &.is-selected {
        color: @primary-color;
        background-color: #e1ecff;

        .bk-node-prefix {
          color: #3a84ff;
        }

        .config-tree-add-btn {
          display: flex;
        }

        .config-tree-tag {
          background-color: #3a84ff;
        }

        // 选中行集群数方块随主色（§3.1）
        .cluster-count-tag {
          color: @primary-color;
          background-color: rgb(225 236 255);
        }
      }

      &:hover {
        .config-tree-add-btn {
          display: flex;
        }
      }
    }

    .config-tree-search {
      /* 不要加 display: flex：DbQuickSearch 的可见盒子是绝对定位的，作为 flex 子项没有固有宽度，
         会被压成 0 宽导致整条搜索栏（含边框）不可见，这里保持块级元素让其铺满侧栏宽度 */
      margin-bottom: 16px;
    }
  }
</style>
