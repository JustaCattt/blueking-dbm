# 后端接口契约：staging 暂存 + commit

> ⚠️ **本文档中的接口路径、请求/响应字段均为推荐约定，待后端确认。** 前端实现时先按此契约编写服务函数，接口未就绪时用 mock 数据；后端确认后对齐字段名与路径。
>
> 现有 `src/services/source/storage.ts` 已有 `createBkrepoAccessToken`（bkrepo 临时凭证）等函数，staging 相关函数建议新增于同文件，保持服务模块聚合。

## 通用约定

- 所有接口走 `src/services/http/index.ts` 的 `http` 客户端，返回已解包的 `Promise<T>`（即 `data` 字段内容）
- 响应体遵循 `BaseResponse<T>`（`src/services/types/common.ts`）：`{ code, data, message, request_id }`，`code === 0` 表示成功
- CSRF：`X-CSRFToken` 取 `Cookies.get('dbm_csrftoken')`（参考 `ExcelAuthorize.vue` / `UploadFile.vue` 现有写法）
- 业务 ID：涉及业务的接口需带 `bk_biz_id`（取 `useGlobalBizs().currentBizId`，参考 `partitionManage.ts`）

## 1. staging 上传

**用途**：接收用户选择的文件，存入 staging 区，返回引用凭证供后续 commit / 清理引用。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 推荐路径 | `/apis/core/storage/staging/upload/` |
| Content-Type | `multipart/form-data` |
| ⚠️ 待确认 | 路径、是否复用 bkrepo token 模式、字段名 |

### 请求

FormData 字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | `File` | 是 | 文件二进制 |
| `bk_biz_id` | `number` | 否 | 业务 ID（按需） |
| `fingerprint` | `string` | 否 | 内容指纹（断点续传时传，用于服务端识别已传部分） |
| `scene` | `string` | 否 | 业务场景标识（如 `version_package` / `sql_file`），便于后端分目录 / 配额 |

### 响应 `data`

```ts
interface StagingUploadResult {
  /** staging 引用凭证，后续 commit / cleanup 引用 */
  temp_id: string;
  /** 文件名 */
  name: string;
  /** staging 区相对路径（可选，调试 / 日志用） */
  path?: string;
  /** 文件 MD5（服务端计算，commit 时回传校验完整性） */
  md5?: string;
  /** 文件大小（字节） */
  size: number;
  /** staging 过期时间（ISO 字符串），前端可用于提前提示 */
  expire_at?: string;
}
```

### 服务函数示例（`src/services/source/storage.ts`）

```ts
const stagingPath = '/apis/core/storage/staging';

/**
 * 上传文件到 staging 区
 * ⚠️ 待后端确认路径与字段
 */
export function uploadStagingFile(
  params: { file: File; bk_biz_id?: number; fingerprint?: string; scene?: string },
) {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.bk_biz_id !== undefined) formData.append('bk_biz_id', String(params.bk_biz_id));
  if (params.fingerprint) formData.append('fingerprint', params.fingerprint);
  if (params.scene) formData.append('scene', params.scene);
  return http.post<StagingUploadResult>(`${stagingPath}/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

### 与现有 bkrepo token 模式的关系

`version-files/UploadFile.vue` 现有模式：`createBkrepoAccessToken({ file_path })` → 拿 token → `PUT` 到 bkrepo。若后端 staging 接口复用 bkrepo，则 `uploadStagingFile` 内部仍调 `createBkrepoAccessToken` + 自定义 XHR，但对外暴露统一的 `stagingUploadHandler` 接口（见 [组件改造规范](./component-spec.md)）。**待后端确认是否统一走 staging 接口还是保留 bkrepo token 模式。**

## 2. commit（提交入正式区）

**用途**：表单提交时，事务内把 staging 文件移入正式区 + 落业务元数据。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 推荐路径 | `/apis/core/storage/staging/commit/` |
| ⚠️ 待确认 | 路径、是否与业务单据接口合并（如 `createTicket` 内嵌 commit） |

### 请求

```ts
interface StagingCommitParams {
  /** 本次提交的 staging temp_id 列表 */
  temp_ids: string[];
  /** 业务场景标识 */
  scene: string;
  /** 业务元数据（各业务自定义，如版本包的 name/version_series/phase 等） */
  metadata: Record<string, unknown>;
  /** 业务 ID（按需） */
  bk_biz_id?: number;
}
```

