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

import type { ClusterTypes } from '@common/const';

// 被替换主机（Oracle 单机单实例，实例反查结果即主机信息）
export interface ReplaceHost {
  bk_cloud_id: number;
  bk_host_id: number;
  cluster_id: number;
  cluster_type: ClusterTypes | '';
  cluster_type_name: string;
  instance_address: string;
  ip: string;
  master_domain: string;
  port: number;
  role: string;
  // 当前规格 id（反查 spec_config.id），供目标规格列默认填充
  specId: number;
  status: string;
  // 实例版本号（提交协议 db_version 拼接：Oracle-{version}）
  version: string;
}

// 被替换主机字段工厂：统一默认值
export const createReplaceHost = (host: Partial<ReplaceHost> = {}): ReplaceHost => ({
  bk_cloud_id: 0,
  bk_host_id: 0,
  cluster_id: 0,
  cluster_type: '',
  cluster_type_name: '',
  instance_address: '',
  ip: '',
  master_domain: '',
  port: 0,
  role: '',
  specId: 0,
  status: '',
  version: '',
  ...host,
});
