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
  <SmartAction>
    <BkAlert
      class="mb-16"
      closable
      theme="info"
      :title="
        t('基于源模块创建新模块_常用于数据库版本升级_源模块自定义值将保留_新版本不兼容的参数将被废弃_请审慎后创建_')
      " />
    <DbForm
      ref="formRef"
      class="clone-module-page db-scroll-y"
      :label-width="100"
      :model="formData"
      :rules="rules"
      :scroll-align-to-top="false">
      <!-- 模块信息 -->
      <div class="module-info-card">
        <!-- 模块名 -->
        <FormItemWithHint
          class="form-item-name"
          :label="t('模块名称')"
          :model="formData.alias_name"
          property="alias_name"
          required
          :rules="rules.alias_name">
          <template #hint>
            {{ t('仅支持小写字母、数字、连字符，同时会参与集群域名生成，') }}
            <span class="hint-warning">{{ t('创建后不可改') }}</span>
          </template>
          <div class="module-name-row">
            <BkInput
              v-model="formData.alias_name"
              class="module-name-input"
              :maxlength="63"
              :placeholder="t('请输入模块名')"
              show-word-limit
              @change="handleValidate" />
            <DomainPreview :module-name="formData.alias_name" />
          </div>
        </FormItemWithHint>
        <!-- 数据库信息 -->
        <BkFormItem
          :label="t('数据库类型')"
          required>
          <div class="db-type-row">
            <DbTag
              class="db-type-tag"
              theme="info"
              type="stroke">
              <template #icon>
                <i class="db-icon-mysql mr-5" />
              </template>
              {{ clusterTypeInfos[clusterType]?.name }}
            </DbTag>
            <span class="db-type-lock-tip">{{ t('源模块已锁定') }}</span>
          </div>
        </BkFormItem>
        <!-- 字符集 -->
        <BkFormItem
          :label="t('字符集')"
          required>
          <div class="charset-row">
            <DbSelect
              v-model="formData.charset"
              class="charset-select-inline"
              :clearable="false"
              filterable
              :placeholder="t('请选择字符集')"
              :prefix="t('字符集')"
              @change="handleValidate">
              <DbOption
                v-for="(item, index) of characterSets"
                :key="index"
                :label="item"
                :value="item">
                <span>{{ item }}</span>
                <DbTag
                  v-if="sourceCharset && item === sourceCharset"
                  class="ml-5"
                  theme="info">
                  {{ t('源字符集') }}
                </DbTag>
              </DbOption>
            </DbSelect>
          </div>
        </BkFormItem>
      </div>

      <!-- 存储层：三级版本选型 + OS 约束；克隆带出源发行版，可改 -->
      <div class="layer-config-card">
        <div class="layer-title">{{ t('存储层') }}</div>
        <VersionOsEditor
          ref="storageEditorRef"
          :db-type="DBTypes.MYSQL"
          pkg-type="mysql"
          @before-series-change="handleBeforeStorageSeriesChange"
          @change="handleStorageChange" />
      </div>

      <!-- 接入层：仅 MySQL 主从（tendbha）；克隆带出源系列/版本，可改 -->
      <div
        v-if="clusterType === ClusterTypes.TENDBHA"
        class="layer-config-card">
        <div class="layer-title">{{ t('接入层') }}</div>
        <VersionOsEditor
          ref="proxyEditorRef"
          :db-type="DBTypes.MYSQL"
          default-distribution-name="DBM"
          pkg-type="mysql-proxy"
          @before-series-change="handleBeforeProxySeriesChange"
          @change="handleProxyChange" />
      </div>

      <!-- 参数配置 Tab -->
      <div class="param-config-wrapper">
        <BkException
          v-if="!formData.db_version || confTabs.length === 0"
          :description="t('请先选择目标数据库版本')"
          scene="part"
          type="empty" />
        <template v-else>
          <BkTab
            :key="tabRenderKey"
            v-model:active="activeConfType"
            type="card-tab">
            <BkTabPanel
              v-for="tab of confTabs"
              :key="tab.conf_file"
              :name="tab.conf_file"
              render-directive="show">
              <template #label>
                {{ tab.name }}
              </template>
              <!-- 首个 Tab（dbconf）：克隆对比模式，含 diff/废弃 -->
              <ParamTable
                v-if="tab.conf_type === 'dbconf'"
                :ref="(el: any) => setTableRef(tab.conf_file, el)"
                :deprecated-count="removedCount"
                @deprecated-click="handleShowDeprecated" />
              <!-- 其他 Tab：层级配置模式，仅自定义过滤 -->
              <LevelConfigTable
                v-else
                :ref="(el: any) => setTableRef(tab.conf_file, el)" />
            </BkTabPanel>
          </BkTab>
        </template>
      </div>
    </DbForm>
    <template #action>
      <!-- §2.3 创建按钮：该层版本未选齐则不可用；指定范围已选为空亦不可用 -->
      <BkButton
        class="w-88"
        :disabled="!isVersionSelectionComplete"
        :loading="isSubmitting"
        theme="primary"
        @click="handleSubmit">
        {{ t('确定') }}
      </BkButton>
      <BkButton
        class="w-88 ml-8"
        :disabled="isSubmitting"
        @click="handleCancel">
        {{ t('取消') }}
      </BkButton>
      <!-- 全 Tab 统计汇总 -->
      <template v-if="totalCounts.custom > 0 || totalCounts.changed > 0 || totalCounts.removed > 0">
        <span
          v-if="totalCounts.custom > 0"
          class="action-stat-chip custom ml-16">
          {{ t('自定义') }}<span class="stat-num">{{ totalCounts.custom }}</span>
        </span>
        <span
          v-if="totalCounts.changed > 0"
          class="action-stat-chip changed">
          {{ t('参数值变化') }}<span class="stat-num">{{ totalCounts.changed }}</span>
        </span>
        <span
          v-if="totalCounts.removed > 0"
          class="action-stat-chip removed"
          @click="handleShowDeprecated">
          {{ t('已废弃') }}<span class="stat-num">{{ totalCounts.removed }}</span>
        </span>
      </template>
    </template>
  </SmartAction>

  <!-- 废弃参数侧滑 -->
  <BkSideslider
    :is-show="isShowSlider"
    quick-close
    width="600px"
    @closed="isShowSlider = false">
    <template #header>
      {{ t('废弃参数详情') }}
      <span class="sideslider-sub-title">
        {{ activeConfType }}：{{ t('共n个参数将不进入新模块', { n: deprecatedItems.length }) }}
      </span>
    </template>
    <div class="deprecated-sider-body">
      <DbTable
        ref="sliderTableRef"
        :data-source="deprecatedDataSource"
        row-key="conf_name">
        <TableColumn
          col-key="conf_name"
          :min-width="300"
          :title="t('参数名')" />
      </DbTable>
    </div>
  </BkSideslider>

  <Teleport to="#dbContentTitleAppend">
    <span class="clone-module-meta">
      <span> {{ t('业务') }}：{{ bizInfo.name || '--' }} </span>
      <span> {{ t('源模块') }}：{{ String(route.query.moduleName) || '--' }} </span>
    </span>
  </Teleport>
