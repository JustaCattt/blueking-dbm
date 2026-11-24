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

import type { DetailBase, DetailClusters, DetailSpecs } from '../common';

export interface DtsDataMigrateHetero extends DetailBase {
  backup_locale: 'master' | 'slave';
  check_non_table_object: boolean;
  cleanup_after_migrate: boolean;
  clusters?: DetailClusters;
  destroy_after_migrate: boolean;
  infos: {
    dts_resource: { deploy: { bk_cloud_id: number } };
    migrate: {
      one_to_one: {
        source: {
          cluster_id: number;
          sync_scope: {
            db_patterns: string[];
            ignore_dbs: string[];
            ignore_tables: string[];
            table_patterns: string[];
          };
        };
        target: { cluster_id: number; spider_mnt: string };
      };
      topology: 'one_to_one';
    };
    resource_spec: {
      worker: { count: number; label_names: string[]; labels: string[]; spec_id: number };
    };
    target_schema_sql: string;
  }[];
  recycle_hosts: boolean;
  specs?: DetailSpecs;
  task: { on_duplicate: 'error' | 'replace' | 'ignore'; task_mode: 'all' };
}
