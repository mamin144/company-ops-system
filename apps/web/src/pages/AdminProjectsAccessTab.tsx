import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Select, useToast, SkeletonTable, EmptyState } from '../components/ui';

export const AdminProjectsAccessTab = () => {
  const { user: currentUser } = useAuth();
  const showToast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, string>>({});
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const u = await api.get<any[]>('/api/users');
      setUsers(u);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!selectedUserId) {
      setProjects([]);
      setAccessMap({});
      return;
    }
    loadUserProjects(selectedUserId);
  }, [selectedUserId]);

  const loadUserProjects = async (userId: string) => {
    try {
      setLoadingProjects(true);
      const res = await api.get<any[]>(`/api/users/${userId}/projects`);
      setProjects(res);
      const m: Record<string, string> = {};
      res.forEach((p) => { m[p.projectId] = p.access; });
      setAccessMap(m);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAccessChange = (projectId: string, level: string) => {
    setAccessMap((prev) => ({ ...prev, [projectId]: level }));
  };

  const handleBulkAssign = (level: string) => {
    if (!confirm('سيحل هذا التعيين محل صلاحيات المشاريع الحالية لهذا المستخدم. هل أنت متأكد؟')) return;
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.projectId] = level; });
    setAccessMap(m);
  };

  const handleSave = async () => {
    if (!selectedUserId || selectedUserId === currentUser?.id) return;
    const payload = Object.entries(accessMap)
      .filter(([_, level]) => level !== 'NONE')
      .map(([projectId, access]) => ({ projectId, access }));
      
    try {
      await api.put(`/api/users/${selectedUserId}/projects`, { access: payload });
      showToast('success', 'تم حفظ صلاحيات المشاريع بنجاح');
      loadUserProjects(selectedUserId);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  if (loadingUsers) return <SkeletonTable />;

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h4>المستخدمين</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.5rem' }}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              style={{
                textAlign: 'right',
                padding: '0.5rem',
                border: 'none',
                background: selectedUserId === u.id ? '#e0f2fe' : 'transparent',
                color: selectedUserId === u.id ? '#0369a1' : 'inherit',
                cursor: 'pointer',
                borderRadius: '4px',
                fontWeight: selectedUserId === u.id ? 'bold' : 'normal',
              }}
            >
              {u.fullName} <br/><small className="muted">{u.username}</small>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {!selectedUserId ? (
          <EmptyState title="اختر مستخدم" hint="قم باختيار مستخدم من القائمة لإدارة صلاحيات المشاريع الخاصة به." />
        ) : loadingProjects ? (
          <SkeletonTable />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>صلاحيات المشاريع: {users.find(u => u.id === selectedUserId)?.fullName}</h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="small muted">تعيين للكل:</span>
                <Select onChange={(e) => handleBulkAssign(e.target.value)} value="" style={{ padding: '0.25rem' }}>
                  <option value="" disabled>اختر المستوى</option>
                  <option value="NONE">لا يوجد وصول (NONE)</option>
                  <option value="READ">قراءة فقط (READ)</option>
                  <option value="WRITE">كتابة (WRITE)</option>
                  <option value="DELETE">حذف (DELETE)</option>
                </Select>
                <button className="btn btn--primary" onClick={handleSave} disabled={selectedUserId === currentUser?.id}>حفظ التغييرات</button>
              </div>
            </div>
            
            {selectedUserId === currentUser?.id && (
              <div className="alert alert-warning" style={{ background: '#fef3c7', padding: '1rem', borderRadius: '4px' }}>لا يمكنك تعديل صلاحيات حسابك.</div>
            )}

            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'right' }}>
                  <th style={{ padding: '0.5rem' }}>كود المشروع</th>
                  <th style={{ padding: '0.5rem' }}>اسم المشروع</th>
                  <th style={{ padding: '0.5rem' }}>مستوى الوصول</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.projectId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem' }}>{p.projectCode}</td>
                    <td style={{ padding: '0.5rem' }}>{p.projectName}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <Select 
                        value={accessMap[p.projectId] || 'NONE'} 
                        onChange={(e) => handleAccessChange(p.projectId, e.target.value)}
                        disabled={selectedUserId === currentUser?.id}
                      >
                        <option value="NONE">لا يوجد (NONE)</option>
                        <option value="READ">قراءة (READ)</option>
                        <option value="WRITE">كتابة (WRITE)</option>
                        <option value="DELETE">حذف (DELETE)</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};