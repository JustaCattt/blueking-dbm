# 后端接口协议（DB 模块版本约束 v1）

来源：TAPD 单 137669301 评论区（2026-09-30，kiozhang）。涉及 4 个接口：创建模块（改动）、修改模块 OS（新增）、模块列表（改动：新增 `db_version_info`）、获取版本可选 OS（新增）。`check_db_module_unique` 不变。

改造时以本协议为准实现接口层与数据绑定；协议未覆盖的交互细节仍按 SKILL.md 铁律处理（需求文字优先、组件三级选型）。

## 0. 公共约定

**组件名**（`db_versions` / `db_version_info` 的 key），每种集群类型只能用以下组件：

| 集群类型 cluster_type | 组件名 | 对应介质类型 |
| --- | --- | --- |
| tendbsingle | single | mysql |
| tendbha | backend、proxy | mysql、mysql-proxy |
| tendbcluster | remote、spider | mysql、spider |

其他集群类型暂不纳入版本约束，**不要传 `db_versions`**，传了会报「不支持的组件」。

**单个组件的写入结构**：

```json
{"db_version_id": 12, "permit_os_type": "Linux", "permit_os": []}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| db_version_id | int | 版本号 ID，必须大于 0 |
| permit_os_type | string | OS 类型：Linux / Windows / Aix / Unix / Solaris / FreeBSD |
| permit_os | string[] | 传 `[]` 表示「跟随版本包」；传非空列表表示「指定范围」，写入后不随介质包变化 |

- 跟随版本包：实际可用 OS = 该版本下同一 `permit_os_type`、已启用介质包 `permit_os` 的并集，介质包变化后结果跟着变。
- 指定范围：每一项都必须在该版本当前已启用介质包的 OS 范围内。

**错误返回**：平台统一格式 `{result: false, code, message, data}`，版本相关业务错误直接展示 `message`。

## 1. 创建模块（改动）

`POST /apis/cmdb/{bk_biz_id}/create_module/`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| db_module_name | string | 是 | 模块名 |
| alias_name | string | 否 | 别名，不传时等于模块名 |
| cluster_type | string | 是 | 集群类型 |
| db_versions | object | 条件必填 | `{组件名: 组件结构}`，tendbsingle / tendbha / tendbcluster 必填 |

> ⚠️ 后端只校验「db_versions 必须传」，不校验各层是否传齐。前端必须把该集群类型的**所有组件**都传上来（如 tendbha 同时传 backend + proxy）。

请求示例（MySQL 主从）：

```json
{
  "db_module_name": "gamedb",
  "alias_name": "gamedb",
  "cluster_type": "tendbha",
  "db_versions": {
    "backend": {"db_version_id": 12, "permit_os_type": "Linux", "permit_os": []},
    "proxy": {"db_version_id": 30, "permit_os_type": "Linux", "permit_os": ["tlinux-3.2", "tlinux-4"]}
  }
}
```

返回：模块全部字段 + `db_version_info`（结构见第 5 节）。**前端展示用 `db_version_info`，不要直接解析 `current_db_version_info_dict`。**

错误示例：没传 db_versions →「请填写各层版本」；字段级错误按组件名返回（如 `{"proxy": {"db_version_id": [...]}}`）；版本不存在/未启用；组件绑错介质类型；OS 超范围；不支持的组件；模块重名。

## 2. 修改模块的操作系统约束（新增）

`POST /apis/cmdb/{bk_biz_id}/update_module_version_os/`

模块创建后**版本号不允许修改**，只能修改 OS 约束（类型和范围）。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| db_module_id | int | 是 | 模块 ID |
| db_versions | object | 是 | `{组件名: {permit_os_type, permit_os}}`，不能为空。只传要改的组件，没传的保持原样 |

- 传了 `db_version_id` 也会被忽略，后端一律用模块上已保存的版本。
- 只能修改已经设置过版本的组件。

请求示例（把 proxy 改回跟随版本包）：

```json
{"db_module_id": 5001, "db_versions": {"proxy": {"permit_os_type": "Linux", "permit_os": []}}}
```

返回：`{"db_module_id": 5001, "db_version_info": {...}}`，`db_version_info` 包含该模块全部组件。

## 3. 模块列表（改动：新增返回字段）

`GET /apis/cmdb/bizs/{bk_biz_id}/modules/?cluster_type=tendbha`（等价 `GET /apis/cmdb/{bk_biz_id}/list_modules/`）

请求参数不变。每项在原有字段基础上新增 `db_version_info`。**存量模块未设置版本时 `db_version_info` 为 `{}`，前端必须兼容空对象**（详情展示 `--`）。

## 4. 获取介质版本可选的操作系统（新增）

`GET /apis/version/dbversion/{db_version_id}/permit_os/`

返回该版本下已启用介质包支持的 OS，按类型分组合并去重。创建模块与修改 OS 时，用它选 `permit_os_type` / `permit_os`。

```json
[
  {"permit_os_type": "Linux", "permit_os": ["tlinux-3.2", "tlinux-4"]},
  {"permit_os_type": "Windows", "permit_os": ["windows-2019"]}
]
```

- 无已启用介质包返回 `[]` → 前端提示「该版本暂无可用介质包」。
- 版本不存在返回 404。
- 服务端创建/修改校验用同一份数据，从这里选的值不会触发「OS 不在范围内」。

## 5. db_version_info 结构（1~3 节共用）

`{组件名: 组件展示信息}`：

```json
{
  "proxy": {
    "db_version_id": 30,
    "permit_os_type": "Linux",
    "permit_os": [],
    "follow_package": true,
    "effective_permit_os": ["tlinux-3.2", "tlinux-4"],
    "distribution": "Tendb Proxy",
    "version_series": "1.3",
    "version_name": "mysql-proxy-1.3.0",
    "full_version": "1.3.0"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| db_version_id | int | 版本号 ID |
| permit_os_type | string | OS 类型 |
| permit_os | string[] | 模块保存的原始值，`[]` = 跟随版本包 |
| follow_package | bool | 是否跟随版本包 |
| effective_permit_os | string[] | **当前实际可用 OS**：跟随取介质包并集，指定范围 = permit_os。**展示和回填用这个字段** |
| distribution | string | 发行版名称 |
| version_series | string | 系列名称 |
| version_name | string | 版本号名称 |
| full_version | string | 完整版本号 |

- 跟随模式下该版本已无已启用介质包时，`effective_permit_os` 返回 `[]`。
- 版本记录被删时 distribution / version_series / version_name / full_version 返回空字符串，其余照常。

## 前端落地要点速查

| 需求交互 | 协议映射 |
| --- | --- |
| 存储层/接入层三级选型（发行版→系列→版本号） | 选最终 `db_version_id` 写入 `db_versions[组件名].db_version_id` |
| OS「跟随版本包」/「指定范围」开关 | `permit_os: []` vs 非空列表；开关态展示用 `follow_package` |
| 详情按层展示版本与 OS | 读 `db_version_info[组件名]`，版本串 = distribution / version_series / version_name，OS 展示用 `effective_permit_os` |
| 存量模块无 OS 数据显示 `--` | `db_version_info` 为 `{}` 或组件缺失时兜底 |
| OS 编辑弹窗（创建后仅 OS 可改） | `update_module_version_os`，只传要改的组件 |
| OS 候选项（模式切换/换版本联动） | `GET /apis/version/dbversion/{db_version_id}/permit_os/`，空数组提示「该版本暂无可用介质包」 |
| 组件名按集群类型 | tendbsingle→single；tendbha→backend+proxy；tendbcluster→remote+spider；其他类型不传 db_versions |
| 前端补齐校验 | 后端不校验各层传齐 → 提交前前端自行校验所有组件齐全 |
| 错误提示 | 直接展示后端 `message`；字段级错误按组件名定位表单项 |
