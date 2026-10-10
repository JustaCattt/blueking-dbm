# 写不存在的 `Db*` 组件会被当成原生元素，静默失效

- **命中**：`rg -n '<Db(Radio|RadioGroup|Checkbox|Switch|Alert|Dialog|Tree)\b' src`
  （这些 bkui 组件族没有 `Db*` 包装）；更一般地——正要写 `<Db某组件>` 时，
  它既不在 `src/common/importComps.ts` 的注册表里，本文件也没有 import
- **为什么**：Vue 对未注册标签不报错，按未知元素渲染。表现是"样式不对"（radio 没有圆圈、button 没有边框），
  但**功能同样是坏的**：`v-model`、`@change`、props 全部接不上，用户点了没有任何反应，且控制台无警告，
  只有 vue-tsc 恰好报模板类型错时才会暴露
- **改成**：bkui 组件一律用 `Bk*`（`main.ts` 已 `app.use(bkuiVue)` 全局注册）；
  单选写法固定为 `<BkRadioGroup v-model="x"><BkRadio label="值">文案</BkRadio></BkRadioGroup>`
  —— Radio 的值 prop 是 `label`，不是 `value`
- **不要**：不要为了这一处再包一层同名的 `Db*` 壳；先在 `importComps.ts` 里搜一遍是否已有
- **存量**：已清零（`src/views/db-configure/components/VersionOsEditor.vue`、
  `src/views/db-configure/business/list/components/module/components/ModuleVersionPanel.vue`
  各有一处 `DbRadioGroup` / `DbRadio`，2026-10-09 修）
- **核实**：2026-10-09
