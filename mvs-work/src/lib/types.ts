export type HandoverJob = {
  id: string;
  owner_id: string;
  organization_name: string;
  industry: string | null;
  organization_context: string | null;
  job_title: string;
  department: string | null;
  trainee_level: string | null;
  training_days: number | null;
  job_importance: string | null;
  daily_workflow: string | null;
  main_tasks: string | null;
  critical_tasks: string | null;
  handover_rules: string | null;
  do_not_do: string | null;
  common_mistakes: string | null;
  common_situations: string | null;
  required_tools: string | null;
  success_criteria: string | null;
  final_goal: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

export type HandoverProject = {
  id: string;
  job_id: string;
  owner_id: string;
  title: string;
  summary: string | null;
  generated_json: GeneratedHandover;
  status: string | null;
  created_at: string;
  updated_at: string;
};

export type GeneratedHandover = {
  jobUnderstanding?: Record<string, unknown>;
  workflow?: Array<Record<string, unknown>>;
  handoverManual?: Array<Record<string, unknown>>;
  checklists?: Array<Record<string, unknown>>;
  trainingProjects?: Array<Record<string, unknown>>;
  simulations?: Array<Record<string, unknown>>;
  rubric?: Record<string, unknown>;
  finalReportTemplate?: Record<string, unknown>;
};
