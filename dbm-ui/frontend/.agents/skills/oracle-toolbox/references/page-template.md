# 模式 A 页面模板（Index.vue 完整骨架）

文件：`src/views/db-manage/oracle/ORACLE_YOUR_NEW_TYPE/Index.vue`，含 MIT 版权头。

## template 结构（七元素顺序固定）

```vue
<!-- MIT 版权头 -->
<template>
  <SmartAction>
    <!-- 1. 顶部提示条（SmartAction 内第一个元素，文案从原型图获取） -->
    <BkAlert class="mb-20" closable :title="t('业务说明文案')" />
    <!-- 2. 批量录入（可选） -->
    <BatchInput :config="batchInputConfig" @change="handleBatchInput" />
    <!-- 3. 表单（BatchInput 下方必须加 mt-16） -->
    <BkForm class="mt-16 mb-20" form-type="vertical" :model="formData">
      <!-- 4. 可编辑表格 -->
      <EditableTable :key="tableKey" ref="tableRef" class="mb-20" :model="formData.tableData">
        <EditableRow v-for="(item, index) in formData.tableData" :key="index">
          <!-- 列组件 -->
          <EditableColumn :label="t('列名')" field="xxx" required>
            <EditableInput v-model="item.xxx" :placeholder="t('请输入')" />
          </EditableColumn>
          <!-- 操作列（必须） -->
          <OperationColumn v-model:table-data="formData.tableData" :create-row-method="createTableRow" />
        </EditableRow>
      </EditableTable>
      <!-- 5. 页级表单项（可选） -->
      <!-- 6. 单据负载（必须） -->
      <TicketPayload v-model="formData.payload" />
    </BkForm>
    <!-- 7. 底部操作栏 -->
    <template #action>
      <BkButton class="mr-8 w-88" :loading="isSubmitting" theme="primary" @click="handleSubmit">{{ t('提交') }}</BkButton>
      <DbResetButton class="ml-8" :confirm-handler="handleReset" :disabled="isSubmitting" />
    </template>
  </SmartAction>
</template>
```

## script setup 核心结构

```typescript
defineOptions({ name: TicketTypes.ORACLE_YOUR_NEW_TYPE });

// --- 导入 ---
import { reactive, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCreateTicket, useTicketDetail } from '@hooks';
import { DBTypes, TicketTypes } from '@common/const';
import BatchInput from '@views/db-manage/common/batch-input/Index.vue';
import OperationColumn from '@views/db-manage/common/toolbox-field/column/operation-column/Index.vue';
import TicketPayload, { createTicketPayload } from '@views/db-manage/common/toolbox-field/form-item/ticket-payload/Index.vue';
import { random } from '@utils';

// --- 类型定义 ---
interface RowData {
  // 行数据字段
}

// --- 基础设置 ---
const { t } = useI18n();
const router = useRouter();
const tableRef = useTemplateRef('tableRef');
const tableKey = ref(random());

// --- 行数据工厂 ---
const createTableRow = (data: DeepPartial<RowData> = {}) => ({ /* ... */ });

// --- 表单默认值工厂 ---
const defaultData = () => ({ payload: createTicketPayload(), tableData: [createTableRow()] });
const formData = reactive(defaultData());

// --- 编辑/克隆回填 ---
useTicketDetail(TicketTypes.ORACLE_YOUR_NEW_TYPE, {
  onSuccess(ticketDetail) {
    const { details } = ticketDetail;
    const { clusters, infos } = details;
    const tableData = infos.map((item) =>
      createTableRow({
        // 从 details 映射回 formData
        // labels 是 id 列表，配合 label_names 补名称回显（有资源标签列时必写）
        labels: (item.resource_spec?.slave?.labels || []).map((labelId, index) => ({
          id: Number(labelId),
          value: item.resource_spec?.slave?.label_names?.[index] || '',
        })),
      }),
    );
    Object.assign(formData, {
      payload: createTicketPayload(ticketDetail),
      tableData: tableData.length ? tableData : [createTableRow()],
    });
  },
});

// --- 提交 ---
// 泛型用内联的提交 payload 类型，禁止复用详情类型
const { loading: isSubmitting, run: createTicketRun } = useCreateTicket<SubmitDetailsType>(TicketTypes.ORACLE_YOUR_NEW_TYPE);
const handleSubmit = async () => {
  const result = await tableRef.value!.validate();
  if (!result) return;
  createTicketRun({ details: { /* ... */ }, ...formData.payload });
};

// --- 重置 ---
const handleReset = () => { Object.assign(formData, defaultData()); };

// --- 批量录入 ---
const handleBatchInput = (data: Record<string, any>[], isClear: boolean) => { /* ... */ };

// --- 返回工具箱 ---
defineExpose({ routerBack() { router.push({ name: 'OracleToolboxIndex' }); } });
```

## 列组件使用规范

**EditableColumn 标签内优先使用 EditableXXX 组件**：

- 可编辑列：`EditableInput`、`EditableSelect`
- 只读列：`EditableBlock`
- 校验规则通过 `EditableColumn` 的 `appendRules` 或 `rules` prop 传入 площа

```vue
<!-- 可编辑列（带校验） -->
<EditableColumn
  :append-rules="rules"
  field="upstreamInstance"
  :label="t('上游实例')"
  :min-width="220"
  required>
  <EditableInput
    v-model="item.value"
    :placeholder="t('请输入')" />
</EditableColumn>

<!-- 只读列 -->
<EditableColumn
  :label="t('角色')"
  :min-width="150"
  readonly>
  <EditableBlock :placeholder="t('自动生成')">
    {{ item.role }}
  </EditableBlock>
</EditableColumn>
```

## 双 ticket_type 共用页面

当原型图要求多个 ticket_type 共用同一页（通过 CardCheckbox 切换子类型，提交时动态选择 ticket_type）时使用。参考实现：`ORACLE_ADD_SLAVE/Index.vue`。

### 提交 hook

需要两个 `useCreateTicket` 实例，各自绑定不同 ticket_type：

```typescript
const { loading: isSubmittingA, run: runA } = useCreateTicket<SubmitDetails>(TicketTypes.TYPE_A);
const { loading: isSubmittingB, run: runB } = useCreateTicket<SubmitDetails>(TicketTypes.TYPE_B);

const isSubmitting = computed(() => isSubmittingA.value || isSubmittingB.value);

const submitTicketType = computed(() =>
  formData.mode === 'someMode' ? TicketTypes.TYPE_B : TicketTypes.TYPE_A,
);

const handleSubmit = () => {
  tableRef.value!.validate().then(() => {
    const payload = { details: buildSubmitDetails(), ...formData.payload };
    if (submitTicketType.value === TicketTypes.TYPE_B) {
      runB(payload);
    } else {
      runA(payload);
    }
  });
};
```

### 回填 hook

两个 `useTicketDetail` 实例，各自监听不同 ticket_type 的回填：

```typescript
useTicketDetail(TicketTypes.TYPE_A, { onSuccess(ticketDetail) { applyTicketDetail(ticketDetail); } });
useTicketDetail(TicketTypes.TYPE_B, { onSuccess(ticketDetail) { applyTicketDetail(ticketDetail); } });
```
