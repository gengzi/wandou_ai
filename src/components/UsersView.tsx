import React, { useEffect, useState } from 'react';
import { Search, Filter, UserPlus, MoreHorizontal, ShieldCheck, Mail, Activity, Package, X } from 'lucide-react';
import { getUserSummary, inviteUser, listUsersPage, UserPageResponse, UserResponse, UserSummaryResponse } from '../lib/api';

export default function UsersView() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [userPage, setUserPage] = useState<UserPageResponse>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    page: 0,
    size: 10,
  });
  const [loadingPage, setLoadingPage] = useState(false);
  const [summary, setSummary] = useState<UserSummaryResponse>({
    totalUsers: 0,
    adminUsers: 0,
    activeUsers: 0,
    permissionCount: 0,
  });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'viewer',
  });

  useEffect(() => {
    getUserSummary()
      .then(setSummary)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '用户汇总加载失败'));
  }, []);

  const refreshPage = () => {
    setLoadingPage(true);
    listUsersPage({
      keyword: query.trim(),
      role: roleFilter,
      status: statusFilter,
      page,
      size: pageSize,
    })
      .then(setUserPage)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '成员分页加载失败'))
      .finally(() => setLoadingPage(false));
  };

  useEffect(() => {
    refreshPage();
  }, [query, roleFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [query, roleFilter, statusFilter, pageSize]);

  const roleLabel = (user: UserResponse) => {
    const role = user.roles[0] || 'viewer';
    if (role === 'admin') return '管理员';
    if (role === 'editor') return '编辑者';
    return '查看者';
  };

  const activityLabel = (user: UserResponse) => {
    return user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '从未登录';
  };

  const filteredUsers = userPage.content;
  const totalPages = Math.max(1, userPage.totalPages || 1);
  const currentPage = Math.min(userPage.page, totalPages - 1);
  const pageStart = userPage.totalElements === 0 ? 0 : currentPage * userPage.size + 1;
  const pageEnd = Math.min(userPage.totalElements, currentPage * userPage.size + filteredUsers.length);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) {
      setError('请填写成员姓名和邮箱。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const user = await inviteUser({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setSummary((current) => ({
        ...current,
        totalUsers: current.totalUsers + 1,
        activeUsers: current.activeUsers + (user.status === 'active' ? 1 : 0),
        adminUsers: current.adminUsers + (user.roles.includes('admin') ? 1 : 0),
      }));
      setPage(0);
      refreshPage();
      setInviteForm({ name: '', email: '', role: 'viewer' });
      setShowInviteForm(false);
      setNotice('成员已邀请。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '邀请失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wandou-admin-page h-full flex flex-col bg-[#0B0B0C] text-slate-200 p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">用户管理</h1>
          <p className="text-sm text-slate-400">管理团队成员、权限分配及订阅计划</p>
        </div>
        <button onClick={() => setShowInviteForm(true)} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
          <UserPlus size={16} />
          <span>邀请成员</span>
        </button>
      </header>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '总用户数', value: summary.totalUsers.toString(), icon: <UserPlus className="text-blue-400" /> },
          { label: '管理员', value: summary.adminUsers.toString(), icon: <Package className="text-brand" /> },
          { label: '当前启用', value: summary.activeUsers.toString(), icon: <Activity className="text-green-400" /> },
          { label: '权限点', value: summary.permissionCount.toString(), icon: <Mail className="text-yellow-400" /> },
        ].map(stat => (
          <div key={stat.label} className="wandou-page-card bg-[#1A1A1C] border border-white/5 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">成员列表</h3>
        <div className="flex space-x-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand transition-colors" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="text" placeholder="搜索邮箱或名称..." className="wandou-page-control w-64 bg-[#1A1A1C] border border-white/5 focus:border-brand/50 rounded-lg pl-9 pr-4 py-2 outline-none text-sm transition-all" />
          </div>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="wandou-page-control rounded-lg border border-white/5 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand/50">
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="editor">编辑者</option>
            <option value="viewer">查看者</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="wandou-page-control rounded-lg border border-white/5 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand/50">
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </select>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="wandou-page-control rounded-lg border border-white/5 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand/50">
            <option value={10}>10 / 页</option>
            <option value={20}>20 / 页</option>
            <option value={50}>50 / 页</option>
          </select>
          <button onClick={() => setNotice('高级筛选、角色修改和禁用操作需要后端用户管理接口，当前支持本地筛选。')} className="wandou-page-control px-3 py-2 border border-white/5 rounded-lg bg-[#1A1A1C] hover:bg-white/5 text-slate-300 text-sm flex items-center space-x-2 transition-colors">
            <Filter size={16} />
            <span>筛选</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs font-semibold text-slate-300 hover:text-white">关闭</button>
        </div>
      )}

      {showInviteForm && (
        <form onSubmit={handleInvite} className="wandou-page-panel mb-5 rounded-xl border border-white/10 bg-[#121213] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">邀请成员</h2>
            <button type="button" onClick={() => setShowInviteForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <input value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} className="wandou-page-control rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="邮箱" />
            <input value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} className="wandou-page-control rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="姓名" />
            <select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })} className="wandou-page-control rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
              <option value="viewer">查看者</option>
              <option value="editor">编辑者</option>
              <option value="admin">管理员</option>
            </select>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60">{saving ? '邀请中...' : '发送邀请'}</button>
          </div>
        </form>
      )}

      <div className="wandou-page-table flex-1 bg-[#121213] border border-white/5 rounded-2xl overflow-hidden">
        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500 bg-white/5">
              <th className="px-6 py-3 font-medium uppercase">用户</th>
              <th className="px-6 py-3 font-medium uppercase">权限</th>
              <th className="px-6 py-3 font-medium uppercase">计划</th>
              <th className="px-6 py-3 font-medium uppercase">状态</th>
              <th className="px-6 py-3 font-medium uppercase">上次活跃</th>
              <th className="px-6 py-3 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loadingPage ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  正在加载成员...
                </td>
              </tr>
            ) : filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td className="px-6 py-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand/80 to-blue-500/80 flex items-center justify-center font-bold text-white shadow-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-2.5">
                  <div className="flex items-center space-x-1.5 text-sm">
                    {user.roles.includes('admin') && <ShieldCheck size={14} className="text-brand" />}
                    <span className={user.roles.includes('admin') ? 'text-brand font-medium' : 'text-slate-300'}>{roleLabel(user)}</span>
                  </div>
                </td>
                <td className="px-6 py-2.5">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${user.roles.includes('admin') ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : user.roles.includes('editor') ? 'border-brand/30 text-brand bg-brand/10' : 'border-slate-500/30 text-slate-400 bg-slate-500/10'}`}>
                    {user.permissions.length} 个权限
                  </span>
                </td>
                <td className="px-6 py-2.5">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-brand' : 'bg-slate-600'}`} />
                    <span className="text-sm text-slate-400">{user.status === 'active' ? '启用' : '停用'}</span>
                  </div>
                </td>
                <td className="px-6 py-2.5 text-sm text-slate-400">{activityLabel(user)}</td>
                <td className="px-6 py-2.5">
                  <button onClick={() => setNotice('角色修改、禁用和删除成员需要后端用户管理接口。')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!loadingPage && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  没有匹配当前搜索和筛选条件的成员。
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-6 py-3 text-sm text-slate-400">
          <div>
            {userPage.totalElements > 0
              ? `显示 ${pageStart}-${pageEnd} / ${userPage.totalElements}`
              : '暂无成员'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(0)}
              disabled={currentPage === 0 || loadingPage}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              首页
            </button>
            <button
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={currentPage === 0 || loadingPage}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <span className="min-w-[86px] text-center text-slate-500">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              disabled={currentPage >= totalPages - 1 || loadingPage}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1 || loadingPage}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              末页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
