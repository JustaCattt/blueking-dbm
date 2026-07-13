# 迁移指南

> 本文档指导现有使用 `DbUpload` / `BkUpload` 的场景迁移到新 staging 规范。**迁移非强制**，旧用法保持可用（向后兼容）。仅当业务需要「暂存 + 提交」语义时迁移。

## 1. 待迁移场景清单

经代码库调研，以下场景使用了文件上传，可按需迁移：

| 场景 | 文件 | 当前实现 | 是否迁移 |
|------|------|---------|---------|
| 版本包上传 | `src/views/version-files/v2/.../edit-version/` + `version-files/Index.vue` + `UploadFile.vue` | `BkUpload` + `customRequest` + bkrepo token | ✅ 主迁移（demo 对应物） |
| MySQL 分区 Excel 导入 | `src/views/db-manage/mysql/partition-manage/components/excel-import/components/ImportUpload.vue` | `DbUpload` + `customRequest` 前端 XLSX 解析 | ✅ 迁移（前端解析 → staging） |
| TendbCluster 分区 Excel 导入 | `src/views/db-manage/tendb-cluster/partition-manage/components/excel-import/components/ImportUpload.vue` | 同上 | ✅ 迁移 |
| Excel 授权导入 | `src/views/db-manage/common/ExcelAuthorize.vue` | `BkUpload` + `handleUploadResponse` 存后端字段 | ⚠️ 已接近 staging，可选迁移 |

> 其余使用 `BkUpload` 的场景（如导入导出）若无需 staging 语义，保持现状即可。

---

## 2. 迁移一：version-files 编辑版本（主迁移）

### 2.1 现状

- `UploadFile.vue`：`BkUpload` + `customRequest`（XHR）→ `createBkrepoAccessToken` 获取 token → PUT bkrepo → 返回 `{md5, name, path, size}`
- `version-files/Index.vue`：原生 `<table>` 子表，持有文件信息，重复名称检查（`uploadedFileNames.includes` + `duplicateFileName` 红字）
- 父 `edit-version/Index.vue`：提交时用子表数据调 `updateDbVersion` / `createDbVersion`

### 2.2 迁移目标

- `UploadFile.vue` → 用 `DbUpload` 替代 `BkUpload`，传 `stagingUploadHandler`（复用 `createBkrepoAccessToken` 逻辑）
- `version-files/Index.vue` → 用 `DbUpload` 的 `duplicateChecker` 替代手写重名检查
- `edit-version/Index.vue` → 提交时 `getStagingRefs()` 收集 temp_id → `commitStagingFiles`
- 新增：进度条、3 态、重试、清理、禁用联动、过期处理

### 2.3 修改前检查清单

- [ ] 确认 `UploadFile.vue` 的 `handleCustomRequest` 完整逻辑（token 获取、PUT、进度、错误）
- [ ] 确认 `version-files/Index.vue` 的 `uploadedFileNames` / `duplicateFileName` 重名检查逻辑
- [ ] 确认 `edit-version/Index.vue` 提交时如何使用子表数据（`packages` 字段结构）
- [ ] 确认后端 `commitStagingFiles` 接口已就绪（方案 A）或 `createDbVersion` 已支持 `temp_ids`（方案 B）

### 2.4 迁移步骤

#### 步骤 1：UploadFile.vue → 改用 DbUpload

```vue
<!-- 修改前 -->
<BkUpload
  :accept="acceptInfo.accept"
  :custom-request="handleCustomRequest"
  :limit="1"
  multiple
  :tip="acceptInfo.tips"
  :url="''"
  @change="handleChange"
  @delete="handleDelete"
  @error="handleError"
  @success="handleSuccess" />

<!-- 修改后 -->
<DbUpload
  ref="uploadRef"
  :accept="acceptInfo.accept"
  :cleanup-handler="handleCleanup"
  :duplicate-checker="handleDuplicateCheck"
  multiple
  :scene="'version_package'"
  :staging-upload-handler="handleStagingUpload"
  :tip="acceptInfo.tips"
  @staged="handleFileStaged"
  @duplicate-rejected="handleDuplicateRejected" />
```

