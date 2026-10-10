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
 * the specific language governing permissions and limitations under the License.
-->
<template>
  <div class="version-os-editor">
    <!-- 版本行：系列 / 发行版 / 版本号（接入层 Proxy 隐式 DBM，不展示发行版下拉） -->
    <div class="editor-row">
      <span class="row-label">{{ t('版本') }}</span>
      <div class="row-content version-row">
        <DbSelect
          v-model="localSelected.seriesId"
          class="version-select"
          :clearable="false"
          :disabled="disabled || !localSelected.distributionId"
          :loading="seriesLoading"
          :placeholder="t('请选择')"
          :prefix="t('系列')"
          @change="handleSeriesChange">
          <DbOption
            v-for="item in seriesList"
            :key="item.id"
            :label="item.name"
            :value="item.id" />
        </DbSelect>
        <DbSelect
          v-if="showDistribution"
          v-model="localSelected.distributionId"
          class="version-select"
          :clearable="false"
          :disabled="disabled"
          filterable
          :loading="distributionLoading"
          :placeholder="t('请选择发行版')"
          :prefix="t('发行版')"
          @change="handleDistributionChange">
          <DbOption
            v-for="item in distributionList"
            :key="item.id"
            :label="item.name"
            :value="item.id" />
        </DbSelect>
        <DbSelect
          v-model="localSelected.versionId"
          class="version-select"
          :clearable="false"
          :disabled="disabled || !localSelected.seriesId"
          :loading="versionLoading"
          :placeholder="t('请选择')"
          :prefix="t('版本号')"
          @change="handleVersionChange">
          <DbOption
            v-for="item in versionList"
            :key="item.id"
            :label="item.name"
            :value="item.id">
            <span>{{ item.name }}</span>
            <DbTag
              v-if="item.recommend"
              class="ml-5"
              theme="success">
              {{ t('推荐') }}
            </DbTag>
          </DbOption>
        </DbSelect>
      </div>
    </div>
    <!-- 操作系统行：模式切换 + 取值（值区独立成行） -->
    <div class="editor-row">
      <span class="row-label">{{ t('操作系统版本') }}</span>
      <div class="row-content os-content">
        <BkRadioGroup
          v-if="versionSelected"
          v-model="localSelected.osMode">
          <BkRadio label="follow">
            {{ t('跟随版本包') }}<span class="radio-desc">（{{ t('随版本包自动更新') }}）</span>
          </BkRadio>
          <BkRadio label="specify">
            {{ t('指定范围') }}<span class="radio-desc">（{{ t('从版本包中勾选') }}）</span>
          </BkRadio>
        </BkRadioGroup>
        <span
          v-else
          class="os-placeholder">{{ t('请先选择版本号') }}</span>
        <!-- 跟随模式：灰色标签逐个展示当前版本支持的 OS -->
        <div
          v-if="versionSelected && localSelected.osMode === 'follow'"
          class="os-value-box">
          <DbTag
            v-for="os in followOsList"
            :key="os"
            class="os-tag">
            {{ os }}
          </DbTag>
        </div>
        <!-- 指定模式：多选框勾选，已选项以可移除标签展示 -->
        <DbSelect
          v-else-if="versionSelected && localSelected.osMode === 'specify'"
          v-model="localSelected.specifyOs"
          class="os-select"
          :disabled="osOptions.length === 0"
          multiple
          :placeholder="osOptions.length === 0 ? t('该版本暂无可用介质包') : t('请选择操作系统版本')"
          @change="handleOsChange">
          <DbOption
            v-for="item in osOptions"
            :key="item"
            :label="item"
            :value="item" />
        </DbSelect>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRequest } from 'vue-request';

  import { getDbVersionList,getDbVersionPermitOs,getReleaseVersionList, getVersionSeriesList  } from '@services/source/version';

  import { DBTypes } from '@common/const';

  import { t } from '@locales/index';

  /**
   * 单层（组件）的版本约束选择器：发行版 → 系列 → 版本号 + OS 跟随/指定
   * create / clone / 详情 OS 编辑弹窗共用
   */
  export interface VersionOsValue {
    distributionId: number | '';
    osMode: 'follow' | 'specify';
    seriesId: number | '';
    specifyOs: string[];
    versionId: number | '';
  }

  interface Props {
    /** 数据库类型：决定发行版接口的 db_type 参数 */
    dbType: DBTypes;
    /** 新建场景默认选中的发行版名称（如存储层 TXSQL）；不传则不自动选中 */
    defaultDistributionName?: string;
    /** 发行版/系列/版本号是否只读（详情编辑 OS 场景为 true） */
    disabled?: boolean;
    /** 发行版下拉加载的包类型：mysql / mysql-proxy / spider */
    pkgType: string;
    /** 是否展示发行版下拉（接入层 Proxy 隐式 DBM，传 false 隐藏） */
    showDistribution?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    defaultDistributionName: '',
    disabled: false,
    showDistribution: true,
  });

  const emit = defineEmits<{
    /**
     * 系列切换前拦截（§4 重载确认）：参数 Tab 有已改项时页面弹 InfoBox 二次确认，
     * 确认后执行 next() 完成切换，取消则回滚版本下拉
     */
    (e: 'before-series-change', next: () => void): void;
    (e: 'change', value: VersionOsValue): void;
  }>();

  const modelValue = defineModel<VersionOsValue>({
    default: () => ({
      distributionId: '',
      osMode: 'follow',
      seriesId: '',
      specifyOs: [],
      versionId: '',
    }),
  });

  const localSelected = reactive<VersionOsValue>({
    distributionId: modelValue.value.distributionId,
    osMode: modelValue.value.osMode,
    seriesId: modelValue.value.seriesId,
    specifyOs: [...modelValue.value.specifyOs],
    versionId: modelValue.value.versionId,
  });

  /** 版本是否选齐（决定 OS 区可用性与创建按钮） */
  const versionSelected = computed(() => localSelected.versionId !== '');

  /** 同步值到父组件 */
  const syncValue = () => {
    modelValue.value = {
      distributionId: localSelected.distributionId,
      osMode: localSelected.osMode,
      seriesId: localSelected.seriesId,
      specifyOs: [...localSelected.specifyOs],
      versionId: localSelected.versionId,
    };
    emit('change', modelValue.value);
  };

  // ============ 发行版 ============
  const distributionList = ref<ServiceReturnType<typeof getReleaseVersionList>>([]);
  const {
    loading: distributionLoading,
    run: fetchDistributionList,
  } = useRequest(getReleaseVersionList, {
    manual: true,
    onSuccess(data) {
      distributionList.value = data;
      // 无选中时按默认发行版名称选中（新建存储层默认 TXSQL；未匹配到则不自动选中）
      // 接入层（showDistribution=false）同样走默认发行版（DBM）隐式选中
      if (!localSelected.distributionId && props.defaultDistributionName) {
        const matched = data.find((item) => item.name === props.defaultDistributionName);
        if (matched) {
          localSelected.distributionId = matched.id;
          loadSeries(matched.id);
        }
      }
    },
  });

  // ============ 系列 ============
  const seriesList = ref<ServiceReturnType<typeof getVersionSeriesList>>([]);
  const {
    loading: seriesLoading,
    run: fetchSeriesList,
  } = useRequest(getVersionSeriesList, {
    manual: true,
    onSuccess(data) {
      seriesList.value = data;
      // §2.2 默认值：推荐版本按发行版全局唯一（跨系列仅 1 个）→ 定位唯一推荐所在系列
      // 逐个系列加载版本太重，改为按需：优先在已加载版本里找推荐；未命中则遍历系列查推荐
      if (!localSelected.seriesId && !localSelected.versionId) {
        applyRecommendSeries();
      }
    },
  });

  /**
   * 定位推荐所在系列：串行遍历该发行版的系列，找到含 recommend 版本的系列后选中系列与版本号
   * 仅新建默认场景调用；用户手动选过后（seriesId 已有值）不触发
   */
  let recommendSeriesSearching = false;
  const applyRecommendSeries = async () => {
    if (recommendSeriesSearching) return;
    recommendSeriesSearching = true;
    try {
      for (const series of seriesList.value) {
        const versions = await getDbVersionList({ version_series__in: String(series.id) });
        const enabledVersions = versions.filter((item) => item.enable);
        const recommendItem = enabledVersions.find((item) => item.recommend);
        if (recommendItem) {
          localSelected.seriesId = series.id;
          versionList.value = enabledVersions;
          localSelected.versionId = recommendItem.id;
          fetchPermitOs({ db_version_id: recommendItem.id });
          syncValue();
          return;
        }
      }
    } finally {
      recommendSeriesSearching = false;
    }
  };

  // ============ 版本号 ============
  const versionList = ref<ServiceReturnType<typeof getDbVersionList>>([]);
  const {
    loading: versionLoading,
    run: fetchVersionList,
  } = useRequest(getDbVersionList, {
    manual: true,
    onSuccess(data) {
      versionList.value = data.filter((item) => item.enable);
      // 用户手动选系列后的推荐默认：该系列含推荐版本则自动选中
      applyRecommendDefault();
    },
  });

  // ============ OS 候选 ============
  const osGroups = ref<ServiceReturnType<typeof getDbVersionPermitOs>>([]);
  const { run: fetchPermitOs } = useRequest(getDbVersionPermitOs, {
    manual: true,
    onSuccess(data) {
      osGroups.value = data;
      // 换版本后：指定范围的已选只保留新版本仍关联的 OS（§2.3 换该层版本）
      if (localSelected.osMode === 'specify') {
        const available = new Set(data.flatMap((g) => g.permit_os));
        localSelected.specifyOs = localSelected.specifyOs.filter((os) => available.has(os));
      }
    },
  });

  /** OS 类型候选（当前版本的类型分组） */
  const osTypeList = computed(() => osGroups.value.map((g) => g.permit_os_type));

  /** 当前 OS 类型下的候选列表（首个分组；前端选择器按类型分组展示由弹窗处理，这里取并集） */
  const osOptions = computed(() => {
    if (!localSelected.versionId) return [];
    return Array.from(new Set(osGroups.value.flatMap((g) => g.permit_os)));
  });

  /** 跟随模式展示：当前关联全集（灰色标签逐个展示） */
  const followOsList = computed(() => {
    if (osOptions.value.length === 0) return [t('该版本暂无可用介质包')];
    return osOptions.value;
  });

  /** 按系列拉版本号列表 */
  const loadVersions = (seriesId: number) => {
    fetchVersionList({ version_series__in: String(seriesId) });
  };

  /** 按发行版拉系列列表 */
  const loadSeries = (distributionId: number) => {
    fetchSeriesList({ distribution: distributionId });
  };

  /** 版本号选中后：默认推荐逻辑（§2.2 该发行版唯一推荐所在系列 → 版本号） */
  const applyRecommendDefault = () => {
    // 发行版列表拉取后由外部 defaultDistributionName 驱动；此处处理推荐版本：
    // 版本列表中 recommend 的项自动选中（仅新建场景、用户未手动选过）
    const recommendItem = versionList.value.find((item) => item.recommend);
    if (recommendItem && !localSelected.versionId) {
      localSelected.versionId = recommendItem.id;
      fetchPermitOs({ db_version_id: recommendItem.id });
      syncValue();
    }
  };

  // ============ 联动逻辑 ============
  /** 切换发行版：清空系列/版本号/OS 取值，重拉系列（§2.2 换发行版跳到该发行版唯一推荐） */
  const handleDistributionChange = (val: number) => {
    localSelected.seriesId = '';
    localSelected.versionId = '';
    localSelected.specifyOs = [];
    osGroups.value = [];
    loadSeries(val);
    syncValue();
  };

  /** 切换系列：清空版本号/OS 取值，重拉版本号；先经 before-series-change 拦截（§4 重载确认） */
  const handleSeriesChange = (val: number) => {
    const proceed = () => {
      localSelected.versionId = '';
      localSelected.specifyOs = [];
      osGroups.value = [];
      loadVersions(val);
      syncValue();
    };
    // 页面有参数 Tab 已改项时弹 InfoBox；无监听者直接放行
    emit('before-series-change', proceed);
  };
  /** 切换版本号：拉取 OS 候选 */
  const handleVersionChange = (val: number) => {
    localSelected.specifyOs = [];
    fetchPermitOs({ db_version_id: val });
    syncValue();
  };

  /** 切换 OS 模式 */
  watch(
    () => localSelected.osMode,
    (mode) => {
      if (mode === 'specify') {
        // 切到指定范围：已选留空（§2.3 用户切换模式）
        localSelected.specifyOs = [];
      }
      syncValue();
    },
  );

  const handleOsChange = () => {
    syncValue();
  };

  /** 初始化：拉发行版列表 */
  watch(
    () => props.pkgType,
    () => {
      fetchDistributionList({
        db_type: props.dbType,
        pkg_type: props.pkgType,
      });
    },
    { immediate: true },
  );

  /** 外部回填初始值（克隆场景带出源模块的三级选型） */
  watch(
    () => modelValue.value,
    (val) => {
      if (val.distributionId && val.distributionId !== localSelected.distributionId) {
        localSelected.distributionId = val.distributionId;
        loadSeries(val.distributionId);
      }
      if (val.seriesId && val.seriesId !== localSelected.seriesId) {
        localSelected.seriesId = val.seriesId;
        loadVersions(val.seriesId);
      }
      if (val.versionId && val.versionId !== localSelected.versionId) {
        localSelected.versionId = val.versionId;
        fetchPermitOs({ db_version_id: val.versionId });
      }
    },
    { deep: true, immediate: true },
  );

  defineExpose({
    /** 当前选中系列名（模块名查重组合：模块名-存储层系列-字符集） */
    getSeriesName: () =>
      seriesList.value.find((item) => item.id === localSelected.seriesId)?.name ?? '',
    /** 当前选中版本号名称（参数 Tab 版本标识） */
    getVersionName: () =>
      versionList.value.find((item) => item.id === localSelected.versionId)?.name ?? '',
    /** 导出协议写入结构：{db_version_id, permit_os_type, permit_os} */
    getWriteValue: (): {
      db_version_id: number;
      permit_os: string[];
      permit_os_type: string;
    } => {
      // OS 类型：跟随/指定都取当前版本候选的首个类型（前端单类型场景），无候选时给空
      const osType = osGroups.value[0]?.permit_os_type ?? '';
      return {
        db_version_id: Number(localSelected.versionId),
        permit_os: localSelected.osMode === 'follow' ? [] : [...localSelected.specifyOs],
        permit_os_type: osType,
      };
    },
    /** 当前 OS 类型候选 */
    osTypeList,
    /** 校验当前层选型完整性（版本必选；指定范围至少 1 项） */
    validate: () => {
      if (!versionSelected.value) {
        return { message: t('请选择版本号'), ok: false };
      }
      if (localSelected.osMode === 'specify' && localSelected.specifyOs.length === 0) {
        return { message: t('指定范围至少选择 1 个操作系统版本'), ok: false };
      }
      return { message: '', ok: true };
    },
  });
