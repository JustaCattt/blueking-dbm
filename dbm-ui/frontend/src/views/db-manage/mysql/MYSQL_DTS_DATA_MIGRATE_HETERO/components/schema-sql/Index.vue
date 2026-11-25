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
  <DbSideslider
    :before-close="handleBeforeClose"
    class="schema-sql-sideslider"
    :is-show="isShow"
    :width="1080"
    @update:is-show="handleClose">
    <template #header>
      <div class="schema-sql-header">
        <span class="schema-sql-title">{{ t('目标表结构') }}</span>
        <span
          class="schema-sql-context"
          :title="`${sourceDomain} → ${targetDomain}`">
          {{ sourceDomain }} → {{ targetDomain }}
        </span>
      </div>
    </template>
    <div class="schema-sql-workbench">
      <BkAlert
        v-if="error"
        class="schema-sql-error"
        theme="danger"
        :title="error" />
      <BkLoading
        class="schema-sql-loading"
        color="#2f3036"
        :loading="loading">
        <div class="schema-sql-body">
          <div class="schema-sql-list">
            <div class="schema-sql-list-header">{{ t('表清单') }}</div>
            <div class="schema-sql-search">
              <DbInput
                v-model="search"
                clearable
                :placeholder="t('搜索表名')"
                size="small"
                type="search" />
            </div>
            <div class="schema-sql-items">
              <div
                v-for="(tables, db) in groupedTables"
                :key="db"
                class="schema-sql-group">
                <div class="schema-sql-db">{{ db || '--' }}</div>
                <button
                  v-for="table in tables"
                  :key="table.line"
                  class="schema-sql-table"
                  :class="{ 'is-active': activeLine === table.line, 'is-warn': !table.shardKey }"
                  type="button"
                  @click="handleLocate(table)">
                  <span
                    class="schema-sql-status"
                    :class="{ 'is-warn': !table.shardKey }">
                    <DbIcon
                      v-if="!table.shardKey"
                      type="attention" />
                    <span
                      v-else
                      class="schema-sql-status-dot" />
                  </span>
                  <span
                    class="schema-sql-table-name"
                    :title="table.table">
                    {{ table.table }}
                  </span>
                  <span
                    class="schema-sql-table-meta"
                    :class="{ 'schema-sql-danger': !table.shardKey }">
                    <span>shardkey:</span>
                    <span
                      class="schema-sql-table-key"
                      :title="table.shardKey">
                      {{ table.shardKey || '--' }}
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <div class="schema-sql-summary">
              {{ t('共 n 张表', { n: parsedTables.length }) }}
              <span
                v-if="missingTables.length"
                class="schema-sql-danger">
                {{ t('n 张缺 shardkey', { n: missingTables.length }) }}
              </span>
            </div>
          </div>
          <div class="schema-sql-editor-pane">
            <div class="schema-sql-toolbar">
              <span>{{ t('SQL 文件编辑') }}</span>
              <div class="schema-sql-actions">
                <BkButton
                  :disabled="loading || !draft"
                  text
                  theme="primary"
                  @click="handleDownload">
                  {{ t('下载') }}
                </BkButton>
                <BkButton
                  v-if="!readonly"
                  :disabled="loading"
                  text
                  theme="primary"
                  @click="fileRef?.click()">
                  {{ t('替换') }}
                </BkButton>
              </div>
              <input
                ref="file"
                accept=".sql"
                hidden
                type="file"
                @change="handleUpload" />
            </div>
            <div
              ref="editorContainer"
              class="schema-sql-editor" />
          </div>
        </div>
      </BkLoading>
    </div>
    <template #footer>
      <BkButton
        v-if="!readonly"
        v-bk-tooltips="{ content: t('没有可确认的修改'), disabled: canConfirm }"
        class="w-88 mr-8"
        :disabled="!canConfirm"
        theme="primary"
        @click="handleConfirm">
        {{ t('确定') }}
      </BkButton>
      <BkButton
        class="w-88"
        @click="handleClose">
        {{ readonly ? t('关闭') : t('取消') }}
      </BkButton>
    </template>
  </DbSideslider>
