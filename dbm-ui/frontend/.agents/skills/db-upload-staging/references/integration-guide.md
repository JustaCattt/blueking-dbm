# 业务表单接入指南

> 本文档指导业务表单如何接入改造后的 `db-upload` 组件，实现 staging 暂存 + commit 完整流程。以 `src/views/version-files/v2/.../edit-version/` 为主示例（demo HTML「添加版本包」的真实对应物）。

## 1. 接入清单

业务表单接入新上传规范需完成以下 7 项：

1. 引入 `DbUpload` 并传入 `stagingUploadHandler` / `duplicateChecker` / `cleanupHandler`
2. 实现 `stagingUploadHandler`（调 `uploadStagingFile` 服务函数）
3. 实现 `cleanupHandler`（调 `cleanupStagingFiles` 服务函数）
4. 表单提交时 `dbUploadRef.getStagingRefs()` 收集 temp_id → 调 `commitStagingFiles`
5. 取消 / 关闭弹窗时 `dbUploadRef.cleanupAll()`
6. commit 过期处理（banner + 行级标签）
7. 与 `DbSideslider` 的 `disabledConfirm` 联动提交置灰

## 2. 完整接入示例：version-files 编辑版本

> 参考 `src/views/version-files/v2/components/list/components/sub-version-list/components/edit-version/Index.vue` 及其子组件 `version-files/Index.vue` + `UploadFile.vue`

### 2.1 父表单（edit-version/Index.vue）

```vue
<template>
  <BkSideslider
    v-model:is-show="isShow"
    :before-close="handleBeforeClose"
    :disabled-confirm="versionFilesRef?.submitDisabledReason || !isFormChanged"
    render-directive="if"
    :width="960"
    @closed="handleCancel">
    <!-- ...existing header... -->
    <div class="content-main">
      <BkForm ref="formRef" :model="formModel" :rules="formRules">
        <!-- ...existing form items (version_series, full_version, name, phase)... -->
        <BkFormItem :label="t('版本文件')" property="files" :required="!isEdit">
          <BkAlert class="mb-8" closable theme="warning"
            :title="t('任意两个文件不能覆盖同一个 OS 版本，否则部署版本时系统无法判定使用哪一份。')" />
          <!-- 过期 banner（commit 失败时显示） -->
          <BkAlert v-if="expiredBannerVisible" class="mb-8" closable theme="error"
            :title="t('部分文件已过期，请重新上传')" />
          <VersionFiles
            ref="versionFilesRef"
            :data="dbVersion?.packages"
            :db-type="dbType"
            :pkg-type="pkgType"
            :version="versionSeriesLabel"
            @value-change="handleValueChange" />
        </BkFormItem>
        <!-- ...existing (description, enable)... -->
      </BkForm>
    </div>
    <!-- footer 由 DbSideslider 内置，disabled-confirm 控制置灰 -->
  </BkSideslider>
</template>

<script setup lang="ts">
  // ...existing imports...
  import { commitStagingFiles } from '@services/source/storage';
  import type { StagingFileRef } from '@components/db-upload';

  const versionFilesRef = ref<InstanceType<typeof VersionFiles>>();
  const expiredBannerVisible = ref(false);

  const handleConfirm = async () => {
    // 1. 校验表单
    const valid = await formRef.value?.validate();
    if (!valid) return;

    // 2. 收集 staging 引用
    const stagingRefs = versionFilesRef.value!.getStagingRefs();
    if (stagingRefs.length === 0) return;

    // 3. 调 commit（事务内移入正式区 + 落元数据）
    isLoading.value = true;
    try {
      const result = await commitStagingFiles({
        temp_ids: stagingRefs.map((r) => r.tempId),
        scene: 'version_package',
        metadata: {
          ...formModel,
          // OS 适配信息由 VersionFiles 子组件收集
          packages: versionFilesRef.value!.getValue(),
        },
      });
      // 4. 成功 → 关闭
      Message({ theme: 'success', message: t('提交成功') });
      handleCancel();
    } catch (err: any) {
      // 5. 过期处理：后端返回 expired_temp_ids
      if (err?.code === 40901 && err?.data?.expired_temp_ids) {
        expiredBannerVisible.value = true;
        versionFilesRef.value!.markExpired(err.data.expired_temp_ids);
      } else if (err?.message) {
        // 业务校验未过：staging 保留，用户改字段重提复用（不重新上传）
        Message({ theme: 'error', message: err.message });
      }
    } finally {
      isLoading.value = false;
    }
  };

  const handleCancel = () => {
    // 取消 / 关闭：清理所有 staging
    versionFilesRef.value?.cleanupAll();
    isShow.value = false;
    // ...existing reset...
  };

  const handleBeforeClose = () => leaveConfirm();
</script>
```