</script>

<style lang="less" scoped>
  .version-os-editor {
    .editor-row {
      display: flex;
      align-items: flex-start;

      & + .editor-row {
        margin-top: 16px;
      }
    }

    .row-label {
      flex-shrink: 0;
      width: 76px;
      padding-right: 12px;
      font-size: 12px;
      line-height: 32px;
      color: #313238;
      text-align: right;
      white-space: nowrap;

      &::after {
        margin-left: 2px;
        color: #ea3636;
        content: '*';
      }
    }

    .row-content {
      flex: 1;
      max-width: 520px;
      min-width: 0;
    }

    .version-row {
      display: flex;
      gap: 8px;

      .version-select {
        flex: 1;
        min-width: 0;
      }
    }

    .os-content {
      display: flex;
      flex-direction: column;
      gap: 8px;

      :deep(.bk-radio-group) {
        display: flex;
        align-items: center;
        min-height: 32px;
      }

      .radio-desc {
        font-size: 12px;
        line-height: 20px;
        color: #979ba5;
      }

      // 跟随模式取值区：白底边框盒内展示灰色标签
      .os-value-box {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        min-height: 32px;
        padding: 3px 8px;
        background: #fff;
        border: 1px solid #dcdee5;
        border-radius: 2px;
      }

      .os-tag {
        color: #63656e;
        background: #f0f1f5;
      }

      .os-select {
        width: 100%;
      }

      .os-placeholder {
        font-size: 12px;
        line-height: 32px;
        color: #c4c6cc;
      }
    }
  }
</style>
