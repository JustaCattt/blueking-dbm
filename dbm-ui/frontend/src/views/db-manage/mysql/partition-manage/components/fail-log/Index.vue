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
    ref="rootRef"
    class="partition-fail-log"
    :class="{ 'is-full-screen': isFullscreen }">
    <div class="editor-layout-header">
      <div class="editro-action-box">
        <CodeFormat
          :data="localValue"
          @format="handleCodeFormat" />
        <FontSetting @change="handleChangeFontSize" />
        <FullScreen @change="handleChangeFullScreen" />
      </div>
    </div>
    <div
      class="editor-main-resizer"
      style="height: 100%">
      <div
        ref="editorRef"
        style="height: calc(100% - 88px)" />
    </div>
  </div>
</template>
<script setup lang="ts">
  import * as monaco from 'monaco-editor';
  import screenfull from 'screenfull';
  import { format } from 'sql-formatter';
  import { useI18n } from 'vue-i18n';
  import { useRequest } from 'vue-request';

  import type PartitionModel from '@services/model/partition/partition';
  import { queryFailLog } from '@services/source/partitionManage';

  import CodeFormat from './components/CodeFormat.vue';
  import FontSetting from './components/FontSetting.vue';
  import FullScreen from './components/FullScreen.vue';

  interface Props {
    data: PartitionModel;
  }

  const props = defineProps<Props>();

  let editor: monaco.editor.IStandaloneCodeEditor;

  const { t } = useI18n();

  const rootRef = ref();
  const editorRef = ref();
  const isFullscreen = ref(false);
  const localValue = ref('');

  const { run: queryFailLogData } = useRequest(queryFailLog, {
    manual: true,
    onSuccess: (result) => {
      editor?.setValue(result.exec_log);
      localValue.value = result.exec_log;
    },
  });

  watch(
    () => props.data.id,
    () => {
      if (props.data.id) {
        // queryFailLogData({
        //   config_id: props.data.id,
        // });
      }
    },
    {
      immediate: true,
    },
  );

  const handleToggleScreenfull = () => {
    if (screenfull.isFullscreen) {
      isFullscreen.value = true;
    } else {
      isFullscreen.value = false;
    }
    editor.layout();
  };

  const handleChangeFullScreen = () => {
    screenfull.toggle(rootRef.value);
  };

  const handleChangeFontSize = (fontSize: number) => {
    editor.updateOptions({ fontSize });
  };

  const handleCodeFormat = () => {
    localValue.value = format(localValue.value);
  };

  onMounted(() => {
    nextTick(() => {
      editor = monaco.editor.create(editorRef.value, {
        automaticLayout: true,
        fontSize: 16,
        language: 'sql',
        lineNumbersMinChars: 3,
        minimap: {
          enabled: false,
        },
        readOnly: true,
        renderLineHighlight: 'none',
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
        theme: 'vs-dark',
        wordWrap: 'on',
      });
      editor.onDidChangeModelContent(() => {
        const value = editor.getValue();
        if (value !== localValue.value) {
          localValue.value = value;
        }
      });
    });

    screenfull.on('change', handleToggleScreenfull);
  });

  onBeforeUnmount(() => {
    editor.dispose();
    screenfull.off('change', handleToggleScreenfull);
  });
</script>
<style lang="less" scoped>
  .partition-fail-log {
    position: relative;
    z-index: 0;
    height: 100%;

    &.is-full-screen {
      display: flex;
      height: 100vh;
      flex-direction: column;
    }

    .editor-layout-header {
      display: flex;
      align-items: center;
      height: 40px;
      padding-right: 16px;
      padding-left: 25px;
      font-size: 12px;
      color: #c4c6cc;
      background: #2e2e2e;
      justify-content: space-between;

      .editro-action-box {
        display: flex;
        color: #979ba5;
        align-items: center;

        & > * {
          cursor: pointer;
        }
      }
    }
  }
</style>