> **关键点**：`disabled-confirm` 绑定 `versionFilesRef?.submitDisabledReason`，复用 `DbSideslider` 内置的置灰 + tooltip 机制（见 `src/components/db-sideslider/index.vue` 的 `submitButtonDisabledInfo` computed）。

### 2.2 子组件（version-files/Index.vue）

```vue
<template>
  <div class="version-files-table-container">
    <table class="version-files-table">
      <thead>
        <tr>
          <th>{{ t('文件') }}</th>
          <th>OS</th>
          <th>{{ t('OS版本') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <VersionRow
          v-for="(item, index) in tableData"
          :key="item.rowKey"
          :data="item"
          @delete="() => handleDeleteRow(index)" />
      </tbody>
    </table>
    <!-- 用 DbUpload 替代原 UploadFile -->
    <DbUpload
      ref="uploadRef"
      :accept="acceptInfo.accept"
      :cleanup-handler="handleCleanup"
      :disabled="!version"
      :duplicate-checker="handleDuplicateCheck"
      multiple
      :scene="'version_package'"
      :staging-upload-handler="handleStagingUpload"
      :tip="acceptInfo.tips"
      @staged="handleFileStaged"
      @duplicate-rejected="handleDuplicateRejected" />
  </div>
</template>

<script setup lang="ts">
  import DbUpload, { type StagingFileRef, type StagingUploadOptions, type UploadFile } from '@components/db-upload';
  import { cleanupStagingFiles, uploadStagingFile } from '@services/source/storage';

  const uploadRef = ref<InstanceType<typeof DbUpload>>();
  const tableData = ref<Array<{ rowKey: string; tempId?: string; name: string; md5?: string; path?: string; size: number; expired?: boolean; versions?: string[] }>>([]);

  /** staging 上传处理 */
  const handleStagingUpload = (options: StagingUploadOptions) => {
    // 模拟进度（真实场景由 XHR upload progress 驱动）
    uploadStagingFile({ file: options.file, scene: 'version_package' })
      .then((result) => {
        options.onProgress(100, result.size);
        options.onSuccess(result);
      })
      .catch((err: any) => {
        options.onError(err?.message || '');
      });
    // 注：如需真实进度，用 XHR upload.addEventListener('progress')，参考现有 UploadFile.vue 的 handleCustomRequest
  };

  /** 同表重名检查 */
  const handleDuplicateCheck = (file: File, fileList: UploadFile[]) => {
    const existing = tableData.value.map((item) => item.name);
    const lower = file.name.toLowerCase();
    return existing.some((name) => name.toLowerCase() === lower);
  };

  /** 单文件暂存完成 → 加入子表 */
  const handleFileStaged = (file: UploadFile, ref: StagingFileRef) => {
    tableData.value.push({
      rowKey: random(),
      tempId: ref.tempId,
      name: ref.name,
      md5: ref.md5,
      path: ref.path,
      size: ref.size,
    });
  };

  /** 清理处理 */
  const handleCleanup = async (tempIds: string[]) => {
    await cleanupStagingFiles({ temp_ids: tempIds });
  };

  const handleDeleteRow = (index: number) => {
    const item = tableData.value[index];
    // 清理该行 staging
    if (item.tempId) uploadRef.value?.cleanupOne(item.tempId);
    tableData.value.splice(index, 1);
  };

  /** 标记过期行（commit 失败时父组件调） */
  const markExpired = (expiredTempIds: string[]) => {
    tableData.value.forEach((item) => {
      if (item.tempId && expiredTempIds.includes(item.tempId)) {
        item.expired = true;
      }
    });
  };

  defineExpose({
    getStagingRefs: () => uploadRef.value?.getStagingRefs() ?? [],
    submitDisabledReason: computed(() => uploadRef.value?.submitDisabledReason ?? ''),
    cleanupAll: () => uploadRef.value?.cleanupAll(),
    cleanupOne: (tempId: string) => uploadRef.value?.cleanupOne(tempId),
    markExpired,
    getValue: () => tableData.value.map((item) => ({ /* OS 适配信息 */ })),
  });
</script>
```