</template>
<script setup lang="ts">
  import InfoBox from 'bkui-vue/lib/info-box';
  import * as monaco from 'monaco-editor';
  import { useI18n } from 'vue-i18n';

  import { getDtsSchemaSql } from '@services/source/mysqlToolbox';

  import { markPageChanged } from '@utils';

  import { parseSchemaSql, type SchemaTable } from '../../schemaSql';

  interface Props {
    focusMissing?: boolean;
    readonly?: boolean;
    requestParams?: ServiceParameters<typeof getDtsSchemaSql>;
    sourceDomain?: string;
    sql: string;
    targetDomain?: string;
  }

  type Emits = {
    (e: 'confirm', sql: string): void;
    (e: 'status', status: 'loading' | 'error' | 'idle'): void;
  };

  const props = withDefaults(defineProps<Props>(), {
    focusMissing: false,
    readonly: false,
    requestParams: undefined,
    sourceDomain: '',
    targetDomain: '',
  });
  const emits = defineEmits<Emits>();
  const isShow = defineModel<boolean>('isShow', { default: false });
  const { t } = useI18n();
  const editorContainerRef = useTemplateRef('editorContainer');
  const fileRef = useTemplateRef('file');
  const draft = ref('');
  const search = ref('');
  const activeLine = ref<number>();
  const error = ref('');
  const loading = ref(false);
  const loadFailed = ref(false);
  let original = '';
  let requestVersion = 0;
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let editorSubscription: monaco.IDisposable | undefined;

  const parsedTables = computed(() => parseSchemaSql(draft.value));
  const missingTables = computed(() => parsedTables.value.filter((table) => !table.shardKey));
  const canConfirm = computed(
    () =>
      !loading.value && !loadFailed.value && parsedTables.value.length > 0 && (!props.sql || draft.value !== props.sql),
  );
  const groupedTables = computed(() => {
    const result: Record<string, SchemaTable[]> = Object.create(null);
    parsedTables.value.forEach((table) => {
      if (!`${table.db}.${table.table}`.toLowerCase().includes(search.value.toLowerCase())) return;
      (result[table.db] ||= []).push(table);
    });
    return result;
  });

  const handleLocate = (table: SchemaTable) => {
    activeLine.value = table.line;
    editor?.revealLineInCenter(table.line);
    editor?.setPosition({ column: 1, lineNumber: table.line });
    editor?.focus();
  };

  const disposeEditor = () => {
    editorSubscription?.dispose();
    const model = editor?.getModel();
    editor?.dispose();
    model?.dispose();
    editor = undefined;
  };

  const handleClose = () => {
    requestVersion += 1;
    disposeEditor();
    isShow.value = false;
    // 首次获取未确定时丢弃草稿；失败态保留，单元格提供重新获取。
    if (!loadFailed.value) emits('status', 'idle');
  };

  const confirmDiscard = (title: string) =>
    new Promise<boolean>((resolve) => {
      InfoBox({
        cancelText: t('取消'),
        confirmText: t('确定'),
        onCancel: () => resolve(false),
        onConfirm: () => resolve(true),
        title,
      });
    });

  const handleBeforeClose = async () => {
    if (!props.readonly && draft.value !== original && !(await confirmDiscard(t('放弃本次修改？')))) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!canConfirm.value) return;
    emits('confirm', draft.value);
    markPageChanged();
    handleClose();
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([draft.value], { type: 'application/sql;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'migrate.sql';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/\.sql$/i.test(file.name)) {
      error.value = t('请上传 .sql 文件');
      return;
    }
    const version = requestVersion;
    const sql = await file.text();
    if (version !== requestVersion || !isShow.value) return;
    if (!parseSchemaSql(sql).length) {
      error.value = t('文件中未识别到 CREATE TABLE 语句，请检查后再上传');
      return;
    }
    if (!(await confirmDiscard(t('替换当前 SQL 文件？'))) || version !== requestVersion) return;
    error.value = '';
    loadFailed.value = false;
    draft.value = sql;
    editor?.setValue(sql);
  };

  watch(
    [isShow, editorContainerRef],
    async ([show, container]) => {
      if (!show) {
        requestVersion += 1;
        disposeEditor();
        return;
      }
      // 侧滑延迟挂载内容，等容器出现后再初始化编辑器和获取 SQL。
      if (!container) return;
      const version = ++requestVersion;
      search.value = '';
      activeLine.value = undefined;
      error.value = '';
      loadFailed.value = false;
      loading.value = false;
      draft.value = props.sql;
      original = props.sql;
      await nextTick();
      if (!isShow.value || version !== requestVersion || !editorContainerRef.value) return;
      // 背景使用原型的 text-primary 97% + black，与工作台 CSS 保持一致。
      monaco.editor.defineTheme('dts-schema', {
        base: 'vs-dark',
        colors: {
          'editor.background': '#303136',
          'editorLineNumber.foreground': '#ffffff52',
        },
        inherit: true,
        rules: [],
      });
      editor = monaco.editor.create(editorContainerRef.value, {
        automaticLayout: true,
        fontSize: 12,
        language: 'sql',
        lineHeight: 20,
        minimap: { enabled: false },
        padding: { bottom: 24, top: 12 },
        readOnly: props.readonly,
        scrollBeyondLastLine: false,
        theme: 'dts-schema',
        value: draft.value,
      });
      editorSubscription = editor.onDidChangeModelContent(() => {
        draft.value = editor?.getValue() || '';
      });
      if (!props.sql && !props.readonly && props.requestParams) {
        loading.value = true;
        emits('status', 'loading');
        try {
          const result = await getDtsSchemaSql(props.requestParams);
          if (version !== requestVersion || !isShow.value) return;
          if (!parseSchemaSql(result.sql).length) throw new Error('empty schema');
          draft.value = result.sql;
          original = result.sql;
          editor?.setValue(result.sql);
          emits('status', 'idle');
        } catch {
          if (version !== requestVersion || !isShow.value) return;
          loadFailed.value = true;
          error.value = t('加载失败');
          emits('status', 'error');
        } finally {
          if (version === requestVersion) loading.value = false;
        }
      } else {
        loading.value = false;
      }
      if (props.focusMissing && missingTables.value[0]) handleLocate(missingTables.value[0]);
    },
    { flush: 'post', immediate: true },
  );

  onBeforeUnmount(() => {
    requestVersion += 1;
    disposeEditor();
  });