</template>

<script setup lang="ts">
  import InfoBox from 'bkui-vue/lib/info-box';
  import { useI18n } from 'vue-i18n';
  import { useRequest } from 'vue-request';

  import { checkDbModuleUnique, createModules } from '@services/source/cmdb';
  import {
    type CloneConfItem,
    type CloneModuleQueryResult,
    getLevelConfig,
    getListClusterModuleConfFiles,
    moduleCloneQuery,
    saveModulesDeployInfo,
  } from '@services/source/configs';

  import { useGlobalBizs } from '@stores';

  import { clusterTypeInfos, ClusterTypes, DBTypes } from '@common/const';

  import DbTable from '@components/db-table/IndexNew.vue';
  import FormItemWithHint from '@components/form-item-with-hint/Index.vue';

  import DomainPreview from '@views/db-configure/components/DomainPreview.vue';
  import VersionOsEditor, { type VersionOsValue } from '@views/db-configure/components/VersionOsEditor.vue';
  import { saveConfigureState } from '@views/db-configure/utils/configureState';

  import { random } from '@utils';

  import LevelConfigTable from '../components/LevelConfigTable.vue';
  import ParamTable from '../components/ParamTable.vue';

  type Emits = (e: 'routerBack') => void;

  const emits = defineEmits<Emits>();

  const { t } = useI18n();
  const router = useRouter();
  const route = useRoute();
  const globalBizsStore = useGlobalBizs();

  const clusterType = ref(route.params.clusterType as ClusterTypes);
  const bizId = window.PROJECT_CONFIG.BIZ_ID;

  // 业务信息
  const bizInfo = computed(() => globalBizsStore.bizs.find((info) => info.bk_biz_id === bizId) || { name: '' });

  const isSubmitting = ref(false);
  // 每个 confFile 对应一个 ParamTable 实例
  const tableRefs = ref<Record<string, InstanceType<typeof ParamTable>>>({});
  /** 当前活跃 Tab 对应的 ParamTable 实例 */
  const currentParamTable = computed(() => tableRefs.value[activeConfType.value]);
  const setTableRef = (name: string, el: any) => {
    if (el) {
      tableRefs.value[name] = el;
    }
  };

  /**
   * §2.3 创建按钮可用性：各层版本选齐且指定范围模式下已选非空
   * 存储层必备；主从（tendbha）另需接入层选齐
   */
  const isVersionSelectionComplete = computed(() => {
    const storage = storageVersion.value;
    const storageOk =
      storage.versionId !== '' && (storage.osMode === 'follow' || storage.specifyOs.length > 0);
    if (!storageOk) return false;
    if (clusterType.value === ClusterTypes.TENDBHA) {
      const proxy = proxyVersion.value;
      return proxy.versionId !== '' && (proxy.osMode === 'follow' || proxy.specifyOs.length > 0);
    }
    return true;
  });

  // 表单数据
  const formData = reactive({
    alias_name: '',
    charset: '',
    db_version: '',
  });
  const formRef = ref();
  const sliderTableRef = ref();
  /** 源字符集（从路由取，由源模块列表页 moduleInfo.charset 传入） */
  const sourceCharset = ref<string>('');
  const isShowSlider = ref(false);
  // 当前活跃 Tab
  const activeConfType = ref('dbconf');
  const tabRenderKey = ref(random());
  const confTabs = ref<ServiceReturnType<typeof getListClusterModuleConfFiles>>([]);

  const characterSets = ['utf8', 'utf8mb4', 'gbk', 'latin1', 'gb2312'];

  // 集群类型 → 协议组件名映射（创建模块 db_versions 的 key）
  const clusterComponentNames: Record<string, string[]> = {
    [ClusterTypes.TENDBHA]: ['backend', 'proxy'],
    [ClusterTypes.TENDBSINGLE]: ['single'],
  };

  /** 存储层选型值（backend / single） */
  const storageVersion = ref<VersionOsValue>({
    distributionId: '',
    osMode: 'follow',
    seriesId: '',
    specifyOs: [],
    versionId: '',
  });
  /** 接入层选型值（proxy，仅主从） */
  const proxyVersion = ref<VersionOsValue>({
    distributionId: '',
    osMode: 'follow',
    seriesId: '',
    specifyOs: [],
    versionId: '',
  });

  const storageEditorRef = ref<InstanceType<typeof VersionOsEditor>>();
  const proxyEditorRef = ref<InstanceType<typeof VersionOsEditor>>();

  /** 存储层选型变化：更新 db_version（参数 Tab 依赖）并同步校验 */
  const handleStorageChange = (value: VersionOsValue) => {
    storageVersion.value = value;
    // 参数 Tab 的版本标识取系列名（§4：同系列换版本号不重载）
    formData.db_version = storageEditorRef.value?.getSeriesName() ?? '';
    handleValidate();
  };

  const handleProxyChange = (value: VersionOsValue) => {
    proxyVersion.value = value;
  };

  /**
   * §4 重载确认：换存储层系列会重载 mysql 存储 Tab（克隆场景为 dbconf 对比 Tab）；
   * 已有审查结果时弹 InfoBox 二次确认（对象写「存储层」），取消则版本下拉回滚
   */
  const handleBeforeStorageSeriesChange = (next: () => void) => {
    const changedCount = totalCounts.value.changed + totalCounts.value.custom;
    if (changedCount === 0) {
      next();
      return;
    }
    InfoBox({
      cancelText: t('取消'),
      confirmText: t('确定'),
      content: t('存储层系列变更将重载参数配置_n_项审查内容将被丢弃_是否继续_', { n: changedCount }),
      headerAlign: 'center',
      onConfirm: () => {
        next();
      },
      title: t('确认重载存储层参数_'),
    });
  };

  /** §4：MySQL 主从无 proxy 参数 Tab，仅更新部署默认，直接放行 */
  const handleBeforeProxySeriesChange = (next: () => void) => {
    next();
  };

  /** 触发表单校验（版本或字符集 change 时） */
  const handleValidate = () => {
    formRef.value?.validate();
  };

  // 模块名校验规则
  const rules = {
    alias_name: [
      {
        message: t('格式不正确_请勿使用中文_大写字母_空格_下划线或特殊符号'),
        trigger: 'blur',
        validator: (value: string) => {
          if (/^[a-z0-9-]+$/.test(value)) {
            return true;
          }
          return false;
        },
      },
      {
        message: t('不能以连字符开头或结尾'),
        trigger: 'blur',
        validator: (value: string) => {
          if (/^(?!-).*(?<!-)$/.test(value)) {
            return true;
          }
          return false;
        },
      },
      {
        message: '',
        trigger: 'blur',
        async validator() {
          if (!formData.alias_name || !formData.db_version || !formData.charset) return true;
          try {
            const data = await checkDbModuleUnique({
              bk_biz_id: String(bizId),
              cluster_type: clusterType.value,
              db_module_name: `${formData.alias_name}-${formData.db_version}-${formData.charset}`,
            });
            return data.is_unique
              ? true
              : t('该名称已被占用（{type} ：{version} / {charset}）', {
                  charset: formData.charset,
                  type: clusterTypeInfos[clusterType.value].name,
                  version: formData.db_version,
                });
          } catch {
            return false;
          }
        },
      },
    ],
  };

  // 克隆查询原始结果
  const cloneResult = ref<CloneModuleQueryResult>({
    bk_biz_id: '',
    conf_file_info: {
      conf_file: '',
      conf_file_lc: '',
      conf_type: '',
      conf_type_lc: '',
      created_at: '',
      description: '',
      namespace: '',
      namespace_info: '',
      updated_at: '',
      updated_by: '',
    },
    conf_names_deprecated: null,
    conf_names_value_diff: {},
    conf_names_value_modified: null,
    content: {},
    level_name: '',
    level_value: '',
  });

  /** 将 content 对象转为数组，并标注 value_source 和 diff_type */
  const currentConfItems = computed<CloneConfItem[]>(() => {
    if (!cloneResult.value.content) return [];
    const modifiedSet = new Set(cloneResult.value.conf_names_value_modified || []);
    const diffMap = cloneResult.value.conf_names_value_diff || {};

    return Object.values(cloneResult.value.content).map((item) => {
      const diffValue = (diffMap as Record<string, string>)[item.conf_name];
      const isInDiff = diffValue !== undefined;

      return {
        ...item,
        diff_type: !isInDiff ? 'none' : diffValue === '_NONE_' ? 'new' : 'changed',
        source_conf_value: diffValue && diffValue !== '_NONE_' ? diffValue : undefined,
        value_source: modifiedSet.has(item.conf_name) ? 'custom' : 'source',
      };
    });
  });

  /** 全 Tab 汇总统计（用于底部操作栏展示） */
  const totalCounts = computed(() => {
    const items = currentConfItems.value;
    return {
      changed: items.filter((i) => i.diff_type === 'changed' || i.diff_type === 'new').length,
      custom: items.filter((i) => i.value_source === 'custom').length,
      removed: deprecatedNames.value.length,
    };
  });

  /** 废弃数量 */
  const removedCount = computed(() => deprecatedNames.value.length);

  /** 废弃参数名列表 */
  const deprecatedNames = computed(() => cloneResult.value.conf_names_deprecated || []);

  /** 废弃参数列表（用于侧滑展示） */
  const deprecatedItems = computed<CloneConfItem[]>(() =>
    deprecatedNames.value.map((name) => {
      const item = cloneResult.value.content[name];
      return item
        ? { ...item, diff_type: 'removed' as const, value_source: 'source' as const }
        : ({
            conf_name: name,
            conf_value: '',
            description: '',
            diff_type: 'removed' as const,
            flag_disable: 0,
            flag_locked: 0,
            level_name: 'plat',
            level_value: '',
            op_type: '',
            stage: 0,
            up_level_value: null,
            value_source: 'source' as const,
          } satisfies CloneConfItem);
    }),
  );

  /** 废弃侧滑数据源 */
  const deprecatedDataSource = () =>
    Promise.resolve({ count: deprecatedItems.value.length, results: deprecatedItems.value });

  /** 获取克隆对比结果 */
  const { run: fetchCloneResult } = useRequest(moduleCloneQuery, {
    manual: true,
    onSuccess(res) {
      cloneResult.value = res;
      nextTick(() => currentParamTable.value?.refreshData());
    },
  });

  /** 获取配置文件 Tab 列表 */
  const { run: fetchConfTabs } = useRequest(getListClusterModuleConfFiles, {
    manual: true,
    onSuccess(res) {
      const rawConfTabs = res || [];
      if (formData.db_version) {
        Object.assign(rawConfTabs[0], {
          conf_file: formData.db_version,
          conf_type: 'dbconf',
          name: formData.db_version,
        });
      }
      confTabs.value = rawConfTabs;
      tabRenderKey.value = random();
    },
  });

  /** 获取非 dbconf Tab 的层级配置数据 */
  const { run: fetchLevelConfig } = useRequest(getLevelConfig, {
    manual: true,
    onSuccess(res) {
      const items: CloneConfItem[] = (res.conf_items || []).map((item) => ({
        conf_name: item.conf_name,
        conf_value: item.conf_value ?? '',
        description: item.description || '',
        diff_type: 'none' as const,
        flag_disable: item.flag_disable ?? 0,
        flag_encrypt: item.flag_encrypt ?? 0,
        flag_locked: item.flag_locked ?? 0,
        flag_readonly: item.flag_readonly ?? 0,
        flag_visible: item.flag_visible ?? 1,
        level_name: (item.level_name as any) || 'plat',
        level_value: item.leval_value ?? '',
        need_restart: item.need_restart ?? 0,
        op_type: item.op_type || '',
        source_conf_value: undefined,
        stage: 0,
        up_level_value: null,
        value_allowed: item.value_allowed || '',
        value_default: item.value_default || '',
        value_source: 'source' as const,
        value_type: item.value_type || 'STRING',
        value_type_sub: item.value_type_sub || '',
      }));
      nextTick(() => currentParamTable.value?.setData(items));
    },
  });

  // 初始化：从路由回填源模块名
  if (route.query.moduleName) {
    formData.alias_name = String(route.query.moduleName);
  }
  if (route.query.confFile) {
    cloneResult.value.conf_file_info.conf_file = String(route.query.confFile);
  }
  // 源字符集从路由取（由源模块列表页 moduleInfo.charset 传入）
  if (route.query.charset) {
    sourceCharset.value = String(route.query.charset);
    formData.charset = String(route.query.charset);
  }

  // 版本变化时：刷新 Tab 列表 + 重新拉取参数对比结果
  watch(
    () => formData.db_version,
    () => {
      fetchConfTabs({
        bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
        deploy_versions: JSON.stringify({ db_version: formData.db_version }),
        meta_cluster_type: clusterType.value,
      });
      fetchCloneResult({
        conf_type: 'dbconf',
        meta_cluster_type: clusterType.value,
        source_bk_biz_id: String(bizId),
        source_conf_file: String(route.query.confFile || ''),
        source_module_id: String(route.query.moduleId || ''),
        target_bk_biz_id: String(bizId),
        target_conf_file: formData.db_version,
      });
    },
  );

  watch(
    currentConfItems,
    (items) => {
      nextTick(() => currentParamTable.value?.setData(items));
    },
    { immediate: true },
  );

  /** Tab 切换时：非 dbconf 调用 getLevelConfig */
  watch(activeConfType, (tabKey) => {
    const currentTab = confTabs.value.find((t) => t.conf_file === tabKey);
    if (!currentTab || currentTab.conf_type === 'dbconf') return;

    fetchLevelConfig({
      bk_biz_id: Number(bizId),
      conf_type: currentTab.conf_type,
      level_name: 'module',
      level_value: String(route.query.moduleId || ''),
      meta_cluster_type: clusterType.value,
      version: tabKey,
    });
  });

  // 初始化首屏数据（dbconf）
  nextTick(() => {
    if (currentConfItems.value.length) {
      currentParamTable.value?.setData(currentConfItems.value);
    }
  });

  // 显示废弃参数侧滑
  const handleShowDeprecated = () => {
    isShowSlider.value = true;
    nextTick(() => {
      sliderTableRef.value?.fetchData();
    });
  };

  /** 提交 */
  const handleSubmit = async () => {
    try {
      await formRef.value?.validate();

      isSubmitting.value = true;

      // 前端补齐校验：后端只校验 db_versions 必传，不校验各层齐全，提交前须确保该集群类型的所有组件都传上来
      const componentNames = clusterComponentNames[clusterType.value] || [];
      const validateResults = [
        { componentName: 'backend', result: storageEditorRef.value?.validate() },
        ...(clusterType.value === ClusterTypes.TENDBHA
          ? [{ componentName: 'proxy', result: proxyEditorRef.value?.validate() }]
          : []),
      ];
      const invalid = validateResults.find((item) => item.result && !item.result.ok);
      if (invalid?.result) {
        console.warn(`${invalid.componentName}: ${invalid.result.message}`);
        return;
      }

      // 组装 db_versions：{组件名: {db_version_id, permit_os_type, permit_os}}
      const dbVersions: Record<string, { db_version_id: number; permit_os: string[]; permit_os_type: string }> = {};
      if (componentNames.includes('single') || componentNames.includes('backend')) {
        dbVersions[componentNames[0]] = storageEditorRef.value!.getWriteValue();
      }
      if (componentNames.includes('proxy')) {
        dbVersions.proxy = proxyEditorRef.value!.getWriteValue();
      }

      // 创建模块
      const dbModuleName = `${formData.alias_name}-${formData.db_version}-${formData.charset}`;
      const createResult = await createModules({
        alias_name: formData.alias_name,
        biz_id: Number(bizId),
        cluster_type: clusterType.value,
        db_module_name: dbModuleName,
        db_versions: Object.keys(dbVersions).length > 0 ? dbVersions : undefined,
      });

      // 绑定部署信息
      await saveModulesDeployInfo({
        bk_biz_id: Number(bizId),
        conf_items: [
          { conf_name: 'charset', conf_value: formData.charset, description: t('字符集'), op_type: 'update' },
          { conf_name: 'db_version', conf_value: formData.db_version, description: t('数据库版本'), op_type: 'update' },
        ],
        conf_type: 'deploy',
        level_name: 'module',
        level_value: createResult.db_module_id,
        meta_cluster_type: clusterType.value,
        version: 'deploy_info',
      });

      window.changeConfirm = false;

      // 保存选中的树节点状态，确保跳转后树能自动选中新模块
      saveConfigureState({
        selectedParentId: `app-${bizId}`,
        selectedTreeId: `module-${createResult.db_module_id}`,
      });

      router.push({
        name: 'DbConfigureList',
        params: {
          clusterType: clusterType.value,
          parentId: `app-${bizId}`,
          treeId: `module-${createResult.db_module_id}`,
        },
      });
    } catch (e) {
      console.error(e);
    }
    isSubmitting.value = false;
  };

  /** 取消 */
  const handleCancel = () => {
    emits('routerBack');
  };
