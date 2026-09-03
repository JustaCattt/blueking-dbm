import type { DetailBase, DetailClusters } from '../common';

/**
 * MySQL DTS 同名迁移
 */

export interface DtsDataMigrate extends DetailBase {
  clusters?: DetailClusters;
  infos: {
    dts_resource: {
      deploy: {
        cluster_name: string;
        deploy_path: string;
        master_ha: boolean;
      };
      mode: string | null;
    };
    migrate: {
      one_to_one: {
        source: {
          cluster_id: number;
          sync_scope: {
            do_dbs: string[];
            do_tables: string[];
            ignore_dbs: string[];
            ignore_tables: string[];
          };
        };
        target: {
          cluster_id: number;
          target_spider?: string | null;
        };
        task_name: string;
      };
      topology: 'one_to_one';
    };
    resource_spec: {
      master: {
        count: number;
        label_names?: string[];
        labels?: string[];
        spec_id: number;
        spec_name?: string;
      };
      worker: {
        count: number;
        label_names?: string[];
        labels?: string[];
        spec_id: number;
        spec_name?: string;
      };
    };
  }[];
  task: {
    on_duplicate: 'error' | 'replace' | 'ignore';
  };
}
