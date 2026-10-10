export const PROJECT_PERMISSION_KEYS = [
  "view_project","view_timeline","edit_timeline","view_documents","upload_documents",
  "view_costs","view_people","manage_people","view_field","submit_field",
  "view_safety","manage_project","manage_vendors","manage_access",
] as const;
export type ProjectPermission = typeof PROJECT_PERMISSION_KEYS[number];
export type ProjectRole = "owner" | "admin" | "project_manager" | "superintendent" | "safety" | "finance" | "field" | "viewer";
export type PermissionSet = Record<ProjectPermission, boolean>;

export const PERMISSION_LABELS: Record<ProjectPermission,string> = {
  view_project:"Open project",
  view_timeline:"View project timeline",
  edit_timeline:"Edit schedule / timeline",
  view_documents:"Read project documents",
  upload_documents:"Upload / update evidence",
  view_costs:"View budgets and costs",
  view_people:"View project contacts",
  manage_people:"Edit project contacts",
  view_field:"Review incoming field reports",
  submit_field:"Submit reports from the field",
  view_safety:"Access detailed safety / injury records",
  manage_project:"Edit project configuration",
  manage_vendors:"Manage vendors and compliance",
  manage_access:"Allocate user access",
};
export const ROLE_LABELS: Record<ProjectRole,string> = {
  owner:"Organization owner", admin:"Project administrator", project_manager:"Project manager",
  superintendent:"Superintendent", safety:"Safety officer", finance:"Finance",
  field:"Field reporter", viewer:"Viewer",
};
const MEMBER_DEFAULTS: Record<Exclude<ProjectRole,"owner"|"admin">,readonly ProjectPermission[]> = {
  project_manager:["view_project","view_timeline","edit_timeline","view_documents","upload_documents","view_costs","view_people","manage_people","view_field","submit_field","manage_project","manage_vendors"],
  superintendent:["view_project","view_timeline","edit_timeline","view_documents","upload_documents","view_people","view_field","submit_field","view_safety"],
  safety:["view_project","view_timeline","view_documents","upload_documents","view_people","view_field","submit_field","view_safety"],
  finance:["view_project","view_timeline","view_documents","view_costs"],
  field:["view_project","submit_field"],
  viewer:["view_project","view_timeline"],
};
export const EMPTY_PERMISSIONS = Object.fromEntries(PROJECT_PERMISSION_KEYS.map(p=>[p,false])) as PermissionSet;
export function roleDefault(role:ProjectRole,permission:ProjectPermission):boolean {
  if(role==="owner"||role==="admin")return true;
  return MEMBER_DEFAULTS[role]?.includes(permission)??false;
}
export function effectiveRolePermissions(role:ProjectRole,overrides:Partial<Record<ProjectPermission,boolean>>):PermissionSet {
  return Object.fromEntries(PROJECT_PERMISSION_KEYS.map(p=>[p,
    p==="manage_access"?roleDefault(role,p):overrides[p]??roleDefault(role,p)
  ])) as PermissionSet;
}
