/*
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
 */

import _ from 'lodash';

import { getBizs } from '@services/source/cmdb';
import { fetchMountPoints } from '@services/source/dbresourceResource';
import { getResourceSpec } from '@services/source/dbresourceSpec';
import { fetchDbTypeList } from '@services/source/infras';
import { getCloudList } from '@services/source/ipchooser';

import { ipv4 } from '@common/regex';

import { t } from '@locales/index';

import { isValueEmpty } from './utils';

type Config = {
  label: string;
  component: string;
  type: 'number' | 'string' | 'array' | 'rang';
  flex?: number;
  // 格式化搜索参数
  formatValue: (value: any) => any;
  validator?: (value: any) => boolean | string;
  service?: (params?: any) => Promise<Array<any>> | Promise<any>;
  getNameByKey?: (value: string | number, item: any) => string | undefined;
  // 组件额外关联参数
  relatedFields?: {
    name: string;
    type: Config['type'];
    formatValue: (value: any) => any;
  }[];
};

const formatValueHelper = (field: string, value: any, type?: string) => {
  if (isValueEmpty(value)) {
    return {};
  }
  if (type === 'array' && value.length > 0) {
    return {
      [field]: value.join(','),
    };
  }
  if (type === 'rang' && value.length > 0) {
    return {
      [field]: `${value[0]}-${value[1]}`,
    };
  }
  return {
    [field]: value,
  };
};

export default {
  for_biz: {
    label: t('所属业务'),
    component: 'for_biz',
    type: 'number',
    service: getBizs,
    getNameByKey: (value: number, item: { bk_biz_id: number; display_name: string }) => {
      if (`${value}` === `${item.bk_biz_id}`) {
        return item.display_name;
      }
      return undefined;
    },
    formatValue: (value: number) => formatValueHelper('for_biz', value, 'number'),
  },
  resource_type: {
    label: t('所属DB类型'),
    component: 'resource_type',
    type: 'string',
    service: fetchDbTypeList,
    getNameByKey: (value: string, item: { id: string; name: string }) => {
      if (value === item.id) {
        return item.name;
      }
      return undefined;
    },
    formatValue: (value: string) => formatValueHelper('resource_type', value),
  },
  hosts: {
    label: 'IP',
    component: 'hosts',
    type: 'array',
    flex: 2,
    validator: (value: string[]) => {
      if (!value || value.length < 1) {
        return true;
      }
      const errorValue = value.filter((item) => !ipv4.test(_.trim(item)));
      if (errorValue.length > 0) {
        return t('IP 格式错误:n', { n: errorValue.join(',') });
      }
      return true;
    },
    formatValue: (value: string[]) => formatValueHelper('hosts', value, 'array'),
  },
  agent_status: {
    label: t('Agent 状态'),
    component: 'agent_status',
    type: 'number',
    formatValue: (value: number) => formatValueHelper('agent_status', value, 'number'),
  },
  city: {
    label: t('地域 - 园区'),
    component: 'city',
    flex: 2,
    type: 'string',
    formatValue: (value: string) => formatValueHelper('city', value, 'string'),
    relatedFields: [
      {
        name: 'subzone_ids',
        type: 'array',
        formatValue: (value: string[]) => formatValueHelper('subzone_ids', value),
      },
    ],
  },
  device_class: {
    label: t('机型'),
    component: 'device_class',
    type: 'string',
    formatValue: (value: string) => formatValueHelper('device_class', value, 'string'),
  },
  os_type: {
    label: t('操作系统类型'),
    component: 'os_type',
    type: 'string',
    formatValue: (value: string) => formatValueHelper('os_type', value, 'string'),
  },
  mount_point: {
    label: t('磁盘挂载点'),
    component: 'mount_point',
    type: 'string',
    service: fetchMountPoints,
    formatValue: (value: string) => formatValueHelper('mount_point', value, 'string'),
  },
  cpu: {
    label: t('CPU(核)'),
    component: 'cpu',
    type: 'rang',
    validator: (value: undefined | [number, number]) => {
      if (!value || value.length < 1) {
        return true;
      }
      const [min, max] = value;
      if (min && max && min > max) {
        return t('请输入合理的范围值');
      }
      return true;
    },
    formatValue: (value: string) => formatValueHelper('cpu', value, 'rang'),
  },
  mem: {
    label: t('内存(G)'),
    component: 'mem',
    type: 'rang',
    validator: (value: undefined | [number, number]) => {
      if (!value || value.length < 1) {
        return true;
      }
      const [min, max] = value;
      if (min && max && min > max) {
        return t('请输入合理的范围值');
      }
      return true;
    },
    formatValue: (value: string) => formatValueHelper('mem', value, 'rang'),
  },
  disk: {
    label: t('磁盘(G)'),
    component: 'disk',
    type: 'rang',
    validator: (value: undefined | [number, number]) => {
      if (!value || value.length < 1) {
        return true;
      }
      const [min, max] = value;
      if (min && max && min > max) {
        return t('请输入合理的范围值');
      }
      return true;
    },
    formatValue: (value: string) => formatValueHelper('disk', value, 'rang'),
  },
  disk_type: {
    label: t('磁盘类型'),
    component: 'disk_type',
    type: 'string',
    formatValue: (value: string) => formatValueHelper('disk_type', value, 'string'),
  },
  spec_id: {
    label: t('规格'),
    component: 'spec',
    flex: 2,
    type: 'number',
    service: (value: number) => getResourceSpec({ spec_id: value }),
    getNameByKey: (value: number, item: { spec_id: number; spec_name: string }) => {
      if (value === item.spec_id) {
        return item.spec_name;
      }
      return undefined;
    },
    formatValue: (value: number) => formatValueHelper('spec_id', value, 'number'),
  },
  bk_cloud_ids: {
    label: t('管控区域'),
    component: 'bk_cloud_ids',
    type: 'array',
    service: getCloudList,
    getNameByKey: (value: string, item: { bk_cloud_id: number; bk_cloud_name: string }) => {
      if (value === `${item.bk_cloud_id}`) {
        return item.bk_cloud_name;
      }
      return undefined;
    },
    formatValue: (value: string[]) => formatValueHelper('bk_cloud_ids', value, 'array'),
  },
} as Record<string, Config>;
