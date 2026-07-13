# i18n 文案清单

> 本文档列出 db-upload 改造及业务接入需要新增 / 复用的 i18n 文案。语言文件：`src/locales/zh-cn.json`（中文键名 → 中文值）、`src/locales/en.json`（中文键名 → 英文值）。

## 1. 新增文案

以下文案为改造新增，需在 `zh-cn.json` 与 `en.json` 同步添加。

| 中文键名 | zh-cn 值 | en 值 | 用途 |
|---------|---------|-------|------|
| `上传中` | 上传中 | Uploading | uploading 态标签（如需） |
| `请等待文件上传完成` | 请等待文件上传完成 | Please wait for file upload to complete | submitDisabledReason：上传中 |
| `存在失败文件，请重试或删除` | 存在失败文件，请重试或删除 | Some files failed, please retry or remove | submitDisabledReason：有失败 |
| `请至少上传 1 个文件` | 请至少上传 1 个文件 | Please upload at least 1 file | submitDisabledReason：无文件 |
| `该文件已过期，请重新上传` | 该文件已过期，请重新上传 | This file has expired, please re-upload | 行级过期标签 |
| `部分文件已过期，请重新上传` | 部分文件已过期，请重新上传 | Some files have expired, please re-upload | 表单顶部 banner |
| `已存在同名文件「x」，如需覆盖请用「替换」操作` | 已存在同名文件「{x}」，如需覆盖请用「替换」操作 | Duplicate file name "{x}", use "Replace" to overwrite | 重名单文件提示 |
| `已忽略 n 个同名文件` | 已忽略 {n} 个同名文件 | Ignored {n} duplicate file(s) | 重名多文件提示 |
| `替换` | 替换 | Replace | 替换操作（tooltip / 按钮） |
| `重试` | 重试 | Retry | 重试操作（tooltip / 按钮） |
| `点击上传文件` | 点击上传文件 | Click to upload file | 上传按钮入口 |
| `支持多选` | 支持多选 | Multiple selection supported | 上传按钮提示 |
| `从断点续传` | 从断点续传 | Resuming from breakpoint | 断点续传提示（可选） |
| `正在校验文件...` | 正在校验文件... | Verifying file... | 指纹计算提示（可选） |
| `上传失败，请重试` | 上传失败，请重试 | Upload failed, please retry | 失败兜底文案 |

> **带 `{x}` / `{n}` 的为 vue-i18n 插值**，使用 `t('已忽略 n 个同名文件', { n: names.length })`。

## 2. 可复用现有文案

以下文案在现有 `zh-cn.json` / `en.json` 中已存在，可直接复用：

| 中文键名 | 用途 |
|---------|------|
| `上传成功` | staged / success 态标签 |
| `上传失败` | failed 态标签（如不用「上传失败，请重试」） |
| `将文件拖到此处或` | 拖拽区域（如保留拖拽） |
| `点击上传` | 拖拽区域按钮 |
| `文件` | 表头 / 列名 |
| `删除` | 删除操作 |
| `确定重试吗` | 重试二次确认（如需） |
| `失败重试` | 重试按钮（如需） |

> **复用前确认**：用 `grep_search` 在 `src/locales/zh-cn.json` 搜索上述键名确认存在。

## 3. 添加方式

### 3.1 直接在 JSON 文件添加

```jsonc
// src/locales/zh-cn.json
{
  // ...existing...
  "上传中": "上传中",
  "请等待文件上传完成": "请等待文件上传完成",
  "存在失败文件，请重试或删除": "存在失败文件，请重试或删除",
  "请至少上传 1 个文件": "请至少上传 1 个文件",
  "该文件已过期，请重新上传": "该文件已过期，请重新上传",
  "部分文件已过期，请重新上传": "部分文件已过期，请重新上传",
  "已存在同名文件「x」，如需覆盖请用「替换」操作": "已存在同名文件「{x}」，如需覆盖请用「替换」操作",
  "已忽略 n 个同名文件": "已忽略 {n} 个同名文件",
  "替换": "替换",
  "重试": "重试",
  "点击上传文件": "点击上传文件",
  "支持多选": "支持多选",
  "上传失败，请重试": "上传失败，请重试"
}
```

```jsonc
// src/locales/en.json
{
  // ...existing...
  "上传中": "Uploading",
  "请等待文件上传完成": "Please wait for file upload to complete",
  "存在失败文件，请重试或删除": "Some files failed, please retry or remove",
  "请至少上传 1 个文件": "Please upload at least 1 file",
  "该文件已过期，请重新上传": "This file has expired, please re-upload",
  "部分文件已过期，请重新上传": "Some files have expired, please re-upload",
  "已存在同名文件「x」，如需覆盖请用「替换」操作": "Duplicate file name \"{x}\", use \"Replace\" to overwrite",
  "已忽略 n 个同名文件": "Ignored {n} duplicate file(s)",
  "替换": "Replace",
  "重试": "Retry",
  "点击上传文件": "Click to upload file",
  "支持多选": "Multiple selection supported",
  "上传失败，请重试": "Upload failed, please retry"
}
```

### 3.2 组件内使用

```ts
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

// 普通文案
t('点击上传文件')
t('上传失败，请重试')

// 插值文案
t('已存在同名文件「x」，如需覆盖请用「替换」操作', { x: fileName })
t('已忽略 n 个同名文件', { n: names.length })
```

## 4. 自检清单

- [ ] `zh-cn.json` 已添加所有新增键
- [ ] `en.json` 已添加对应英文值
- [ ] 插值参数 `{x}` / `{n}` 在 zh-cn 与 en 中一致
- [ ] 组件内 `t()` 调用键名与 JSON 键名完全一致（含标点）
- [ ] 复用文案已 grep 确认存在
- [ ] 无硬编码中文（除 JSON 文件外）
