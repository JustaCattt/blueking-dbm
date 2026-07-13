# 断点续传指南

> 本文档指导 GB 级大文件的断点续传实现。**断点续传为可选增强**，默认关闭（`resumeable=false`），仅在确有大文件场景时启用。本规范提供前端实现思路，后端接口契约见 [interface-contract.md](./interface-contract.md) 的 `queryStagingResume`。

## 1. 适用场景

- 单文件 > 100MB，网络不稳定
- 用户可能中途关闭弹窗 / 切换页面后回来继续
- 跨会话识别同一文件（重命名后仍能识别）

> 小文件（< 100MB）无需断点续传，从头上传即可，避免指纹计算开销。

## 2. 核心思路

```
1. 选文件 → 计算内容指纹（fingerprint，与文件名无关）
2. 上传前用 fingerprint 查询 staging 区已传字节（queryStagingResume）
3. 已传字节 > 0 → 从 offset 续传（HTTP Range / 自定义分片）
4. 进度从断点推进（percentage = uploadedBytes / size * 100）
5. 上传完成 → 服务端返回 temp_id（同普通上传）
```

## 3. 内容指纹计算

### 3.1 方案 A：SHA-256 全文件（精确，慢）

```ts
import type { FingerprintFn } from '@components/db-upload';

const computeFingerprint: FingerprintFn = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};
```

> **缺点**：需把整个文件读入内存，GB 级文件会卡顿 / OOM。仅适用于 < 500MB 文件。

### 3.2 方案 B：分块 SHA-256（推荐，流式）

```ts
const computeFingerprint: FingerprintFn = async (file: File): Promise<string> => {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const hashes: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hashes.push(hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''));
    // 可选：yield 让出主线程，避免阻塞 UI
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  // 最终指纹 = 各块哈希拼接后再哈希
  const finalBuffer = new TextEncoder().encode(hashes.join(''));
  const finalHash = await crypto.subtle.digest('SHA-256', finalBuffer);
  return Array.from(new Uint8Array(finalHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};
```

> **优点**：流式处理，内存占用恒定（4MB）。GB 级文件可承受。

### 3.3 方案 C：头尾哈希（最快，有碰撞风险）

```ts
const computeFingerprint: FingerprintFn = async (file: File): Promise<string> => {
  const HEAD_SIZE = 1024 * 1024; // 1MB
  const TAIL_SIZE = 1024 * 1024; // 1MB
  const head = file.slice(0, Math.min(HEAD_SIZE, file.size));
  const tail = file.slice(Math.max(0, file.size - TAIL_SIZE));
  const [headBuf, tailBuf] = await Promise.all([head.arrayBuffer(), tail.arrayBuffer()]);
  const [headHash, tailHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', headBuf),
    crypto.subtle.digest('SHA-256', tailBuf),
  ]);
  const toHex = (buf: ArrayBuffer) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${file.size}:${toHex(headHash)}:${toHex(tailHash)}`;
};
```

> **优点**：极快。**缺点**：中间内容不同但头尾相同的文件会碰撞。适用于「同一文件大概率完整相同」的场景，不适用于「文件可能局部修改」。

### 3.4 推荐选择

| 文件大小 | 推荐方案 |
|---------|---------|
| < 100MB | 不启用断点续传 |
| 100MB - 500MB | 方案 A（全文件 SHA-256） |
| 500MB - 2GB | 方案 B（分块 SHA-256） |
| > 2GB | 方案 B（分块 SHA-256）+ 进度提示 |

## 4. 查询断点

上传前用 fingerprint 查询 staging 区已传字节：

```ts
import { queryStagingResume } from '@services/source/storage';

