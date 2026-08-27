import type { DetailBase, DetailClusters } from '../common';

/**
 * MySQL DTS 同名迁移
 */

export interface DtsDataMigrate extends DetailBase {
  clusters: DetailClusters;
  conflict_handle: 'overwrite' | 'keep' | 'error';
  infos: {
    ignore_db_list: string[];
    ignore_table_list: string[];
    resource_spec: {
      spec_id: number;
    };
    source_cluster: number;
    source_db_list: string[];
    source_table_list: string[];
    target_cluster: number;
  }[];
}
