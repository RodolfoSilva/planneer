import { formatDateISO } from '@planneer/shared';

interface ScheduleWithRelations {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  project: {
    name: string;
    organization: {
      name: string;
    };
  };
  activities: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    duration: number;
    startDate: string | null;
    endDate: string | null;
    wbs: { id: string; code: string; name: string } | null;
    predecessors: Array<{
      id: string;
      type: string;
      lag: number;
      predecessorId: string;
    }>;
    resourceAssignments: Array<{
      units: number;
      resource: { id: string; code: string; name: string };
    }>;
  }>;
  wbsItems: Array<{
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    level: number;
  }>;
}

export async function generateXER(schedule: ScheduleWithRelations): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = formatDateISO(now);
  
  // XER file header
  lines.push('ERMHDR\t19.12.0\t2024-01-01\tProject\tASCII\tPlanneer');
  lines.push('');
  
  // Project table
  lines.push('%T\tPROJECT');
  lines.push('%F\tproj_id\tproj_short_name\twbs_max_sum_level\tsum_base_proj_id\toriginal_qty\tlast_fin_dates_id\tfintmpl_id\tlast_baseline_update_date\tlast_recalc_date\tplan_end_date\tscd_end_date\tadd_date\tlast_tasksum_date\tfcst_start_date\tsum_assign_level\ttask_code_base\ttask_code_step\tpriority_num\twbs_code_sep\twbs_code_sep_char\tproj_flag_prio_type\ttask_code_prefix\tdef_cost_per_qty\tadd_act_remain_flag\task_type\tsum_only_flag\tgpuser_name\trsrc_self_add_flag\tallow_complete_flag\tuse_project_baseline_flag\tsum_data_flag\tcontrol_updates_flag\tallowNegativeActualUnitsFlag\tis_secured_project\tuse_expect_end_flag\tallow_neg_act_flag\tact_pct_link_flag\tadd_by_name\tchkout_status');
  lines.push(`%R\t${schedule.id}\t${schedule.project.name}\t0\t\t0\t\t\t\t${dateStr}\t${schedule.endDate || dateStr}\t${schedule.endDate || dateStr}\t${dateStr}\t\t${schedule.startDate || dateStr}\t1\t1000\t10\t500\tYES\t.\tN\t\t0\tN\tPT\tN\t\tN\tY\tN\tN\tN\tN\tN\tN\tN\tN\t${schedule.project.organization.name}\t`);
  lines.push('');
  
  // WBS table
  lines.push('%T\tPROJWBS');
  lines.push('%F\twbs_id\tproj_id\tobs_id\tseq_num\test_wt\tproj_node_flag\tsum_data_flag\tstatus_code\twbs_short_name\twbs_name\tphase_id\tparent_wbs_id\tev_user_pct\tev_etc_user_value\torig_cost\tindep_remain_total_cost\tann_dscnt_rate_pct\tdscnt_period_type\tindep_remain_work_qty\tanticip_start_date\tanticip_end_date\tev_compute_type\tev_etc_compute_type\tguid\ttmpl_guid\tplan_open_state');
  
  let wbsIndex = 1;
  const wbsIdMap = new Map<string, number>();
  
  // Add root WBS
  const rootWbsId = wbsIndex++;
  lines.push(`%R\t${rootWbsId}\t${schedule.id}\t\t1\t1\tY\tN\t\t${schedule.name}\t${schedule.name}\t\t\t0\t0\t0\t0\t0\tM\t0\t\t\tET\tCP\t${schedule.id}\t\t`);
  
  for (const wbs of schedule.wbsItems) {
    const wbsId = wbsIndex++;
    wbsIdMap.set(wbs.id, wbsId);
    const parentId = wbs.parentId ? wbsIdMap.get(wbs.parentId) : rootWbsId;
    
    lines.push(`%R\t${wbsId}\t${schedule.id}\t\t${wbs.level}\t1\tN\tN\t\t${wbs.code}\t${wbs.name}\t\t${parentId}\t0\t0\t0\t0\t0\tM\t0\t\t\tET\tCP\t${wbs.id}\t\t`);
  }
  lines.push('');
  
  // Calendar table
  lines.push('%T\tCALENDAR');
  lines.push('%F\tclndr_id\tdefault_flag\tclndr_name\tproj_id\tbase_clndr_id\tlast_chng_date\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tmonth_hr_cnt\tyear_hr_cnt\trsrc_private\tclndr_data');
  lines.push(`%R\t1\tY\tStandard\t${schedule.id}\t\t${dateStr}\tCA\t8\t40\t172\t2000\tN\t(0||0||0||0||0||0||0||0||0||0||0||0||0||0||0||0||0||0||0||)`);
  lines.push('');
  
  // Task table
  lines.push('%T\tTASK');
  lines.push('%F\ttask_id\tproj_id\twbs_id\tclndr_id\tphys_complete_pct\trev_fdbk_flag\test_wt\tlock_plan_flag\tauto_compute_act_flag\tcomplete_pct_type\ttask_type\tduration_type\tstatus_code\ttask_code\ttask_name\trsrc_id\ttotal_float_hr_cnt\tfree_float_hr_cnt\tremain_drtn_hr_cnt\tact_work_qty\tremain_work_qty\ttarget_work_qty\ttarget_drtn_hr_cnt\ttarget_equip_qty\tact_equip_qty\tremain_equip_qty\tcstr_date\tact_start_date\tact_end_date\tlate_start_date\tlate_end_date\texpect_end_date\tearly_start_date\tearly_end_date\trestart_date\treend_date\ttarget_start_date\ttarget_end_date\trem_late_start_date\trem_late_end_date\tcstr_type\tpriority_type\tsuspend_date\tresume_date\tfloat_path\tfloat_path_order\tguid\ttmpl_guid\tcstr_date2\tcstr_type2\tdriving_path_flag\tact_this_per_work_qty\tact_this_per_equip_qty\texternal_early_start_date\texternal_late_end_date\tcreate_date\tupdate_date\tcreate_user\tupdate_user\tlocation_id');
  
  let taskIndex = 1;
  const taskIdMap = new Map<string, number>();
  
  for (const activity of schedule.activities) {
    const taskId = taskIndex++;
    taskIdMap.set(activity.id, taskId);
    
    const wbsId = activity.wbs ? wbsIdMap.get(activity.wbs.id) || rootWbsId : rootWbsId;
    const durationHours = activity.duration * 8;
    const startDate = activity.startDate || schedule.startDate || dateStr;
    const endDate = activity.endDate || schedule.endDate || dateStr;
    
    lines.push(`%R\t${taskId}\t${schedule.id}\t${wbsId}\t1\t0\tN\t1\tN\tY\tCP\tTT_Task\tFT\t\t${activity.code}\t${activity.name}\t\t0\t0\t${durationHours}\t0\t${durationHours}\t${durationHours}\t${durationHours}\t0\t0\t0\t\t\t\t${endDate}\t${endDate}\t\t${startDate}\t${endDate}\t\t\t${startDate}\t${endDate}\t${endDate}\t${endDate}\t\tP500\t\t\t\t0\t${activity.id}\t\t\t\tN\t0\t0\t\t\t${dateStr}\t${dateStr}\t\t\t`);
  }
  lines.push('');
  
  // Task predecessor table
  lines.push('%T\tTASKPRED');
  lines.push('%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt\tcomments\taref\tarls');
  
  let predIndex = 1;
  for (const activity of schedule.activities) {
    const taskId = taskIdMap.get(activity.id);
    
    for (const pred of activity.predecessors) {
      const predTaskId = taskIdMap.get(pred.predecessorId);
      if (predTaskId) {
        const lagHours = pred.lag * 8;
        lines.push(`%R\t${predIndex++}\t${taskId}\t${predTaskId}\t${schedule.id}\t${schedule.id}\t${pred.type}\t${lagHours}\t\t\t`);
      }
    }
  }
  lines.push('');
  
  // Resource table (if any)
  const uniqueResources = new Map<string, { id: string; code: string; name: string }>();
  for (const activity of schedule.activities) {
    for (const assignment of activity.resourceAssignments) {
      uniqueResources.set(assignment.resource.id, assignment.resource);
    }
  }
  
  if (uniqueResources.size > 0) {
    lines.push('%T\tRSRC');
    lines.push('%F\trsrc_id\tparent_rsrc_id\tclndr_id\trole_id\tshift_id\tuser_id\tpobs_id\tguid\trsrc_seq_num\temail_addr\temploy_code\toffice_phone\tother_phone\trsrc_name\trsrc_short_name\trsrc_title_name\tdef_qty_per_hr\tcost_qty_type\tot_factor\tot_flag\tcurr_id\tunit_id\trsrc_type\tlocation_id\tauto_compute_act_flag\tdef_cost_qty_link_flag\toa_guid\tdef_cost_per_qty\tdef_cost_per_qty2\tdef_cost_per_qty3\tdef_cost_per_qty4\tdef_cost_per_qty5');
    
    let rsrcIndex = 1;
    for (const rsrc of uniqueResources.values()) {
      lines.push(`%R\t${rsrcIndex++}\t\t1\t\t\t\t\t${rsrc.id}\t${rsrcIndex}\t\t${rsrc.code}\t\t\t${rsrc.name}\t${rsrc.code}\t\t1\tQT\t1\tN\t\t\tRT_Labor\t\tY\tY\t\t0\t0\t0\t0\t0`);
    }
    lines.push('');
  }
  
  // End of file
  lines.push('%E');
  
  return lines.join('\n');
}