### 响应 `data`

```ts
interface StagingCommitResult {
  /** 业务实体 ID（如版本 ID / 单据 ID） */
  id: number;
  /** 已 commit 的正式区文件路径列表 */
  file_paths: string[];
}
```

### 失败语义（关键）

| 场景 | `code` | `message` | 前端处理 |
|------|--------|-----------|---------|
| 业务校验未过（如版本号重复） | 非 0 | 业务错误 message | **staging 文件保留**，用户改字段重提复用（不重新上传） |
| staging 文件已过期（被兜底清理） | 非 0（推荐特定 code，如 `40901`） | `部分文件已过期，请重新上传` | 阻止提交，定位失效行，行级标签「该文件已过期，请重新上传」 |
| staging 文件不存在（异常） | 非 0 | 同上 | 同上 |

> ⚠️ **待后端确认**：过期场景是否用独立 `code`，以便前端精确区分「业务校验未过」与「staging 过期」。推荐用独立 code（如 `40901`），响应 `data` 携带失效的 `temp_id` 列表：

```ts
interface StagingExpiredData {
  /** 已过期的 temp_id 列表，前端据此定位失效行 */
  expired_temp_ids: string[];
}
```

### 服务函数示例

```ts
/**
 * 提交 staging 文件到正式区
 * ⚠️ 待后端确认路径与字段
 */
export function commitStagingFiles(params: StagingCommitParams) {
  return http.post<StagingCommitResult>(`${stagingPath}/commit/`, params);
}
```

### 与业务单据接口的关系

DBM 多数表单提交走 `createTicket`（`src/services/source/ticket.ts`）。两种方案：
- **方案 A（推荐）**：commit 独立接口，业务表单先调 `commitStagingFiles` 拿正式区路径，再调 `createTicket` 携带路径
- **方案 B**：`createTicket` 内嵌 commit，`details` 里直接传 `temp_ids`，后端在单据事务内 commit

**待后端确认采用哪种。** skill 接入指南以方案 A 为主示例（职责清晰），方案 B 作为备选说明。

## 3. cleanup（清理 staging）

**用途**：用户取消 / 关闭弹窗 / 删除行 / 替换文件时，前端发请求立即删 staging。最佳努力，不强保证（失败不阻塞 UI）。

| 项 | 值 |
|----|----|
| 方法 | `POST`（推荐，支持批删）或 `DELETE` |
| 推荐路径 | `/apis/core/storage/staging/cleanup/` |
| ⚠️ 待确认 | 路径、单删与批删是否合并 |

### 请求

```ts
interface StagingCleanupParams {
  /** 要清理的 temp_id 列表（支持单个或多个） */
  temp_ids: string[];
}
```

### 响应 `data`

```ts
interface StagingCleanupResult {
  /** 成功清理的 temp_id 列表 */
  deleted_temp_ids: string[];
  /** 清理失败的 temp_id 列表（前端可忽略，后端兜底会清理） */
  failed_temp_ids?: string[];
}
```

### 服务函数示例

```ts
/**
 * 清理 staging 文件（单/批）
 * ⚠️ 待后端确认路径与字段
 */
export function cleanupStagingFiles(params: StagingCleanupParams) {
  return http.post<StagingCleanupResult>(`${stagingPath}/cleanup/`, params);
}
```

### 调用时机

| 时机 | 调用方 | temp_ids |
|------|--------|----------|
| 删除单行（staged） | 组件 `cleanupOne` | 该行 `tempId` |
| 替换文件（staged） | 组件 `cleanupOne` | 旧文件 `tempId`（再上传新文件） |
| 取消 / 关闭弹窗 | 父表单 `cleanupAll` | 所有 staged 行的 `tempId` |
| 上传中行删除 | 组件中断 XHR（无需 cleanup，staging 未生成） | — |

## 4. 断点续传（选做，GB 级建议启用）

> 完整实现指引见 [断点续传实现指引](./resume-upload.md)

### 4.1 查询已传字节

**用途**：上传前按内容指纹查询该文件已传到 staging 的字节数，决定从何处续传。

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 推荐路径 | `/apis/core/storage/staging/resume/` |
| ⚠️ 待确认 | 路径、是否按指纹还是按 temp_id 查询 |