</script>
<style lang="less" scoped>
  .schema-sql-header {
    display: flex;
    min-width: 0;
    align-items: center;
  }

  .schema-sql-title {
    flex-shrink: 0;
  }

  .schema-sql-context {
    padding-left: 16px;
    margin-left: 16px;
    overflow: hidden;
    font-size: 14px;
    font-weight: normal;
    line-height: 20px;
    color: #63656e;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-left: 1px solid #dcdee5;
  }

  .schema-sql-workbench {
    display: flex;
    height: calc(100vh - 100px);
    padding: 12px;
    overflow: hidden;
    background: color-mix(in srgb, #313238 96%, black);
    box-sizing: border-box;
    flex-direction: column;
  }

  .schema-sql-error {
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .schema-sql-loading {
    flex: 1;
    min-height: 0;
  }

  .schema-sql-body {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 12px;
  }

  .schema-sql-list {
    display: flex;
    width: 268px;
    min-height: 0;
    overflow: hidden;
    background: color-mix(in srgb, #313238 90%, black);
    border: 1px solid color-mix(in srgb, #fff 14%, transparent);
    border-radius: 3px;
    flex-shrink: 0;
    flex-direction: column;
  }

  .schema-sql-list-header {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #fff;
    border-bottom: 1px solid color-mix(in srgb, #fff 10%, transparent);
  }

  .schema-sql-search {
    padding: 12px 12px 8px;

    :deep(.dbm-input) {
      height: 26px;
      color: #fff;
      background: color-mix(in srgb, #313238 84%, black);
      border-color: color-mix(in srgb, #fff 18%, transparent);

      &.is-focused {
        border-color: #3a84ff;
      }
    }

    :deep(.dbm-input .dbm-input-text) {
      color: #fff;
      background-color: transparent;

      &::placeholder {
        color: color-mix(in srgb, #fff 45%, transparent);
      }
    }

    :deep(.dbm-input .dbm-input-suffix-icon) {
      background-color: transparent;
    }
  }

  .schema-sql-items {
    flex: 1;
    min-height: 0;
    padding-bottom: 8px;
    overflow-y: auto;
  }

  .schema-sql-db {
    position: sticky;
    top: 0;
    padding: 8px 16px;
    font-size: 12px;
    line-height: 16px;
    color: #c4c6cc;
    background: color-mix(in srgb, #313238 84%, black);
  }

  .schema-sql-table {
    display: flex;
    width: 100%;
    padding: 6px 16px;
    font-size: 12px;
    line-height: 16px;
    color: color-mix(in srgb, #fff 82%, transparent);
    text-align: left;
    cursor: pointer;
    background: none;
    border: none;
    gap: 8px;
    align-items: center;

    &:hover {
      background: color-mix(in srgb, #fff 8%, transparent);
    }

    &.is-active {
      color: #fff;
      background: color-mix(in srgb, #3a84ff 45%, black);

      .schema-sql-table-meta {
        color: #fff;
      }

      &.is-warn {
        background: color-mix(in srgb, #ea3636 40%, black);
      }
    }
  }

  .schema-sql-status {
    display: inline-flex;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    color: #2dcb56;

    &.is-warn {
      color: #ff5656;
    }
  }

  .schema-sql-status-dot {
    width: 10px;
    height: 10px;
    background: currentcolor;
    border-radius: 50%;
  }

  .schema-sql-table-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .schema-sql-table-meta {
    display: inline-flex;
    width: 108px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: color-mix(in srgb, #fff 55%, transparent);
    flex-shrink: 0;
    align-items: baseline;
  }

  .schema-sql-table-key {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .schema-sql-summary {
    padding: 8px 16px;
    font-size: 12px;
    line-height: 16px;
    color: #c4c6cc;
    border-top: 1px solid color-mix(in srgb, #fff 10%, transparent);
    flex-shrink: 0;
  }

  .schema-sql-danger {
    color: #ff5656;
  }

  .schema-sql-editor-pane {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    background: color-mix(in srgb, #313238 97%, black);
    border: 1px solid color-mix(in srgb, #fff 14%, transparent);
    border-radius: 3px;
    flex-direction: column;
  }

  .schema-sql-toolbar {
    display: flex;
    padding: 8px 16px;
    font-size: 14px;
    line-height: 20px;
    color: color-mix(in srgb, #fff 62%, transparent);
    background: color-mix(in srgb, #313238 88%, black);
    border-bottom: 1px solid color-mix(in srgb, #fff 10%, transparent);
    flex-shrink: 0;
    align-items: center;
  }

  .schema-sql-actions {
    display: inline-flex;
    margin-left: auto;
    gap: 16px;
    align-items: center;

    :deep(.bk-button.is-text.bk-button-primary:not(.is-disabled)) {
      font-size: 12px;
      color: color-mix(in srgb, #3a84ff 55%, white);

      &:hover {
        color: #fff;
      }
    }
  }

  .schema-sql-editor {
    flex: 1;
    min-height: 0;
  }
</style>
