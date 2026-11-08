import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Shield, Check, X, Plus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const ALL_PERMISSIONS = [
  { id: 'view_conversations', label: 'View Conversations' },
  { id: 'edit_conversations', label: 'Edit Conversations & Reply' },
  { id: 'manage_agents', label: 'Manage Agents' },
  { id: 'manage_roles', label: 'Manage Custom Roles' },
  { id: 'publish_posts', label: 'Publish Social Posts' },
];

export default function SettingsTab({ currentAgent }) {
  const [activeTab, setActiveTab] = useState('roles');
  
  // State for Roles
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  
  // State for Agents
  const [agents, setAgents] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '', role_id: '' });

  const [hasConnections, setHasConnections] = useState(null);

  useEffect(() => {
    const agentId = currentAgent?.id;
    if (!agentId) { setHasConnections(true); return; }
    fetch(`${API_URL}/api/integrations/status?agentId=${agentId}`)
      .then(r => r.json())
      .then(data => {
        const connected = data.fbConnected || data.igConnected || (data.connections?.length > 0);
        setHasConnections(connected);
      })
      .catch(() => setHasConnections(true));
  }, [currentAgent]);

  useEffect(() => {
    if (hasConnections) {
      fetchRoles();
      fetchAgents();
    }
  }, [hasConnections]);

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/roles`);
      setRoles(res.data);
    } catch (e) { console.error('Failed to fetch roles', e); }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agents`);
      setAgents(res.data);
      setPendingRoles({});
    } catch (e) { console.error('Failed to fetch agents', e); }
  };

  const saveRole = async (role) => {
    try {
      if (role.id) {
        await axios.put(`${API_URL}/api/roles/${role.id}`, role);
      } else {
        await axios.post(`${API_URL}/api/roles`, role);
      }
      setEditingRole(null);
      fetchRoles();
    } catch (e) { console.error('Failed to save role', e); }
  };

  const deleteRole = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/roles/${id}`);
      fetchRoles();
    } catch (e) { console.error('Failed to delete role', e); }
  };

  const saveAgentRoles = async () => {
    try {
      for (const [agentId, roleId] of Object.entries(pendingRoles)) {
        await axios.put(`${API_URL}/api/agents/${agentId}`, { role_id: roleId || null });
      }
      fetchAgents();
      // Refresh own session in case current agent's role was changed by another admin
      const storedToken = localStorage.getItem('agentToken');
      if (storedToken) {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } });
        if (res.ok) {
          const freshAgent = await res.json();
          localStorage.setItem('currentAgent', JSON.stringify(freshAgent));
          window.location.reload(); // reload so App reads fresh currentAgent
        }
      }
    } catch (e) { console.error('Failed to update agent roles', e); }
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.email) return;
    try {
      await axios.post(`${API_URL}/api/agents`, newAgent);
      setIsAddingAgent(false);
      setNewAgent({ name: '', email: '', password: '', role_id: '' });
      fetchAgents();
    } catch(e) { console.error('Failed to create agent', e); }
  };

  const deleteAgent = async (id) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    try {
      await axios.delete(`${API_URL}/api/agents/${id}`);
      fetchAgents();
    } catch(e) { console.error('Failed to delete agent', e); }
  };

  const hasPerm = (perm) => {
    // Treat 'Admin' role as having all permissions by default, or just check the array
    if (currentAgent?.role?.toLowerCase() === 'admin') return true;
    return currentAgent?.permissions?.includes(perm);
  }

  if (!hasPerm('manage_roles') && !hasPerm('manage_agents')) {
    return <div className="p-8 text-center text-slate-400">You don't have permission to view settings.</div>;
  }

  if (hasConnections === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 h-full p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 shadow-lg border border-slate-700">
          <Shield size={36} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-200 mb-2">No integrations yet</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          Connect your Facebook or Instagram account to access team settings, agents, and custom roles.
        </p>
        <button
          onClick={() => window.location.href = '/?tab=integrations'}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
        >
          Connect your accounts →
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900 text-slate-200 overflow-y-auto p-8 relative">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Settings & Roles</h1>
        
        <div className="flex space-x-4 mb-6 border-b border-slate-700">
          {hasPerm('manage_roles') && (
            <button 
              className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'roles' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('roles')}
            >
              Custom Roles
            </button>
          )}
          {hasPerm('manage_agents') && (
            <button 
              className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'agents' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('agents')}
            >
              Agents
            </button>
          )}
        </div>

        {activeTab === 'roles' && hasPerm('manage_roles') && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Custom Roles</h2>
              <button onClick={() => setEditingRole({ name: '', permissions: [] })} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus size={16}/> Create Role
              </button>
            </div>

            {editingRole && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 animate-in fade-in slide-in-from-top-4">
                <input 
                  type="text" 
                  placeholder="Role Name (e.g. Responder)" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:border-blue-500"
                  value={editingRole.name}
                  onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                />
                <div className="space-y-3 mb-6">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                        checked={editingRole.permissions.includes(p.id)}
                        onChange={e => {
                          const newPerms = e.target.checked 
                            ? [...editingRole.permissions, p.id] 
                            : editingRole.permissions.filter(x => x !== p.id);
                          setEditingRole({...editingRole, permissions: newPerms});
                        }}
                      />
                      <span className="text-sm font-medium">{p.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => saveRole(editingRole)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium">Save Role</button>
                  <button onClick={() => setEditingRole(null)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map(r => (
                <div key={r.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 relative group flex flex-col">
                  <Shield className="text-blue-400 mb-3" size={28}/>
                  <h3 className="font-bold text-lg mb-1 text-white">{r.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 flex-1">{r.permissions.length} permissions assigned</p>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setEditingRole(r)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium w-full transition-colors">Edit</button>
                    <button onClick={() => deleteRole(r.id)} className="bg-red-900/40 text-red-400 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"><X size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'agents' && hasPerm('manage_agents') && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Team Agents</h2>
              <div className="flex gap-2">
                {Object.keys(pendingRoles).length > 0 && (
                  <button onClick={saveAgentRoles} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                    <Check size={16}/> Save Changes
                  </button>
                )}
                <button onClick={() => setIsAddingAgent(!isAddingAgent)} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                  <Plus size={16}/> Add Agent
                </button>
              </div>
            </div>
            
            {isAddingAgent && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 animate-in fade-in slide-in-from-top-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Name" className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
                <input type="email" placeholder="Email" className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" value={newAgent.email} onChange={e => setNewAgent({...newAgent, email: e.target.value})} />
                <input type="password" placeholder="Password (default: password123)" className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" value={newAgent.password} onChange={e => setNewAgent({...newAgent, password: e.target.value})} />
                <select className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" value={newAgent.role_id} onChange={e => setNewAgent({...newAgent, role_id: e.target.value})}>
                  <option value="">No Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="md:col-span-2 flex justify-end">
                  <button onClick={createAgent} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors">Create Agent</button>
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Agent</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {agents.map(a => (
                    <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400"><User size={14}/></div>
                        {a.name}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{a.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <select 
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-blue-500 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            value={pendingRoles[a.id] !== undefined ? pendingRoles[a.id] : (a.role_id || '')}
                            onChange={e => setPendingRoles({...pendingRoles, [a.id]: e.target.value})}
                            disabled={a.id === currentAgent?.id}
                          >
                            <option value="">No Role</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                          {a.id === currentAgent?.id && <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">You</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => deleteAgent(a.id)}
                          disabled={a.id === currentAgent?.id}
                          title={a.id === currentAgent?.id ? "You cannot remove yourself" : "Remove agent"}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        >
                          <X size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
