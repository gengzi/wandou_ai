import React from 'react';
import { Search, Filter, UserPlus, MoreHorizontal, ShieldCheck, Mail, Activity, Package } from 'lucide-react';

export default function UsersView() {
  const users = [
    { id: 1, name: 'Alice Wang', email: 'alice.wang@example.com', role: 'Admin', plan: 'Enterprise', status: 'Active', activity: 'Just now' },
    { id: 2, name: 'Bob Chen', email: 'bob.chen@example.com', role: 'Editor', plan: 'Pro', status: 'Active', activity: '2 hrs ago' },
    { id: 3, name: 'Charlie Lin', email: 'charlie.lin@example.com', role: 'Viewer', plan: 'Free', status: 'Inactive', activity: '5 days ago' },
    { id: 4, name: 'Diana Hsu', email: 'diana.hsu@example.com', role: 'Editor', plan: 'Pro', status: 'Active', activity: 'yesterday' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0B0B0C] text-slate-200 p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">用户管理 (Users Directory)</h1>
          <p className="text-sm text-slate-400">管理团队成员、权限分配及订阅计划</p>
        </div>
        <button className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
          <UserPlus size={16} />
          <span>邀请成员</span>
        </button>
      </header>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '总用户数', value: '1,248', icon: <UserPlus className="text-blue-400" /> },
          { label: 'Pro 订阅用户', value: '842', icon: <Package className="text-brand" /> },
          { label: '本周活跃', value: '1,021', icon: <Activity className="text-green-400" /> },
          { label: '待处理邀请', value: '12', icon: <Mail className="text-yellow-400" /> },
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
                    {user.role === 'Admin' && <ShieldCheck size={14} className="text-brand" />}
                    <span className={user.role === 'Admin' ? 'text-brand font-medium' : 'text-slate-300'}>{user.role}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${user.plan === 'Enterprise' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : user.plan === 'Pro' ? 'border-brand/30 text-brand bg-brand/10' : 'border-slate-500/30 text-slate-400 bg-slate-500/10'}`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-brand' : 'bg-slate-600'}`} />
                    <span className="text-sm text-slate-400">{user.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">{user.activity}</td>
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