## 3. 提交传参模式

### 3.1 方案 A（推荐）：commit 独立接口

```ts
// 表单 submit
const stagingRefs = dbUploadRef.value!.getStagingRefs();
const result = await commitStagingFiles({
  temp_ids: stagingRefs.map((r) => r.tempId),
  scene: 'version_package',
  metadata: { ...formModel, packages: versionFilesRef.value!.getValue() },
});
// result.id 为业务实体 ID，result.file_paths 为正式区路径
```

### 3.2 方案 B：commit 内嵌 createTicket

若后端采用方案 B（`createTicket` 内嵌 commit），则表单 submit 直接调 `createTicket`，`details` 里传 `temp_ids`：

```ts
await createTicket({
  bk_biz_id: currentBizId,
  ticket_type: TicketTypes.XXX,
  details: {
    ...otherFields,
    temp_ids: stagingRefs.map((r) => r.tempId),  // 后端在单据事务内 commit
  },
});
```

> ⚠️ **待后端确认采用方案 A 还是 B**。skill 示例以 A 为主，B 仅需把 `commitStagingFiles` 调用替换为 `createTicket` 并在 `details` 加 `temp_ids`。

### 3.3 commit 业务校验未过：staging 保留复用

```ts
try {
  await commitStagingFiles(params);
} catch (err: any) {
  if (err?.code === 40901) {
    // 过期：定位失效行，用户重新上传该行
    handleExpired(err.data.expired_temp_ids);
  } else {
    // 业务校验未过（如版本号重复）：staging 保留，用户改字段重提
    // 不清理 staging，不重置上传状态
    Message({ theme: 'error', message: err.message });
  }
}
```

> **关键**：业务校验未过时**不要**调 `cleanupAll`，staging 文件保留，用户修改字段后再次 submit 复用同一批 temp_id。

## 4. 取消 / 关闭清理

### 4.1 DbSideslider 场景

```vue
<DbSideslider
  v-model:is-show="isShow"
  :before-close="handleBeforeClose"
  @closed="handleClosed">
  <!-- ... -->
</DbSideslider>
```

```ts
const handleClosed = () => {
  // 弹窗完全关闭后清理 staging（最佳努力）
  dbUploadRef.value?.cleanupAll();
};

const handleBeforeClose = () => {
  // 复用现有 leaveConfirm（有未保存变更时二次确认）
  return leaveConfirm();
};
```

> **注意**：`@closed` 是弹窗关闭动画结束后触发，此时清理不会阻塞关闭动画。`before-close` 仅做离开确认，不在此清理（用户可能取消关闭）。

### 4.2 BkDialog 场景

```vue
<BkDialog v-model:is-show="isShow" @closed="handleClosed">
  <!-- ... -->
</BkDialog>
```

```ts
const handleClosed = () => {
  dbUploadRef.value?.cleanupAll();
};
```

### 4.3 组件销毁场景（v-if / 路由切换）

```ts
onBeforeUnmount(() => {
  // 组件销毁时最佳努力清理
  dbUploadRef.value?.cleanupAll();
});
```

> 浏览器刷新 / 崩溃 / Tab 关闭时前端无机会清理，依赖后端兜底 24h 自动清理。

## 5. 过期处理

### 5.1 commit 时检测过期

后端 commit 返回 `code === 40901` + `data.expired_temp_ids`：

```ts
const expiredBannerVisible = ref(false);

const handleExpired = (expiredTempIds: string[]) => {
  expiredBannerVisible.value = true;
  // 标记失效行
  dbUploadRef.value?.markExpired(expiredTempIds);
};
```

