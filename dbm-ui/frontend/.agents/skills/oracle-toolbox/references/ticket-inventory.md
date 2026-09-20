# 现有 Oracle 工具箱清单

找同类单据做参考实现、判断新单据的模式归属时查此表；新单据实现完成后同步更新本表。

| TicketType | 中文名 | 模式 | 特殊组件 |
|------------|--------|------|----------|
| `ORACLE_ADD_SLAVE` | 添加从库 | C（页内 CardCheckbox 子类型，单 ticket_type） | `UpstreamInstanceColumn`、`ReplicationSourceColumn`（仅主库模式显示）、`SpecColumn`、`ResourceTagColumn`、`AvailableResourceColumn`；所属集群列为只读 `EditableBlock` 内联（未抽子组件）；子类型靠 `details.upstream_type`（single / master / slave）区分，级联场景行内传 `old_master`（主库）+ `old_node`（正常从库），无独立级联单据 |
| `ORACLE_EXEC_SCRIPT_APPLY` | SQL 变更执行 | B | `RenderFileList`、`RenderFileContent` |
| `ORACLE_REPLACE_HOST` | 整机替换 | A | `HostColumnGroup`（主机 IP + 角色/状态/所属集群/集群类型五列一体的只读反查列组）、`SpecColumn`（`current-spec-id-list` 默认当前规格）、`ResourceTagColumn`、`AvailableResourceColumn`、`OperationColumn`（添加/克隆/删除）；提交按行状态分流：单节点/异常从库 → `ticket_type=ORACLE_ADD_SLAVE` + `flow_type=ORACLE_ADD_SLAVE`（无 old_master），主从正常从库 → `ticket_type=ORACLE_REPLACE_HOST` + `flow_type=ORACLE_ADD_SLAVE_VIA_CASCADING`（带 old_master 主库）；协议字段：`cluster_id` 单数、`old_node`/`old_master` HostInfo 结构、`replace_flag: true`、`db_version: Oracle-{version}`、`ip_source: 'resource_pool'`（协议源：TAPD 需求 137992789 评论区） |

注：`ORACLE_ADD_SLAVE_VIA_CASCADING` 曾作为独立 ticket_type 设计过，后端确认无此单据后已删除，勿再引入。
