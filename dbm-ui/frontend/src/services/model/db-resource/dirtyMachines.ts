export default class DirtyMachines {
  bk_biz_id: number;
  bk_biz_name: string;
  bk_cloud_id: number;
  bk_cloud_name: string;
  bk_host_id: number;
  bk_module_infos: {
    bk_module_id: number;
    bk_module_name: number;
  }[];
  ip: string;
  is_dirty: boolean;
  task_id: string;
  ticket_id: number;
  ticket_type: string;
  ticket_type_display: string;
  operator: string;
  permission: {
    dirty_pool_manage: boolean;
    flow_detail: boolean;
    ticket_view: boolean;
  };

  constructor(payload = {} as DirtyMachines) {
    this.bk_biz_id = payload.bk_biz_id;
    this.bk_biz_name = payload.bk_biz_name;
    this.bk_cloud_id = payload.bk_cloud_id;
    this.bk_cloud_name = payload.bk_cloud_name;
    this.bk_host_id = payload.bk_host_id;
    this.bk_module_infos = payload.bk_module_infos ?? [];
    this.ip = payload.ip;
    this.is_dirty = payload.is_dirty;
    this.task_id = payload.task_id;
    this.ticket_id = payload.ticket_id;
    this.ticket_type = payload.ticket_type;
    this.ticket_type_display = payload.ticket_type_display;
    this.operator = payload.operator;
    this.permission = payload.permission;
  }
}