```ts
// 修改前：handleCustomRequest（XHR + bkrepo token）
const handleCustomRequest = (options) => {
  createBkrepoAccessToken({ file_path: options.file.name }).then((tokenRes) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', tokenRes.url);
    xhr.setRequestHeader('X-Bkrepo-Token', tokenRes.token);
    xhr.upload.addEventListener('progress', (e) => {
      options.onProgress({ percent: (e.loaded / e.total) * 100 });
    });
    // ...onload / onerror...
  });
};

// 修改后：handleStagingUpload（复用 bkrepo token 逻辑，包装为 staging 语义）
const handleStagingUpload = (options: StagingUploadOptions) => {
  createBkrepoAccessToken({ file_path: options.file.name })
    .then((tokenRes) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', tokenRes.url);
      xhr.setRequestHeader('X-Bkrepo-Token', tokenRes.token);
      xhr.upload.addEventListener('progress', (e) => {
        const percentage = (e.loaded / e.total) * 100;
        options.onProgress(percentage, e.loaded);
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 包装为 staging 响应格式
          options.onSuccess({
            temp_id: tokenRes.path,  // bkrepo path 作为 temp_id（过渡）
            name: options.file.name,
            path: tokenRes.path,
            md5: xhr.getResponseHeader('X-Bkrepo-MD5') || undefined,
            size: options.file.size,
          });
        } else {
          options.onError(t('上传失败，请重试'));
        }
      };
      xhr.onerror = () => options.onError(t('上传失败，请重试'));
      xhr.send(options.file);
    })
    .catch((err) => options.onError(err?.message || ''));
};
```

> **过渡策略**：后端 `uploadStagingFile` 未就绪时，可先用 bkrepo path 作为 `temp_id`，待后端 staging 接口就绪后切换为真实 temp_id。

#### 步骤 2：version-files/Index.vue → 用 duplicateChecker

```ts
// 修改前：手写重名检查
const uploadedFileNames = computed(() => tableData.value.map((item) => item.name));
const duplicateFileName = ref('');
const handleChange = (fileList) => {
  const lastFile = fileList[fileList.length - 1];
  if (uploadedFileNames.value.includes(lastFile.name)) {
    duplicateFileName.value = lastFile.name;
    // 移除该文件
    return;
  }
  // ...加入子表...
};

// 修改后：传 duplicateChecker，组件自动拦截 + 提示
const handleDuplicateCheck = (file: File, fileList: UploadFile[]) => {
  const lower = file.name.toLowerCase();
  return tableData.value.some((item) => item.name.toLowerCase() === lower);
};
// 移除 duplicateFileName ref 与相关模板
```

#### 步骤 3：edit-version/Index.vue → 提交传 temp_id

```ts
// 修改前
const handleConfirm = async () => {
  const packages = versionFilesRef.value!.getValue();  // 含 path/md5/size
  if (isEdit) {
    await updateDbVersion({ id, ...formModel, packages });
  } else {
    await createDbVersion({ ...formModel, packages });
  }
};

// 修改后（方案 A）
const handleConfirm = async () => {
  const stagingRefs = versionFilesRef.value!.getStagingRefs();
  const result = await commitStagingFiles({
    temp_ids: stagingRefs.map((r) => r.tempId),
    scene: 'version_package',
    metadata: { ...formModel, packages: versionFilesRef.value!.getValue() },
  });
};

// 修改后（方案 B：createDbVersion 内嵌 commit）
const handleConfirm = async () => {
  const stagingRefs = versionFilesRef.value!.getStagingRefs();
  if (isEdit) {
    await updateDbVersion({ id, ...formModel, temp_ids: stagingRefs.map((r) => r.tempId) });
  } else {
    await createDbVersion({ ...formModel, temp_ids: stagingRefs.map((r) => r.tempId) });
  }
};
```

#### 步骤 4：新增清理 / 禁用联动 / 过期

参考 [integration-guide.md](./integration-guide.md) 第 2、4、5、7 节。

### 2.5 修改后检查清单

- [ ] `DbUpload` 替代 `BkUpload`，传 `stagingUploadHandler` / `duplicateChecker` / `cleanupHandler`
- [ ] `handleStagingUpload` 复用原 bkrepo token 逻辑，包装为 staging 响应
- [ ] 重名检查改用 `duplicateChecker`，移除手写 `duplicateFileName`
- [ ] 提交时 `getStagingRefs()` 收集 temp_id
- [ ] 取消 / 关闭调 `cleanupAll()`
- [ ] `disabled-confirm` 绑定 `submitDisabledReason`
- [ ] commit 过期（40901）显示 banner + 标记失效行
- [ ] 进度条 / 3 态 / 重试 / 替换 由 `DbUpload` 自动提供
- [ ] i18n 文案已添加

---

## 3. 迁移二：MySQL / TendbCluster 分区 Excel 导入

### 3.1 现状

- `ImportUpload.vue`：`DbUpload` + `customRequest` → 前端 XLSX 解析（`XLSX.read`）→ 触发 `file-ready` / `file-removed` / `uploading` 事件
- 父 `excel-import/Index.vue`：持有 `File`，提交时调 `importFromExcel(file)`（`src/services/source/partitionManage.ts`，FormData POST）
- `limit=1`，单文件

### 3.2 迁移目标

- `ImportUpload.vue` → `customRequest` 前端解析改为 `stagingUploadHandler` 上传到 staging
- 父 `excel-import/Index.vue` → 提交时传 `temp_id` 而非 `File`
- `importFromExcel` 服务函数 → 改为传 `temp_id`

### 3.3 修改前检查清单

