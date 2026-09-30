# 项目结构速查（dbm-ui frontend）

调研改造点时的文件定位地图。**改造前必读相关文件，禁止盲改。**

## db-configure 模块布局

```
src/views/db-configure/
├── business/                    # 业务级配置（本次改造主战场）
│   ├── create-module/           # 新建模块
│   │   ├── Index.vue            # 入口（路由 DbConfigureCreateModule）
│   │   ├── com-factory/         # 按 DB 类型分发：MySql.vue / SqlServer.vue / TendbCluster.vue
│   │   └── components/          # 新建模块私有组件（DbVersionSelect / ParamTable / BatchEditSideslider）
│   ├── clone-module/            # 克隆模块（结构同上，另有 LevelConfigTable）
│   ├── detail/                  # 模块详情（Index.vue）
│   └── list/                    # 配置列表页（components/biz/ 业务级、components/module/ 模块级）
├── platform/                    # 平台级配置（detail/ list/，结构类似）
├── components/                  # 跨层级复用：TopoTree / ParamTable / DomainPreview / ConfTab / BatchEditSideslider / ValueEditor
├── hooks/                       # useTreeData（树数据/搜索/选中/路由联动）、useLevelParams、useDiff
├── common/types.ts              # TreeData / TreeState 类型
├── utils/configureState.ts      # sessionStorage 状态持久化（saveConfigureState / getConfigureState / resetConfigureTab）
├── routes.ts                    # 模块路由
└── Index.vue
```

## 项目约定（改造必须遵守）

| 关注点 | 约定 |
|--------|------|
| 请求层 | `useRequest`（vue-request）包裹 `@services/source/*` 的接口函数；`ServiceReturnType<typeof fn>` 取返回类型 |
| 国际化 | `useI18n()` 的 `t()`，key 直接写中文原文（如 `t('模块名称')`） |
| 组件命名 | 项目封装以 `Db` 开头（DbForm/DbSelect/DbOption/DbTag/DbIcon/DbCard/DbResetButton）；bkui-vue 以 `Bk` 开头（全局注册，无需 import） |
| 路由 | 命名路由：`DbConfigureList` / `DbConfigureCreateModule` / `DbConfigureCloneModule`；params 携带 clusterType / parentId / treeId |
| 树选中状态 | `saveConfigureState({ selectedParentId, selectedTreeId })` + `resetConfigureTab()`，页面跳转后恢复 |
| 模块名查重 | `checkDbModuleUnique`（@services/source/cmdb），`db_module_name = ${模块名}-${版本}-${字符集}` 组合 |
| 提交流程 | `createModules` → `saveModulesDeployInfo`（绑定 conf_items）→ 绑定各 Tab 参数 → 跳转 DbConfigureList 并选中新节点 |
| 样式 | Less scoped；常用色 `@primary-color`、灰 `#979ba5`；卡片阴影 `0 2px 4px 0 rgb(25 25 41 / 5%)` |
| 图标 | `DbIcon`（`<DbIcon type="add" />`）、`db-icon-*` class |

## 关键复用组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `TopoTree` | `@views/db-configure/components/TopoTree.vue` | 左侧拓扑树（BkTree + #node 插槽自定义节点内容） |
| `useTreeData` | `@views/db-configure/hooks/useTreeData.ts` | 树数据格式化（module 节点抽取 clusters）、搜索、选中、createModule/cloneModule 跳转 |
| `DbVersionSelect` | business/{create,clone}-module/components/ | 版本下拉（listPackages 拉版本，首项标"推荐"） |
| `ParamTable` | `@views/db-configure/components/ParamTable.vue` | 参数配置表格（changedCount / hasChange / bindConfigParameters / handleReset） |
| `DomainPreview` | `@views/db-configure/components/DomainPreview.vue` | 集群域名预览 |
| `FormItemWithHint` | `@components/form-item-with-hint/Index.vue` | 带提示语的表单项 |
| `DbQuickSearch` 模式 | `@components/cluster-selector/components/useSelectorSearch.ts` | SearchSelect 分字段搜索的参考实现（多条件同时生效、枚举/文本条件结构） |

## 服务层

- `@services/source/cmdb.ts`：checkDbModuleUnique / createModules（版本约束改造后新增 `db_versions` 参数，见 `api-protocol.md`）/ 模块列表（新增 `db_version_info` 返回字段）
- `@services/source/package.ts`：版本包接口（listPackages / getPackages / listPackageTypes / listSupportSystems…）
- `@services/source/configs.ts`：配置接口（getLevelConfig / getListConfTypes / getListClusterModuleConfFiles / saveModulesDeployInfo…）
- 新增接口落点：修改模块 OS（`update_module_version_os`）与版本可选 OS（`GET /apis/version/dbversion/{db_version_id}/permit_os/`）协议见 `api-protocol.md`，路径已在协议中给定；协议未覆盖的接口按 SKILL.md 第 3 步 TODO 规范处理

## 常量

- `@common/const`：`ClusterTypes`（tendbha/tendbsingle/tendbcluster…）、`DBTypes`（MYSQL/SQLSERVER/TENDBCLUSTER…）、`ConfLevels`（APP/MODULE/CLUSTER）、`clusterTypeInfos`
- 字符集候选：`['utf8', 'utf8mb4', 'gbk', 'latin1', 'gb2312']`（见 create-module MySql.vue）
