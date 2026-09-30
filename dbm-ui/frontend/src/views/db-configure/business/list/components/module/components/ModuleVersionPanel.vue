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
  <div
    v-if="layerList.length > 0"
    class="module-version-panel">
    <div
      v-for="layer in layerList"
      :key="layer.componentName"
      class="version-layer-row">
      <span class="layer-name">{{ layer.label }}</span>
      <span class="layer-version">{{ layer.versionText }}</span>
      <span class="layer-os">
        <span class="os-label">{{ t('操作系统版本') }}：</span>
        <span :class="{ 'os-empty': layer.osText === '--' }">{{ layer.osText }}</span>
        <DbTag
          v-if="layer.info?.follow_package"
          class="ml-4"
          size="small"
          theme="success">
          {{ t('跟随版本包') }}
        </DbTag>
      </span>
      <span class="layer-action">
        <AuthButton
          action-id="dbconfig_edit"
          :resource="dbType"
          size="small"
          text
          theme="primary"
          @click="handleEditOs(layer)">
          {{ t('编辑') }}
        </AuthButton>
      </span>
    </div>

    <!-- OS 编辑弹窗：一次只改一层；模式与取值按 §2.3 -->
    <BkDialog
      :is-show="isShowOsDialog"
      :title="osDialogTitle"
      :width="560"
      @closed="handleDialogClosed">
      <div
        v-if="editingLayer"
        class="os-edit-body">
        <div class="current-version-line">
          {{ t('当前版本') }}：{{ editingLayer.versionText }}
        </div>
        <div class="os-mode-line">
          <DbRadioGroup v-model="dialogForm.osMode">
            <DbRadio value="follow">
              {{ t('跟随版本包') }}
            </DbRadio>
            <DbRadio value="specify">
              {{ t('指定范围') }}
            </DbRadio>
          </DbRadioGroup>
        </div>
        <div
          v-if="dialogForm.osMode === 'follow'"
          class="os-follow-tip">
          {{ followTipText }}
        </div>
        <template v-else>
          <DbSelect
            v-model="dialogForm.specifyOs"
            class="os-specify-select"
            :disabled="osOptions.length === 0"
            multiple
            :placeholder="osOptions.length === 0 ? t('该版本暂无可用介质包') : t('请选择操作系统版本')"
            @change="handleSpecifyChange">
            <DbOption
              v-for="item in osOptions"
              :key="item"
              :label="item"
              :value="item" />
          </DbSelect>
          <p
            v-if="specifyError"
            class="specify-error">
            {{ specifyError }}
          </p>
        </template>
      </div>
      <template #footer>
        <BkButton
          :loading="isSubmitting"
          style="margin-right: 8px"
          theme="primary"
          @click="handleSaveOs">
          {{ t('保存') }}
        </BkButton>
        <BkButton
          :disabled="isSubmitting"
          @click="handleDialogClosed">
          {{ t('取消') }}
        </BkButton>
      </template>
    </BkDialog>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n';
  import { useRequest } from 'vue-request';

  import {
    type ComponentVersionInfo,
    updateModuleVersionOs,
  } from '@services/source/cmdb';
  import { getDbVersionPermitOs } from '@services/source/version';

  import type { ClusterTypes, DBTypes } from '@common/const';

  import AuthButton from '@components/auth-component/button.vue';

  import { messageSuccess } from '@utils';

  /**
   * 模块详情：按层展示版本与 OS，每层 OS 可编辑（创建后仅 OS 可改）
   */
  interface LayerDisplay {
    /** 协议组件名（backend/proxy 等） */
    componentName: string;
    /** 协议展示信息（存量模块可能缺失） */
    info?: ComponentVersionInfo;
    /** 展示名（存储层/接入层） */
    label: string;
    /** OS 展示串（未设置为 --） */
    osText: string;
    /** 版本串 */
    versionText: string;
  }

  interface Props {
    clusterType: ClusterTypes;
    /** 数据库类型（权限资源） */
    dbType: DBTypes;
    /** 各组件版本展示信息：存量模块未设置时为 {} 或部分缺失 */
    dbVersionInfo: Record<string, ComponentVersionInfo>;
    /** 模块 ID */
    moduleId: number;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<(e: 'updated', dbVersionInfo: Record<string, ComponentVersionInfo>) => void>();

  const { t } = useI18n();

  /** 集群类型 → 组件展示配置（label + 协议组件名） */
  const layerConfigMap: Record<string, { componentName: string; label: string }[]> = {
    tendbcluster: [
      { componentName: 'remote', label: '存储层' },
      { componentName: 'spider', label: '接入层' },
    ],
    tendbha: [
      { componentName: 'backend', label: '存储层' },
      { componentName: 'proxy', label: '接入层' },
    ],
    tendbsingle: [{ componentName: 'single', label: '存储层' }],
  };

  /** 按层组装展示数据；存量模块 db_version_info 为 {} 时层仍展示但值为 --（首次编辑时选定模式） */
  const layerList = computed<LayerDisplay[]>(() => {
    const config = layerConfigMap[props.clusterType] || [];
    return config.map((item) => {
      const info = props.dbVersionInfo[item.componentName];
      const versionText = info
        ? [info.distribution, info.version_series, info.version_name].filter(Boolean).join(' / ')
        : '--';
      const osText = info?.effective_permit_os?.length ? info.effective_permit_os.join('，') : '--';
      return {
        componentName: item.componentName,
        info,
        label: t(item.label),
        osText,
        versionText,
      };
    });
  });

  // ============ OS 编辑弹窗 ============
  const isShowOsDialog = ref(false);
  const isSubmitting = ref(false);
  const editingLayer = ref<LayerDisplay>();
  const specifyError = ref('');

  const dialogForm = reactive({
    osMode: 'follow' as 'follow' | 'specify',
    specifyOs: [] as string[],
  });

  const osDialogTitle = computed(() =>
    editingLayer.value ? `${t('编辑操作系统版本')} · ${editingLayer.value.label}` : '',
  );

  /** 当前版本 OS 候选 */
  const osOptions = ref<string[]>([]);
  const { run: fetchPermitOs } = useRequest(getDbVersionPermitOs, {
    manual: true,
    onSuccess(data) {
      osOptions.value = Array.from(new Set(data.flatMap((g) => g.permit_os)));
    },
  });

  const followTipText = computed(() =>
    osOptions.value.length > 0
      ? t('该范围随版本包关联的操作系统自动更新')
      : t('该版本暂无可用介质包'),
  );

  /** 打开弹窗：回填当前模式与取值（-- 时默认跟随，首次编辑时选定模式） */
  const handleEditOs = (layer: LayerDisplay) => {
    editingLayer.value = layer;
    specifyError.value = '';
    dialogForm.osMode = layer.info && !layer.info.follow_package ? 'specify' : 'follow';
    dialogForm.specifyOs = layer.info?.permit_os ? [...layer.info.permit_os] : [];
    if (layer.info?.db_version_id) {
      fetchPermitOs({ db_version_id: layer.info.db_version_id });
    } else {
      osOptions.value = [];
    }
    isShowOsDialog.value = true;
  };

  const handleSpecifyChange = () => {
    specifyError.value = dialogForm.specifyOs.length === 0 ? t('请至少选择 1 个操作系统版本') : '';
  };

  /** 保存：update_module_version_os 只传要改的组件；跟随仅改模式即可；缩小指定范围可保存 */
  const { run: runUpdateOs } = useRequest(updateModuleVersionOs, {
    manual: true,
    onSuccess(res) {
      messageSuccess(t('操作成功'));
      isShowOsDialog.value = false;
      emit('updated', res.db_version_info);
    },
  });

  const handleSaveOs = () => {
    if (!editingLayer.value?.info) return;
    // 指定范围至少 1 项（§3.2）
    if (dialogForm.osMode === 'specify' && dialogForm.specifyOs.length === 0) {
      specifyError.value = t('请至少选择 1 个操作系统版本');
      return;
    }
    isSubmitting.value = true;
    runUpdateOs({
      bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
      db_module_id: props.moduleId,
      db_versions: {
        [editingLayer.value.componentName]: {
          permit_os: dialogForm.osMode === 'follow' ? [] : [...dialogForm.specifyOs],
          permit_os_type: editingLayer.value.info.permit_os_type,
        },
      },
    });
    isSubmitting.value = false;
  };

  const handleDialogClosed = () => {
    isShowOsDialog.value = false;
    editingLayer.value = undefined;
  };
</script>

<style lang="less" scoped>
  .module-version-panel {
    padding: 12px 24px;

    .version-layer-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 4px 0;
      font-size: 12px;
      line-height: 20px;

      .layer-name {
        min-width: 48px;
        color: #63656e;
      }

      .layer-version {
        min-width: 200px;
        color: #313238;
      }

      .layer-os {
        display: inline-flex;
        flex: 1;
        align-items: center;
        color: #313238;

        .os-label {
          color: #63656e;
        }

        .os-empty {
          color: #c4c6cc;
        }
      }

      .layer-action {
        margin-left: auto;
      }
    }
  }

  .os-edit-body {
    padding: 8px 4px;

    .current-version-line {
      padding-bottom: 12px;
      font-size: 13px;
      color: #63656e;
    }

    .os-mode-line {
      padding-bottom: 12px;
    }

    .os-follow-tip {
      font-size: 12px;
      color: #979ba5;
    }

    .os-specify-select {
      width: 100%;
    }

    .specify-error {
      margin-top: 4px;
      font-size: 12px;
      color: #ea3636;
    }
  }
</style>