- [ ] 确认 `ImportUpload.vue` 的 `customRequest` 前端解析逻辑（XLSX.read + 校验）
- [ ] 确认父组件如何使用 `File`（`importFromExcel(file)` 调用点）
- [ ] 确认 `importFromExcel` 服务函数签名（`src/services/source/partitionManage.ts`）
- [ ] 确认后端 `import_from_excel` 接口已支持 `temp_id` 参数（或新增 `import_from_staging` 接口）

### 3.4 迁移步骤

#### 步骤 1：ImportUpload.vue → staging 上传

```ts
// 修改前：customRequest 前端解析
const customRequest = (options) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target!.result);
    const workbook = XLSX.read(data, { type: 'array' });
    // 校验...
    emit('file-ready', options.file);
  };
  reader.readAsArrayBuffer(options.file);
};

// 修改后：staging 上传（保留前端预校验）
const handleStagingUpload = (options: StagingUploadOptions) => {
  // 可选：先前端预校验（XLSX 格式 / 表头）
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target!.result);
      const workbook = XLSX.read(data, { type: 'array' });
      // 前端预校验...
      // 校验通过 → 上传 staging
      const result = await uploadStagingFile({
        file: options.file,
        scene: 'partition_excel',
      });
      options.onSuccess(result);
    } catch (err: any) {
      options.onError(err?.message || t('文件格式错误'));
    }
  };
  reader.readAsArrayBuffer(options.file);
};
```

> **保留前端预校验**：Excel 格式 / 表头校验仍在前端做，校验通过后再上传 staging，避免无效文件占用 staging 区。

#### 步骤 2：父 excel-import/Index.vue → 传 temp_id

```ts
// 修改前
const handleConfirm = async () => {
  if (!currentFile) return;
  await importFromExcel(currentFile);
};

// 修改后
const handleConfirm = async () => {
  const stagingRefs = importUploadRef.value!.getStagingRefs();
  if (stagingRefs.length === 0) return;
  await importFromExcel(stagingRefs[0].tempId);  // 单文件
};
```

#### 步骤 3：importFromExcel 服务函数 → 传 temp_id

```ts
// 修改前（src/services/source/partitionManage.ts）
export const importFromExcel = (file: Blob) =>
  http.post(`/apis/partition/import_from_excel/`, (() => {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  })());

// 修改后
export const importFromExcel = (tempId: string) =>
  http.post(`/apis/partition/import_from_excel/`, { temp_id: tempId });
```

> **后端配合**：`import_from_excel` 接口需改为接收 `temp_id`，从 staging 区取文件解析。或新增 `import_from_staging` 接口。

### 3.5 修改后检查清单

- [ ] `customRequest` 改为 `stagingUploadHandler`，保留前端预校验
- [ ] 父组件提交传 `temp_id` 而非 `File`
- [ ] `importFromExcel` 服务函数改为传 `temp_id`
- [ ] 取消 / 关闭调 `cleanupAll()`
- [ ] `disabled-confirm` 联动（如有 DbSideslider）
- [ ] i18n 文案已添加

---

## 4. 迁移三：ExcelAuthorize（可选）

### 4.1 现状

- `ExcelAuthorize.vue`：`BkUpload` + `handleUploadResponse` 存后端字段（`excel_url`, `authorize_uid`, `authorize_data_list`）
- `handleConfirmImport` 稍后调 `createTicket`

### 4.2 迁移判断

此场景**已接近 staging 模式**（上传后存引用，稍后提交）。是否迁移取决于：

- 是否需要进度条 / 3 态 / 重试 / 清理（当前 `BkUpload` 可能已够用）
- 是否需要与 `DbSideslider` 禁用联动

若仅需上述增强，可迁移；否则保持现状。

### 4.3 迁移步骤（如需）

参考迁移一（version-files）的步骤 1-4，将 `BkUpload` 替换为 `DbUpload`，`handleUploadResponse` 改为 `stagingUploadHandler` 的 `onSuccess`，`handleConfirmImport` 改为传 `temp_id`。

---

## 5. 通用迁移注意事项

### 5.1 向后兼容

- 未迁移场景保持旧 Props（`url` / `customRequest`）即可正常工作
- 不要全局替换 `BkUpload` 为 `DbUpload`，按场景逐步迁移
- `DbUpload` 改造后旧用法（`url` + `customRequest`）仍可用

### 5.2 服务函数新增

迁移需在 `src/services/source/storage.ts` 新增（参考 [interface-contract.md](./interface-contract.md)）：

- `uploadStagingFile`
- `commitStagingFiles`
- `cleanupStagingFiles`
- `queryStagingResume`（断点续传时）

### 5.3 i18n

迁移需添加新文案，参考 [i18n-checklist.md](./i18n-checklist.md)。

### 5.4 测试

- 迁移后需验证：上传 / 进度 / 失败重试 / 替换 / 删除 / 提交 / 取消清理 / 过期处理
- 参考 `cypress/` 现有组件测试模式补充用例
