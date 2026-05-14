import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, UserPlus, MoreHorizontal, ShieldCheck, Mail, Activity, Package } from 'lucide-react';
import { inviteUser, listUsers, UserResponse } from '../lib/api';

export default function UsersView() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '用户列表加载失败'));
  }, []);

  const activeUsers = useMemo(() => users.filter((user) => user.status === 'active'), [users]);

  const roleLabel = (user: UserResponse) => {
    const role = user.roles[0] || 'viewer';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const activityLabel = (user: UserResponse) => {
    return user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '从未登录';
  };

  const handleInvite = async () => {
    const email = window.prompt('请输入成员邮箱');
    if (!email) return;
    const name = window.prompt('请输入成员姓名', email.split('@')[0]) || email.split('@')[0];
    setError(null);
    try {
      const user = await inviteUser({ name, email, role: 'viewer' });
      setUsers((current) => [user, ...current.filter((item) => item.id !== user.id)]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '邀请失败');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0B0C] text-slate-200 p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">用户管理 (Users Directory)</h1>
          <p className="text-sm text-slate-400">管理团队成员、权限分配及订阅计划</p>
        </div>
        <button onClick={handleInvite} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
          <UserPlus size={16} />
          <span>邀请成员</span>
        </button>
      </header>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '总用户数', value: users.length.toString(), icon: <UserPlus className="text-blue-400" /> },
          { label: '管理员', value: users.filter((user) => user.roles.includes('admin')).length.toString(), icon: <Package className="text-brand" /> },
          { label: '当前启用', value: activeUsers.length.toString(), icon: <Activity className="text-green-400" /> },
          { label: '权限点', value: new Set(users.flatMap((user) => user.permissions)).size.toString(), icon: <Mail className="text-yellow-400" /> },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1A1A1C] border border-white/5 rounded-xl p-5 flex items-center justify-between">
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
            <input type="text" placeholder="搜索邮箱或名称..." className="w-64 bg-[#1A1A1C] border border-white/5 focus:border-brand/50 rounded-lg pl-9 pr-4 py-2 outline-none text-sm transition-all" />
          </div>
          <button className="px-3 py-2 border border-white/5 rounded-lg bg-[#1A1A1C] hover:bg-white/5 text-slate-300 text-sm flex items-center space-x-2 transition-colors">
            <Filter size={16} />
            <span>筛选</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#121213] border border-white/5 rounded-2xl overflow-hidden">
        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500 bg-white/5">
              <th className="px-6 py-4 font-medium uppercase">用户</th>
              <th className="px-6 py-4 font-medium uppercase">权限</th>
              <th className="px-6 py-4 font-medium uppercase">计划</th>
              <th className="px-6 py-4 font-medium uppercase">状态</th>
              <th className="px-6 py-4 font-medium uppercase">上次活跃</th>
              <th className="px-6 py-4 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4">
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
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-1.5 text-sm">
                    {user.roles.includes('admin') && <ShieldCheck size={14} className="text-brand" />}
                    <span className={user.roles.includes('admin') ? 'text-brand font-medium' : 'text-slate-300'}>{roleLabel(user)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${user.roles.includes('admin') ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : user.roles.includes('editor') ? 'border-brand/30 text-brand bg-brand/10' : 'border-slate-500/30 text-slate-400 bg-slate-500/10'}`}>
                    {user.permissions.length} permissions
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-brand' : 'bg-slate-600'}`} />
                    <span className="text-sm text-slate-400">{user.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">{activityLabel(user)}</td>
                <td className="px-6 py-4">
                  <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
