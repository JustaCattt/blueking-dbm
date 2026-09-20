# 现有 Oracle 工具箱清单

找同类单据做参考实现、判断新单据的模式归属时查此表；新单据实现完成后同步更新本表。

| TicketType | 中文名 | 模式 | 特殊组件 |
|------------|--------|------|----------|
| `ORACLE_ADD_SLAVE` | 添加从库 | C 变体 | `UpstreamInstanceColumn`、`ClusterColumn`、`ReplicationSourceColumn`（仅主库卡片显示，系统推导）、`SpecColumn`、`ResourceTagColumn`、`AvailableResourceColumn`、双 ticket_type 共用一页；主库卡片按行复制源推导提交单据（从库复制源 → VIA_CASCADING，否则 → ADD_SLAVE） |
| `ORACLE_ADD_SLAVE_VIA_CASCADING` | 经从库添加从库 | C 变体 | 复用 `ORACLE_ADD_SLAVE` 的 Index.vue，提交时动态选择 ticket_type |
| `ORACLE_EXEC_SCRIPT_APPLY` | SQL 变更执行 | B | `RenderFileList`、`RenderFileContent` |
