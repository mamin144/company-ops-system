// Pure contract types (type-only layer, erased at build time — importing this
// module does NOT pull the mock adapter into any bundle). Screens should use
// these for typing props/state; adapters own the runtime values.
export type {
  Project, Site, DocRev, Doc, Warehouse, Item, TxnType, TxnLine, Txn,
  MRLine, MR, Notif, Audit, BoqItem, IpcStatus, Ipc, IpcLine,
  AccessLevel, OverrideEffect, MockUser,
} from './adapters/mock/data';
export type {
  ReportDef, ExportFormat, ExportFilter, ExportResult, StockFilter, MRAction,
} from './adapters/mock/api';
