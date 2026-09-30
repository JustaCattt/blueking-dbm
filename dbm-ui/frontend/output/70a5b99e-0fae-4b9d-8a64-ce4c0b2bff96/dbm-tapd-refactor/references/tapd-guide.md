# TAPD 需求拉取指南

通过 tapd MCP server 拉取需求单。调用链：`mcp_get_tool_description` 获取 schema → `proxy_execute_tool` 执行。

## 标准流程

### 1. 短 ID → 19 位长 ID

用户给的 TAPD 编号通常是 9 位短 ID（如 137669301），接口要求 19 位长 ID：

```
proxy_execute_tool({
  tool_name: "tapd_id_get",
  tool_args: { short_id: 137669301, type: "story" }  // type: story|bug|task
})
// 返回 { workspace_id, long_id }，两者都留下备用
```

链接场景直接解析 URL：`https://tapd.woa.com/tapd_fe/{workspace_id}/story/detail/{story_id}` → workspace_id + 19 位 id，无需转换。

### 2. 查需求详情

```
proxy_execute_tool({
  tool_name: "stories_get",
  tool_args: {
    id: "<19位长ID>",
    workspace_id: <workspace_id>,
    fields: "id,name,description,status,owner,creator,priority",
    with_v_status: 1
  }
})
```

### 3. 解析 description

需求正文是嵌套 Markdown：**概要、功能分节（§1 §2…含表格）、验收标准（§验收/§5）、受影响清单（§6）**。逐段精读：

- 概要 → 理解改造目标
- 功能分节表格 → 逐行映射为页面交互点
- **验收标准 → 单独摘出，作为第 4 步自检清单**
- 受影响清单 → 确认改动范围不遗漏

### 4. 原型图获取

- description 中的原型链接（bkrepo 等）：`curl.exe -sSL -o <sessionTmp>/prototypes/<名称>.html <URL>` 下载到**会话临时目录**（不放项目源码目录）。PowerShell 提取文本结构：

```powershell
$html = Get-Content <文件> -Raw -Encoding UTF8
$text = $html -replace '<script[\s\S]*?</script>','' -replace '<style[\s\S]*?</style>','' -replace '<[^>]+>',"`n"
($text -split "`n" | Where-Object { $_.Trim() -ne '' }) -join "`n"
```

- description 内嵌图片：`get_workitem_desc_images`（参数 workspace_id / type=story / id=19位）取下载链接，下载后用 image 工具（task=general 或 ocr）解析布局。

### 5. 评论区必查

```
proxy_execute_tool({
  tool_name: "comments_get",
  tool_args: { workspace_id: <id>, entry_type: "story", entry_id: "<19位长ID>", limit: 30 }
})
```

**后端接口协议、补充口径、字段定义经常补充在评论区而非需求正文**，拉取需求后必须翻一遍评论：

- 发现接口协议类评论 → 整理进 `references/api-protocol.md`（结构：接口清单、公共约定、逐接口的路径/参数/返回/错误、前端落地要点速查表），实现时以协议为准、禁止 TODO。
- 发现需求口径修正 → 与需求正文冲突时以较新评论为准，并在自检清单中注明口径来源。
- 评论含原型图/表格同样按第 4 步方法解析。

## 提醒

- 原型图**仅作视觉参考**；与需求文字冲突时以需求文字为准（SKILL.md 铁律 1）。
- 原型 HTML 里可能带"本次优化点"注释块，落地时不要照抄进代码。
- 需求单可能引用外部设计文档（如"版本包管理.md"）；拿不到就按需求单文字实现，不臆造文档内容。