</script>

<style lang="less" scoped>
  .clone-module-page {
    height: 100%;
    padding-bottom: 20px;

    :deep(.bk-form-item) {
      max-width: 690px;
    }
  }

  .module-info-card {
    padding: 24px;
    background: #fff;
    border-radius: 2px;
    box-shadow: 0 2px 4px 0 rgb(25 25 41 / 5%);
  }

  .form-item-name {
    :deep(.hint-warning) {
      color: rgb(255 156 1);
    }
  }

  .module-name-row {
    display: flex;
    align-items: center;

    .module-name-input {
      width: 371px;
      flex-shrink: 0;
    }
  }

  .layer-config-card {
    padding: 16px 24px 20px;
    margin-top: 16px;
    background: #fff;
    border-radius: 2px;
    box-shadow: 0 2px 4px 0 rgb(25 25 41 / 5%);

    .layer-title {
      padding-bottom: 12px;
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 700;
      color: #313238;
      border-bottom: 1px solid #dcdee5;
    }
  }

  .charset-row {
    .charset-select-inline {
      width: auto;
      min-width: 160px;
    }
  }

  .db-type-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .db-type-lock-tip {
      font-size: 12px;
      color: #979ba5;
    }
  }

  .db-config-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .version-select-inline,
    .charset-select-inline {
      width: auto;
      min-width: 160px;
    }

    .version-form-item,
    .charset-form-item {
      margin-bottom: 0;

      :deep(.bk-form-content) {
        margin-bottom: 0;
      }
    }
  }

  .param-config-wrapper {
    margin-top: 16px;
    background: #fff;
    border-radius: 2px;
    box-shadow: 0 2px 4px 0 rgb(25 25 41 / 5%);

    :deep(.bk-tab-content) {
      padding: 16px 16px 0;
    }
  }

  .db-type-tag {
    height: 30px;
    color: @primary-color;
    background: white;
    border: 1px solid @border-primary;
  }

  .action-bar {
    display: flex;
    padding: 16px 24px;
    margin-top: 16px;
    background: #fff;
    border-radius: 2px;
    align-items: center;
    gap: 8px;
  }

  .sideslider-sub-title {
    position: relative;
    padding-left: 8px;
    margin-left: 8px;
    font-family: 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    line-height: 22px;
    color: #979ba5;

    &::before {
      position: absolute;
      top: 50%;
      left: 0;
      width: 1px;
      height: 14px;
      background: #dcdee5;
      content: '';
      transform: translateY(-50%);
    }
  }

  .clone-module-meta {
    display: inline-flex;
    margin-left: 8px;
    font-size: 14px;
    color: #979ba5;
    align-items: center;
    gap: 8px;

    & > span + span {
      margin-left: 8px;
    }

    &::before {
      display: inline-block;
      width: 1px;
      height: 14px;
      background: #dcdee5;
      content: '';
    }
  }

  .action-stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 18px;
    color: #63656e;

    .stat-num {
      display: inline-flex;
      height: 18px;
      min-width: 18px;
      padding: 0 5px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      border-radius: 9px;
      align-items: center;
      justify-content: center;
    }

    &.custom .stat-num {
      background: #f59500;
    }

    &.changed .stat-num {
      background: #3a84ff;
    }

    &.removed {
      cursor: pointer;

      .stat-num {
        background: #ea3636;
      }
    }
  }

  .deprecated-sider-body {
    padding: 16px 20px;
  }
</style>