### 5.2 UI 呈现

| 位置 | 文案 |
|------|------|
| 表单顶部 banner | `部分文件已过期，请重新上传` |
| 失效行的行级失败标签 | `该文件已过期，请重新上传` |

```vue
<BkAlert v-if="expiredBannerVisible" theme="error" :title="t('部分文件已过期，请重新上传')" />
```

### 5.3 用户重新上传失效行

失效行标记为 `expired` 后，用户对该行点「替换」或「删除后重新上传」，上传成功后 `expired` 标记清除，可再次提交。

> **组件支持**：`UploadFile.expired` 字段，UI 呈现红色「该文件已过期，请重新上传」标签。`markExpired(tempIds)` 方法由组件暴露，父组件调 commit 失败时传入。

## 6. 重名规则

### 6.1 传 duplicateChecker

```ts
const handleDuplicateCheck = (file: File, fileList: UploadFile[]) => {
  // 同表内重名（不区分大小写）
  const lower = file.name.toLowerCase();
  const inTable = tableData.value.some((item) => item.name.toLowerCase() === lower);
  const inUploadList = fileList.some((f) => f.name.toLowerCase() === lower);
  return inTable || inUploadList;
};
```

### 6.2 拦截效果

- 选择重名文件时**立即拦截**，不进入子表占位行
- 按钮下方红字提示 4-5s 自动消失：`已存在同名文件「xxx」，如需覆盖请用「替换」操作`
- 多选时多个重名：`已忽略 N 个同名文件：「a」、「b」`
- 下次点击上传按钮时清除提示

### 6.3 业务侧自定义规则

`duplicateChecker` 可由业务侧定义更复杂规则（如不仅按文件名，还按 OS 适配维度判断冲突）。返回 `true` 拦截单个，返回 `string[]` 拦截多个。

## 7. 与 DbSideslider 提交置灰联动

`DbSideslider`（`src/components/db-sideslider/index.vue`）已内置置灰 + tooltip 机制：

```ts
// db-sideslider 内部
const submitButtonDisabledInfo = computed(() => {
  if (_.isString(props.disabledConfirm)) {
    info.disabled = true;
    info.tooltips.disabled = false;
    info.tooltips.content = props.disabledConfirm;
    return info;
  }
  info.disabled = !!props.disabledConfirm;
  return info;
});
```

**接入方式**：把 `dbUploadRef.submitDisabledReason`（空字符串表示可提交）绑定到 `disabled-confirm`：

```vue
<DbSideslider
  :disabled-confirm="dbUploadRef?.submitDisabledReason || otherDisabledReason">
```

- `submitDisabledReason` 为 `'请等待文件上传完成'` → 提交按钮置灰 + hover 显示该文案
- `submitDisabledReason` 为 `''` → 不置灰（除非 `otherDisabledReason` 非空）

> **多个禁用原因合并**：用 `||` 短路，优先级由各原因自身决定。上传相关的优先级已在组件内按「上传中 > 失败 > 无成功」处理。

## 8. 多文件并行上传

- 组件 `multiple` 开启原生多选，一次选 N 个 → 一次新增 N 行 + 各自独立上传
- 每行独立状态机，单行失败不影响其他行
- 并发上限由浏览器 / 网关默认能力决定，本规范不强制
- 全部到 staged/success 才允许提交（`isReadyToCommit` 自动判断）

## 9. 接入自检清单

- [ ] 传入 `stagingUploadHandler`，内部调 `uploadStagingFile`
- [ ] 传入 `cleanupHandler`，内部调 `cleanupStagingFiles`
- [ ] 传入 `duplicateChecker`（如业务有同表重名规则）
- [ ] 表单 submit 调 `getStagingRefs()` 收集 temp_id → `commitStagingFiles`
- [ ] commit 业务校验未过时不清理 staging（保留复用）
- [ ] 取消 / 关闭弹窗调 `cleanupAll()`
- [ ] commit 过期（code 40901）显示 banner + 标记失效行
- [ ] `disabled-confirm` 绑定 `submitDisabledReason`
- [ ] i18n 文案已添加（参考 [i18n 文案清单](./i18n-checklist.md)）
