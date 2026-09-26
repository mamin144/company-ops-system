import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { AdminUsersTab } from './AdminUsersTab';
import { AdminRolesTab } from './AdminRolesTab';
import { AdminProjectsAccessTab } from './AdminProjectsAccessTab';

export const AdminPage = () => {
  const { can } = useAuth();
  const location = useLocation();

  const canManageUsers = can('users.manage');
  const canManageRoles = can('roles.manage');
  const canManageProjectsAccess = can('projects.access');

  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    if (canManageUsers) return <Navigate to="/admin/users" replace />;
    if (canManageRoles) return <Navigate to="/admin/roles" replace />;
    if (canManageProjectsAccess) return <Navigate to="/admin/projects" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page admin-shell">
      <div className="pageHeader">
        <h1 className="pageTitle">الإدارة</h1>
      </div>
      <div className="tabs">
        {canManageUsers && (
          <NavLink to="/admin/users" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            المستخدمين
          </NavLink>
        )}
        {canManageRoles && (
          <NavLink to="/admin/roles" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            الأدوار
          </NavLink>
        )}
        {canManageProjectsAccess && (
          <NavLink to="/admin/projects" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            صلاحيات المشاريع
          </NavLink>
        )}
      </div>

      <div className="admin-content" style={{ marginTop: '1.5rem' }}>
        <Routes>
          {canManageUsers && <Route path="users" element={<AdminUsersTab />} />}
          {canManageRoles && <Route path="roles" element={<AdminRolesTab />} />}
          {canManageProjectsAccess && <Route path="projects" element={<AdminProjectsAccessTab />} />}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};