### 请求（query）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fingerprint` | `string` | 是 | 内容指纹（与文件名无关） |
| `scene` | `string` | 否 | 业务场景 |

### 响应 `data`

```ts
interface StagingResumeResult {
  /** 已传字节数，0 表示从头传 */
  uploaded_bytes: number;
  /** 关联的 temp_id（续传成功后复用） */
  temp_id?: string;
  /** 文件总大小（校验用） */
  total_size?: number;
  /** staging 是否仍有效（过期则 uploaded_bytes 视为 0） */
  valid: boolean;
}
```

### 4.2 续传上传

**用途**：从指定 offset 续传文件剩余部分。

| 项 | 值 |
|----|----|
| 方法 | `PATCH`（推荐）或 `PUT`（带范围头） |
| 推荐路径 | `/apis/core/storage/staging/resume/` |
| Content-Type | `application/octet-stream` 或 `multipart/form-data` |
| ⚠️ 待确认 | 协议（PATCH body vs PUT + Content-Range 头） |

### 请求

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fingerprint` | `string` | 是 | 内容指纹 |
| `temp_id` | `string` | 是 | 查询返回的 temp_id |
| `offset` | `number` | 是 | 从第几字节开始传 |
| `chunk` | `Blob` | 是 | 文件剩余部分的 Blob（`file.slice(offset)`） |

### 服务函数示例

```ts
/**
 * 查询断点续传已传字节
 * ⚠️ 待后端确认路径与字段
 */
export function queryStagingResume(params: { fingerprint: string; scene?: string }) {
  return http.get<StagingResumeResult>(`${stagingPath}/resume/`, params);
}

/**
 * 断点续传上传
 * ⚠️ 待后端确认协议（PATCH body vs PUT + Content-Range）
 */
export function resumeStagingUpload(params: {
  fingerprint: string;
  temp_id: string;
  offset: number;
  chunk: Blob;
}) {
  const formData = new FormData();
  formData.append('fingerprint', params.fingerprint);
  formData.append('temp_id', params.temp_id);
  formData.append('offset', String(params.offset));
  formData.append('chunk', params.chunk);
  return http.patch<StagingUploadResult>(`${stagingPath}/resume/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

## 5. 后端兜底清理任务

- **触发**：定时任务（非前端调用）
- **规则**：超过 24h 未 commit 的 staging 自动物理清理
- **24h 为默认值**，业务侧可评估调整
- 前端无需感知，但 commit 时若检测到 staging 已被兜底清理，按 §2「过期」语义处理

## 接口未就绪时的 Mock 策略

前端开发阶段，服务函数可临时 mock，保证 UI 流程可联调：

```ts
// 开发期 mock（接口就绪后删除）
export function uploadStagingFile(params: { file: File }) {
  return new Promise<StagingUploadResult>((resolve) => {
    setTimeout(() => {
      resolve({
        temp_id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: params.file.name,
        size: params.file.size,
        md5: 'mock_md5',
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
    }, 800 + Math.random() * 1200);
  });
}
```

> 建议 mock 放在服务函数内用 `import.meta.env.MODE === 'development'` 守卫，或单独 `storage.mock.ts` 文件，避免污染生产代码。

## 待确认清单（汇总）

> 实施前与后端逐项确认，确认后更新本文档并移除 ⚠️ 标注。

- [ ] staging 上传路径与字段名（`temp_id` / `file` / `fingerprint` / `scene`）
- [ ] staging 上传是否复用 bkrepo token 模式，还是统一走 staging 接口
- [ ] commit 路径与字段名（`temp_ids` / `metadata` / `scene`）
- [ ] commit 采用方案 A（独立接口）还是方案 B（内嵌 createTicket）
- [ ] commit 过期场景是否用独立 `code`（推荐 `40901`）+ `data.expired_temp_ids`
- [ ] cleanup 路径、单删与批删是否合并、HTTP 方法
- [ ] 断点续传查询路径与字段（按指纹查询）
- [ ] 断点续传协议（PATCH body vs PUT + Content-Range）
- [ ] staging 兜底清理周期（默认 24h，业务侧是否需调整）
- [ ] staging 过期时间 `expire_at` 是否返回，前端是否需要提前提示
