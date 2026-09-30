---
name: dbm-tapd-refactor
description: DBM 前端 TAPD 需求页面改造。当用户提供 TAPD 单号或链接，要求改造 dbm-ui 的 db-configure（配置管理）、模块页面、版本选型相关功能时使用。基于 TAPD 需求单驱动：拉取需求与原型图、调研项目现状、按组件选型三级规则实现页面改造、对照 TAPD 验收标准自检交互。适用于"结合原型图改造模块页面"、"按 TAPD 需求开发前端页面"、"模块版本选型对接版本包管理"等任务。
cn_name: DBM TAPD 需求页面改造
compatibility: 需可访问 TAPD MCP（tapd server）与 dbm-ui 前端仓库；仅在 D:\blueking-dbm\dbm-ui\frontend 工作区内执行改造。
---

# DBM TAPD 需求页面改造（dbm-tapd-refactor）

依据 TAPD 需求单改造 dbm-ui 前端 db-configure 模块页面。四条铁律贯穿全程：

1. **需求描述为主、原型图仅参考**：交互口径冲突时以 TAPD 单文字为准；原型图只用于理解视觉布局。
2. **组件选型三级**：优先复用项目内已有组件；其次用 bk 前缀组件（bkui-vue）；两者均不满足才自实现，文件放 `src/views/db-configure/` 下对应层级的 `components/`。
3. **接口协议优先级**：已给到协议（含评论区补充，见 `references/api-protocol.md`）的一律按协议实现服务层；确实未给到的才注释为 TODO。TODO 时不臆造后端字段协议；以最小合理假设实现前端交互逻辑并注释 TODO，接口落地后只需替换调用层。
4. **改造完成后逐条对照 TAPD 验收标准自检**，不符合的项必须修复。

## 执行流程

### 第 1 步：拉取 TAPD 需求单

按 `references/tapd-guide.md` 拉取：

- 短 ID 先转 19 位长 ID（`tapd_id_get`），再查详情（`stories_get`，带 `workspace_id` 与 `fields=id,name,description,...`）。
- **评论区必查**（`comments_get`，entry_type=story）：后端接口协议、补充口径常补充在评论区而非需求正文。发现接口协议类评论时，整理进 `references/api-protocol.md` 并以协议为准。
- 从 description 中提取：**原型链接、概要、功能分节（§）、验收标准、受影响清单**。需求正文通常是嵌套 Markdown 表格，逐段精读，不要只看标题。
- 原型 HTML 用 `curl.exe -sSL -o <sessionTmp>/prototypes/<名字>.html <链接>` 下载到**会话临时目录**（禁止放入项目源码目录）；再用 PowerShell 正则去除 `<script>`/`<style>` 后提取文本结构理解布局。原型图**不导入项目**。
- 若 description 内嵌图片原型（`get_workitem_desc_images`），下载后用 image 工具（task=general）理解布局。

### 第 2 步：调研项目现状

改造前**必须**先读相关文件，禁止盲改：

- 目录结构：`src/views/db-configure/` 布局见 `references/project-map.md`（business / platform / components / hooks / utils）。
- 定位需求涉及的页面文件（新建/克隆/详情/列表 → business 下对应子目录的 `Index.vue`、`com-factory/*.vue`、`components/*.vue`）。
- 掌握既有模式：请求用 `useRequest`（vue-request）+ `@services/source/*`；国际化用 `t()`（中文 key 直接做 key）；路由用 `DbConfigureCreateModule` 等命名路由；状态用 `@views/db-configure/utils/configureState`。
- 查找可复用组件：项目内（`@components/`、db-configure/components/）→ bkui-vue（`Bk*` 全局注册，如 BkTab/BkInput/BkDialog/BkTree/BkSearchSelect）→ 最后才自实现。
- 服务层接口在 `src/services/source/`（如 package.ts 为版本包接口）；**涉及接口协议时先查 `references/api-protocol.md`**（版本约束相关协议已整理），协议覆盖的按协议实现，协议未覆盖的按第 3 步 TODO 处理。

### 第 3 步：实现改造

