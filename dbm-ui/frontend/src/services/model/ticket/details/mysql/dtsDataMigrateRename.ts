import type { DetailBase, DetailClusters } from '../common';

/**
 * MySQL DTS 库改名迁移
 */

export interface DtsDataMigrateRename extends DetailBase {
  clusters: DetailClusters;
  conflict_handle: 'overwrite' | 'keep' | 'error';
  infos: {
    db_mapping: {
      source_db: string;
      target_db: string;
    }[];
    resource_spec: {
      spec_id: number;
    };
    source_cluster: number;
    target_cluster: number;
  }[];
}
