export type Id = string;

export interface BaseEntity {
  id: Id;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type ProjectStatus = 'planned' | 'active' | 'on-hold' | 'completed' | 'cancelled';
export type WarehouseType = 'central' | 'site';
export type WarehouseStatus = 'active' | 'inactive';
export type StockTransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
export type DocumentCategoryName = string;

export interface Project extends BaseEntity {
  projectCode: string;
  projectName: string;
  client: string;
  /** الجهة المالكة للمشروع — منفصلة عن العميل (client) */
  owner: string;
  mainContractor: string;
  siteLocation: string;
  region?: string;
  contractNumber: string;
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  role?: CompanyRole;
  notes?: string;
}

export type CompanyRole = 'main-contractor' | 'subcontractor' | 'direct-contractor';

export interface Site extends BaseEntity {
  projectId: Id;
  code: string;
  name: string;
  location?: string;
  notes?: string;
}

export type DocumentStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'archived';

export interface DocumentRevision {
  id: Id;
  revision: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  filePath: string;
  uploadedBy?: string;
  uploadedAt: string;
  notes?: string;
}

export interface DocumentLink {
  id: Id;
  documentId: Id;
  entityType: string;
  entityId: Id;
  createdAt: string;
}

export interface Folder {
  id: Id;
  parentId?: Id;
  name: string;
  color?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document extends BaseEntity {
  projectId?: Id;
  siteId?: Id;
  ipcId?: Id;
  folderId?: Id;
  title: string;
  documentNumber?: string;
  category: string;
  documentType: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  filePath: string;
  revision: string;
  documentDate?: string;
  uploadedBy?: string;
  status: DocumentStatus;
  revisions: DocumentRevision[];
  links?: DocumentLink[];
  notes?: string;
  tags: string[];
}

export interface Warehouse extends BaseEntity {
  code: string;
  name: string;
  type: WarehouseType;
  projectId?: Id;
  location?: string;
  status: WarehouseStatus;
  notes?: string;
}

export type TrackingType = 'none' | 'batch' | 'serial';

export interface Item extends BaseEntity {
  code: string;
  name: string;
  category: string;
  unit: string;
  brand?: string;
  minimumStock?: number;
  trackingType?: TrackingType;
  notes?: string;
}

export interface StockTransactionLine {
  itemId: Id;
  quantity: number;
  unitCost?: number;
}

export interface StockTransaction extends BaseEntity {
  number?: string;
  type: StockTransactionType;
  items?: StockTransactionLine[];
  legacy?: { itemId: Id; quantity: number; unitCost?: number };
  warehouseId: Id;
  destinationWarehouseId?: Id;
  projectId?: Id;
  itemId?: Id;
  quantity?: number;
  unitCost?: number;
  referenceNumber?: string;
  date: string;
  notes?: string;
}

export type MaterialRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'partially-issued'
  | 'issued'
  | 'closed';

export interface MaterialRequestLine {
  itemId: Id;
  requestedQty: number;
  issuedQty?: number;
  notes?: string;
}

export interface MaterialRequest extends BaseEntity {
  number: string;
  projectId?: Id;
  siteId?: Id;
  warehouseId: Id;
  status: MaterialRequestStatus;
  items: MaterialRequestLine[];
  requestedBy?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  notes?: string;
}

export type UserRoleName = 'admin' | 'management' | 'warehouse' | 'technical' | 'viewer';

export interface Role extends BaseEntity {
  name: string;
  nameAr: string;
  permissions: string[];
  isSystem?: boolean;
}

export interface User extends BaseEntity {
  username: string;
  fullName: string;
  passwordHash: string;
  roleName: UserRoleName;
  isActive: boolean;
}

export type SafeUser = Omit<User, 'passwordHash'> & { permissions: string[] };

export interface AuditLog {
  id: Id;
  userId?: string;
  username?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
  ipAddress?: string;
}

export type NotificationType = 'low-stock' | 'document-status' | 'system' | 'material-request';

export interface AppNotification {
  id: Id;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
  userId?: string;
  readBy: string[];
  createdAt: string;
}

export interface ImportHistoryEntry {
  id: Id;
  entity: string;
  fileName: string;
  userId?: string;
  username?: string;
  date: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: string[];
}

export interface CategoryOption extends BaseEntity {
  code: string;
  name: string;
  group: 'document-category' | 'item-category' | 'warehouse-type' | 'document-type';
  isActive: boolean;
}

export interface UnitOption extends BaseEntity {
  code: string;
  name: string;
  isActive: boolean;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  q?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
export interface BoqItem extends BaseEntity {
  projectId: Id;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type IpcStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface Ipc extends BaseEntity {
  projectId: Id;
  ipcNumber: number;
  date: string;
  status: IpcStatus;
  notes?: string;
  netAmount?: number;
  deductions?: number;
}

export interface IpcItem extends BaseEntity {
  ipcId: Id;
  boqItemId: Id;
  previousQuantity: number;
  currentQuantity: number;
  totalQuantity: number;
}