- **需求优先**：逐条把 TAPD 功能分节映射到页面改动；原型图仅校准视觉（布局、层级、文案位置）。
- **接口实现**：按 `references/api-protocol.md` 落地服务层函数（路径、参数、返回结构与错误处理均以协议为准）；协议中标注的前端职责必须落实——例如版本约束场景：前端补齐各组件校验、兼容 `db_version_info` 空对象、OS 展示用 `effective_permit_os`、错误直接展示后端 `message`。
- **组件落地位置**：
  - 跨 business/platform 复用 → `src/views/db-configure/components/`
  - 仅 business 新建/克隆用 → `src/views/db-configure/business/create-module/components/`（或 clone-module/components/）
  - 仅详情用 → `src/views/db-configure/business/detail/` 下建 `components/`
  - 树相关复用逻辑 → `src/views/db-configure/hooks/`
- **接口 TODO 规范**：

```ts
// TODO: 后端接口协议未提供，以下为前端最小假设，接口落地后替换
// 预期接口：查询版本包三级选项（发行版→系列→版本号）
// export function listVersionPackageOptions(params: { db_type: string; pkg_type: string }) {
//   return http.get<...>('/apis/version_package/options/', params);
// }
const fetchVersionOptions = async (params: { db_type: string; pkg_type: string }) => {
  // TODO: 接入真实接口；当前以静态/mock 数据保证交互可演示
  return [];
};
```

- 交互逻辑（联动、校验、必填、显隐）**完整实现**，只有数据来源空缺时才 TODO + 返回空数据兜底。
- 遵循项目代码风格：Vue 3 `<script setup lang="ts">`、Less scoped、注释用中文说明"为什么"。
- **接口协议已给到的场景禁止 TODO**（如版本约束 4 个接口，见 `references/api-protocol.md`），直接实现真实调用。

### 第 4 步：对照 TAPD 验收标准自检

- 从需求单"验收"分节逐条列出验收点 → 逐条核对实现 → 输出自检清单（通过/不通过+原因）。
- 不通过的项：能修则修；受接口阻塞的项在自检清单中标注"待接口"。
- 自检同时确认：需求单"受影响清单"中每个产物都已覆盖或说明不改原因。

## 组件选型决策表

| 场景 | 首选 | 次选 | 自实现 |
|------|------|------|--------|
| 表单/输入 | 项目内 `FormItemWithHint`、`DbForm` | `BkInput`、`BkFormItem` | — |
| 下拉选择 | `DbSelect` + `DbOption` | `BkSelect` | 三级联动选型等复杂场景 |
| 弹窗/二次确认 | 项目内既有 Dialog 封装 | `BkDialog`、`InfoBox` | — |
| 树节点自定义内容 | `BkTree` + `#node` 插槽 | — | 两行节点结构在插槽内实现 |
| 分字段搜索 | 项目内 DbQuickSearch 模式参考 | `BkSearchSelect` | — |
| 参数表格 | db-configure `ParamTable` | — | — |

## 数据绑定速记（版本约束场景，协议见 references/api-protocol.md）

- 集群类型 → 组件名：tendbsingle→`single`；tendbha→`backend`+`proxy`；tendbcluster→`remote`+`spider`；其他类型不传 `db_versions`。
- 写入：`db_versions[组件名] = {db_version_id, permit_os_type, permit_os}`；`permit_os: []` = 跟随版本包，非空 = 指定范围。
- 展示/回填：读 `db_version_info[组件名]`，OS 用 `effective_permit_os`；`{}` = 存量未设置，显示 `--`。
- 创建后仅 OS 可改：`update_module_version_os` 只传要改的组件，`db_version_id` 会被忽略。
- 提交前前端自行校验该集群类型的所有组件齐全（后端不校验）。

## 输出要求

完成改造后向用户汇报：

1. 改动文件清单（新增/修改，一行一个用途）
2. 需求点 → 实现映射摘要
3. TODO 接口清单（预期接口名与用途；协议已覆盖的接口不进此清单）
4. 验收标准自检清单（逐条通过/不通过/待接口）