const handleStagingUpload = async (options: StagingUploadOptions) => {
  let resumeOffset = 0;

  if (options.fingerprint) {
    try {
      const result = await queryStagingResume({
        fingerprint: options.fingerprint,
        scene: 'version_package',
      });
      if (result.found && result.uploaded_bytes > 0) {
        resumeOffset = result.uploaded_bytes;
        // 进度从断点推进
        options.onProgress((resumeOffset / options.file.size) * 100, resumeOffset);
      }
    } catch {
      // 查询失败，按从头上传
    }
  }

  // 调用上传（带 resumeOffset）
  await uploadStagingFile({
    file: options.file,
    scene: 'version_package',
    fingerprint: options.fingerprint,
    resume_offset: resumeOffset,
    onProgress: options.onProgress,
  })
    .then(options.onSuccess)
    .catch((err) => options.onError(err?.message || ''));
};
```

## 5. 从偏移量续传

### 5.1 HTTP Range（后端支持时）

```ts
const uploadStagingFile = (params) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/apis/staging/upload/');
  xhr.setRequestHeader('X-Resume-Offset', String(params.resume_offset || 0));
  if (params.fingerprint) xhr.setRequestHeader('X-Fingerprint', params.fingerprint);

  xhr.upload.addEventListener('progress', (e) => {
    // e.loaded 是本次上传已传字节，需加上 resume_offset
    const totalUploaded = (params.resume_offset || 0) + e.loaded;
    const percentage = (totalUploaded / params.file.size) * 100;
    params.onProgress(percentage, totalUploaded);
  });

  // ...onload / onerror...
};
```

### 5.2 分片上传（后端不支持 Range 时）

```ts
const uploadStagingFile = async (params) => {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
  const startChunk = Math.floor((params.resume_offset || 0) / CHUNK_SIZE);
  const totalChunks = Math.ceil(params.file.size / CHUNK_SIZE);

  for (let i = startChunk; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, params.file.size);
    const chunk = params.file.slice(start, end);
    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('chunk_index', String(i));
    formData.append('total_chunks', String(totalChunks));
    formData.append('fingerprint', params.fingerprint || '');
    formData.append('scene', params.scene);

    await http.post('/apis/staging/upload_chunk/', formData);
    const uploadedBytes = end;
    params.onProgress((uploadedBytes / params.file.size) * 100, uploadedBytes);
  }

  // 通知后端合并
  const result = await http.post('/apis/staging/merge_chunks/', {
    fingerprint: params.fingerprint,
    total_chunks: totalChunks,
    scene: params.scene,
    name: params.file.name,
  });
  return result;
};
```

## 6. 进度从断点推进

组件 `UploadFile.uploadedBytes` 字段记录已传字节，重试时保留：

```ts
// 组件内 handleRetry
const handleRetry = (file: UploadFile) => {
  if (props.resumeable) {
    // 保留 uploadedBytes，重试从断点继续
    updateFile(file.uid, {
      percentage: (file.uploadedBytes / file.size) * 100,
      status: UploadStatus.UPLOADING,
    });
  } else {
    // 非续传：重置进度
    updateFile(file.uid, { percentage: 0, uploadedBytes: 0, status: UploadStatus.UPLOADING });
  }
  validateAndUpload(file.raw);
};
```

## 7. 跨会话 / 重命名识别

- **fingerprint 基于内容**，与文件名无关 → 重命名后仍能识别同一文件
- 用户关闭弹窗后重新打开，选同一文件 → fingerprint 相同 → 查询到已传字节 → 续传
- **限制**：浏览器关闭后 `File` 引用失效，需用户重新选文件（无法自动恢复）。指纹仅用于「用户重选同一文件时」加速

## 8. UI 提示

断点续传场景建议在指纹计算 / 查询断点时显示提示：

```vue
<template v-if="file.status === UploadStatus.UPLOADING && file.resumeStatus">
  <span class="db-upload-list-item-resume-tip">
    {{ t('从断点续传') }}（{{ formatFileSize(file.uploadedBytes) }} / {{ formatFileSize(file.size) }}）
  </span>
</template>
```

> 可选增强，非规范强制。

## 9. 注意事项

- **指纹计算耗时**：GB 级文件指纹计算可能数秒，建议显示「正在校验文件...」提示
- **Web Crypto API**：`crypto.subtle` 仅在 HTTPS / localhost 可用，HTTP 环境需 polyfill
- **内存**：方案 A 全文件读入内存，GB 级慎用
- **后端配合**：`queryStagingResume` 与分片 / Range 上传需后端支持，接口契约见 [interface-contract.md](./interface-contract.md)
- **过期**：staging 区 24h 过期，断点也随 staging 一起过期，过期后从头上传

## 10. 启用清单

- [ ] 后端确认支持 `queryStagingResume` + Range / 分片上传
- [ ] 前端实现 `getFingerprint`（按文件大小选方案 A/B/C）
- [ ] `DbUpload` 传 `resumeable` + `getFingerprint`
- [ ] `stagingUploadHandler` 内部先查断点再上传
- [ ] 重试保留 `uploadedBytes`（组件已处理）
- [ ] 大文件场景 UI 提示「正在校验文件...」/「从断点续传」
