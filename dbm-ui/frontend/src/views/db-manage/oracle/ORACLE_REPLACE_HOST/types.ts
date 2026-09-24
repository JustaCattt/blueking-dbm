/*
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either or implied. See the License for
 * the specific language governing permissions and limitations under the License.
 */

import { ClusterInstStatusKeys, ClusterTypes } from '@common/const';

import type OracleHaMachineModel from '@services/model/oracle/oracle-ha-machine';
import type OracleSingleMachineModel from '@services/model/oracle/oracle-single-machine';

// 协议主机要素（old_node / old_master 结构）
export interface HostInfo {
  bk_biz_id: number;
  bk_cloud_id: number;
  bk_host_id: number;
  ip: string;
  port: number;
  // 主机角色（primary/standby 等），提交进协议供单据详情快照展示
  role: string;
}

// 复制源展示信息（§2.4：{IP:Port} + 角色，系统推导，用户不改）
export interface ReplicationSource {
  address: string;
  role: string;
}

// 被替换主机（Oracle 单机单实例，实例反查结果即主机信息）
export interface ReplaceHost {
  bk_biz_id: number;
  bk_cloud_id: number;
  bk_host_id: number;
  cluster_id: number;
  cluster_type: ClusterTypes | '';
  cluster_type_name: string;
  instance_address: string;
  ip: string;
  master_domain: string;
  port: number;
  // 复制源（§2.4：系统推导，展示 {IP:Port} + 角色）
  replication_source: ReplicationSource;
  role: string;
  // 当前规格 id（反查 spec_config.id），供目标规格列默认填充
  specId: number;
  status: string;
  // 实例版本号（提交协议 db_version 拼接：Oracle-{version}）
  version: string;
}

// 选择器返回的主机模型（主从 / 单节点）
export type SelectorMachine = OracleHaMachineModel | OracleSingleMachineModel;

// 提交单据 info 结构
export interface TicketInfo {
  cluster_id: number;
  old_master?: HostInfo;
  old_node: HostInfo;
  replace_flag: boolean;
  replace_host: HostInfo;
  resource_spec: {
    oracle: {
      count: number;
      label_names: string[];
      labels: string[];
      spec_id: number;
    };
  };
}

// 被替换主机字段工厂：统一默认值，bk_biz_id 默认当前业务
export const createReplaceHost = (host: DeepPartial<ReplaceHost> = {}): ReplaceHost => {
  const { replication_source: rs, ...rest } = host;
  return {
    bk_biz_id: window.PROJECT_CONFIG.BIZ_ID,
    bk_cloud_id: 0,
    bk_host_id: 0,
    cluster_id: 0,
    cluster_type: '',
    cluster_type_name: '',
    instance_address: '',
    ip: '',
    master_domain: '',
    port: 0,
    replication_source: {
      address: rs?.address ?? '',
      role: rs?.role ?? '',
    },
    role: '',
    specId: 0,
    status: '',
    version: '',
    ...rest,
  };
};

// 提取协议主机要素（old_node / old_master）：缺省字段按默认值兜底
export const buildHostInfo = (host: Partial<HostInfo> & Pick<HostInfo, 'ip' | 'port'>): HostInfo => ({
  bk_biz_id: host.bk_biz_id ?? window.PROJECT_CONFIG.BIZ_ID,
  bk_cloud_id: host.bk_cloud_id ?? 0,
  bk_host_id: host.bk_host_id ?? 0,
  ip: host.ip,
  port: host.port,
  role: host.role ?? '',
});

// §2.4 复制源推导（统一入口）：单点→自身 primary；从库正常→自身 standby；从库异常→需反查主库
// 接受选择器主机模型或 checkInstance 返回的实例信息
export const computeReplicationSource = (data: {
  cluster_type: ClusterTypes | string;
  instance_address?: string;
  instance_role?: string;
  role?: string;
  status?: string;
}): ReplicationSource => {
  // SelectorMachine 用 instance_role，InstanceInfos 用 role
  const role = data.instance_role ?? data.role ?? '';
  const address = data.instance_address ?? '';

  if (data.cluster_type === ClusterTypes.ORACLE_SINGLE_NONE) {
    return { address, role: 'primary' };
  }
  if (role === 'standby') {
    if (data.status === ClusterInstStatusKeys.RUNNING) {
      return { address, role: 'standby' };
    }
    // 从库异常：复制源为主库，地址需反查（由调用方补齐）
    return { address: '', role: 'primary' };
  }
  return { address: '', role: '' };
};
