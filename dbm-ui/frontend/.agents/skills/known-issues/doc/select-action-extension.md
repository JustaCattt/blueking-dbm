# 下拉框创建与跳转动作放扩展插槽，不作为选项

- **命中**：新增或修改 Select 下拉中的“添加 / 新建 / 跳转”动作，或使用特殊字符串选项值触发操作。可运行 `rg -n 'ADD_NODE|lastNode|__add_|#extension' src/views -g '*.vue'` 后逐个确认是否为业务数据选项。
- **为什么**：动作选项会进入 v-model、触发选项校验，并让输入框回显动作文字；为此再添加上一个值暂存和还原逻辑是多余的补救。
- **改成**：真实数据继续使用 DbOption；动作放在 `<template #extension>` 内，通过按钮点击独立处理。EditableSelect 缺少透传时，仅补可选 extension 插槽和 defineSlots 类型，不改选项及事件契约。
- **不要**：用 `__add_*__` 等伪值充当选项，再在 change 中恢复上次选中值；也不要在 options 默认插槽末尾裸放动作节点冒充扩展区域。
- **存量**：上述命令中，`__add_spider_mnt__` 与 `lastNode` 只在本轮修正前的 `src/views/db-manage/mysql/MYSQL_DTS_DATA_MIGRATE_HETERO/components/SpiderMntColumn.vue` 发现；已删除。已有扩展用法参考 `src/views/db-manage/common/cluster-authorize/components/mysql-permission-rules/components/UserSelect.vue`。
- **核实**：2026-11-23。已读取 EditableSelect 的所有模板调用块及 DbSelect 扩展区域源码，确认扩展区域在选项为空时仍可渲染。未运行类型检查、lint 或页面联调。
