# 同族工具箱单据复用入口，不重复展示子方式

- **命中**：新增工具箱单据时，同一页面族已经通过 CardCheckbox 等控件切换方式，且 `toolboxMenuList.ts` 已有代表入口和 `bind`。先执行 `rg -n 'bind:|MYSQL_DTS_DATA_MIGRATE' src/views/db-manage/mysql/toolbox/toolboxMenuList.ts`，并读取同族页面确认语义。
- **为什么**：给每个子方式新增独立菜单会重复展示同一个工具，也会让收藏、最近使用和页内入口定位与同族工具不一致。
- **改成**：保留代表入口的 `id`、名称和描述，将新单据类型加入该入口的 `bind`；保留新类型路由，在页面内切换方式。只有明确要求独立入口时才新增菜单项。
- **不要**：仅因为新增 TicketTypes 就添加独立菜单；不要为了隐藏菜单删除页面路由。
- **存量**：`rg -n 'bind:' src/views/db-manage/mysql/toolbox/toolboxMenuList.ts`。已阅读对照的同族入口包括回档、构造、Proxy 变更和 DTS 数据迁移，本轮只调整 DTS 入口。
- **核实**：2026-11-23。已读取 `src/views/db-manage/mysql/toolbox/toolboxMenuList.ts`、`src/views/db-manage/mysql/MYSQL_PROXY_ADD/components/ProxyWrapper.vue`；`src/views/db-manage/common/toolbox-new/content/Index.vue` 使用 `bind` 匹配当前路由归属。
