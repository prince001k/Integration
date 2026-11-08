import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Send, X, AlertCircle, MessageCircle, Heart, Video, Bell, Activity, Globe, Smartphone, Zap, Tag, User, Flag, ChevronDown, Sparkles, TriangleAlert, Calendar as CalendarIcon, Settings, LogOut, Search, Paperclip, Image, Filter, Menu } from 'lucide-react';
import io from 'socket.io-client';
import Dashboard from './Dashboard';
import CalendarTab from './CalendarTab';
import SettingsTab from './SettingsTab';
import IntegrationsTab from './IntegrationsTab';

// Reads from .env (local) or .env.production (GitHub Pages build)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const socket = io(API_URL);

// Automatically attaches the stored agentToken to every fetch request
const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('agentToken');
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

// â”€â”€â”€ Shared parser for encoded message tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Text format stored in DB:
//   [Comment]: <comment> |||LINK|||<permalink>|||IMAGE|||<thumbnailUrl>|||AVATAR|||<avatarUrl>
// Each section is optional. Always strip tags in reverse order (AVATAR last appended â†’ strip first).
function parseMessageTags(rawText) {
  let text = rawText || '';
  let avatar = null;
  let link = null;
  let thumbnail = null;

  // 1. Strip |||AVATAR||| (always appended last in backend)
  if (text.includes('|||AVATAR|||')) {
    const [before, after] = text.split('|||AVATAR|||');
    text = before;                        // discard avatar from main text
    avatar = after?.trim() || null;
  }

  // 2. Strip |||LINK||| and optional |||IMAGE||||
  if (text.includes('|||LINK|||')) {
    const [msgPart, linkPart] = text.split('|||LINK|||');
    text = msgPart;                       // pure comment text now
    if (linkPart && linkPart.includes('|||IMAGE|||')) {
      const [l, t] = linkPart.split('|||IMAGE|||');
      link = l?.trim() || null;
      thumbnail = t?.trim() || null;
    } else {
      link = linkPart?.trim() || null;
    }
  }

  // Validate link is an actual URL to avoid broken hrefs
  if (link && !link.startsWith('http')) link = null;
  if (thumbnail && !thumbnail.startsWith('http')) thumbnail = null;
  if (avatar && !avatar.startsWith('http')) avatar = null;

  return { text: text.trim(), link, thumbnail, avatar };
}

// Safe date formatter — never shows "Invalid Date"
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Make FB User IDs friendlier — "FB User 284952..." → "Facebook Customer"
function friendlyName(name) {
  if (!name) return 'Customer';
  if (/^(FB User|User)\s+\d+/.test(name)) return 'Facebook Customer';
  if (/^IG User\s+\d+/.test(name)) return 'Instagram Customer';
  return name;
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Sentiment badge helper
function SentimentBadge({ sentiment }) {
  if (!sentiment || sentiment === 'neutral') return null;
  const cfg = {
    positive: { label: 'ðŸ˜Š Positive', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    negative: { label: 'ðŸ˜Ÿ Negative', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  };
  const { label, cls } = cfg[sentiment] || {};
  if (!label) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cls} leading-none`}>
      {label}
    </span>
  );
}

function MainApp({ currentAgent }) {
  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [notification, setNotification] = useState(null);
  
  // Read initial tab from URL if present
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [globalNotifications, setGlobalNotifications] = useState([]);
  const [convMeta, setConvMeta] = useState(null); // priority, tags, sentiment, sla_breached, assigned_to
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [crisisAlert, setCrisisAlert] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterSort, setFilterSort] = useState('latest');

  const [showViews, setShowViews] = useState(true);
  const messagesEndRef = useRef(null);
  const previousMessagesCount = useRef(0);
  const previousUsersUpdate = useRef({});
  const userHasScrolled = useRef(false);

  // Request browser notification permission on load
  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Per-agent connection check — is this agent integrated with any social account?
  const [hasConnections, setHasConnections] = useState(null); // null = still checking

  useEffect(() => {
    const agentId = currentAgent?.id;
    if (!agentId) { setHasConnections(true); return; }
    authenticatedFetch(`${API_URL}/api/integrations/status?agentId=${agentId}`)
      .then(r => r.json())
      .then(data => {
        const connected = data.fbConnected || data.igConnected || (data.connections?.length > 0);
        setHasConnections(connected);
      })
      .catch(() => setHasConnections(true));
  }, [currentAgent]);

  // Poll for users and notifications every 5 seconds — only if agent has integrations
  useEffect(() => {
    if (hasConnections === null) return; // still checking
    if (!hasConnections) return;         // no integrations — don't load global data
    fetchUsers();
    fetchGlobalNotifications();
    const interval = setInterval(() => {
      fetchUsers();
      fetchGlobalNotifications();
    }, 5000);
    return () => clearInterval(interval);
  }, [hasConnections]);

  // Poll for messages of the active user every 3 seconds
  useEffect(() => {
    if (!activeUserId) return;
    
    fetchMessages(activeUserId);
    const interval = setInterval(() => fetchMessages(activeUserId), 3000);
    return () => clearInterval(interval);
  }, [activeUserId]);

  // Only auto-scroll when new messages arrive, not on every poll refresh
  useEffect(() => {
    const newCount = messages.length;
    const prevCount = previousMessagesCount.current;
    if (newCount > prevCount) {
      // New message arrived — scroll to bottom and reset user scroll flag
      userHasScrolled.current = false;
      scrollToBottom();
    }
    previousMessagesCount.current = newCount;
  }, [messages]);

  // Socket.io real-time listeners for Facebook
  useEffect(() => {
    const handleNewFbMessage = (data) => {
      showNotification(`New Facebook message from ${data.name}`);
      fetchUsers(); // Refresh sidebar order
      if (activeUserId === data.senderId) fetchMessages(data.senderId);
    };

    const handleNewFbComment = (data) => {
      showNotification(`New Facebook comment from ${data.fromName}`);
      fetchGlobalNotifications();
    };

    socket.on('fb_new_message', handleNewFbMessage);
    socket.on('fb_new_comment', handleNewFbComment);

    const handleCrisis = (data) => {
      setCrisisAlert(data.message);
      setTimeout(() => setCrisisAlert(null), 10000);
    };
    socket.on('crisis_alert', handleCrisis);

    return () => {
      socket.off('fb_new_message', handleNewFbMessage);
      socket.off('fb_new_comment', handleNewFbComment);
      socket.off('crisis_alert', handleCrisis);
    };
  }, [activeUserId]);

  // Fetch conversation metadata + quick replies when active user changes
  useEffect(() => {
    setConvMeta(null);
    setSummary(null);
    if (!activeUserId) return;
    const activeUser = users.find(u => u.id === activeUserId);
    const platform = activeUser?.platform || 'instagram';
    authenticatedFetch(`${API_URL}/api/conversation/${platform}/${activeUserId}`)
      .then(r => r.json()).then(setConvMeta).catch(() => {});
  }, [activeUserId, users]);

  useEffect(() => {
    authenticatedFetch(`${API_URL}/api/quick-replies`).then(r => r.json()).then(setQuickReplies).catch(() => {});
  }, []);

  const updateConvMeta = async (updates) => {
    if (!activeUserId) return;
    const activeUser = users.find(u => u.id === activeUserId);
    const platform = activeUser?.platform || 'instagram';
    await authenticatedFetch(`${API_URL}/api/conversation/${platform}/${activeUserId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
    });
    setConvMeta(prev => ({ ...prev, ...updates }));
  };

  const fetchSummary = async () => {
    if (!activeUserId) return;
    const activeUser = users.find(u => u.id === activeUserId);
    const platform = activeUser?.platform || 'instagram';
    setSummaryLoading(true);
    try {
      const r = await authenticatedFetch(`${API_URL}/api/conversation/${platform}/${activeUserId}/summary`, { method: 'POST' });
      const d = await r.json();
      setSummary(d.summary);
    } finally { setSummaryLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const [igRes, fbRes] = await Promise.all([
        authenticatedFetch(`${API_URL}/api/users`).catch(() => ({ json: () => [] })),
        authenticatedFetch(`${API_URL}/api/fb/chats`).catch(() => ({ json: () => [] }))
      ]);
      const igData = igRes.ok ? await igRes.json() : [];
      const fbData = fbRes.ok ? await fbRes.json() : [];

      const igUsers = Array.isArray(igData) ? igData.map(u => ({ ...u, platform: 'instagram' })) : [];
      const fbUsers = Array.isArray(fbData) ? fbData.map(u => ({ ...u, platform: 'facebook' })) : [];
      
      const allUsers = [...igUsers, ...fbUsers].sort((a,b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      
      setUsers(allUsers);

      // Check for new messages across all users to trigger a notification (Instagram polling fallback)
      allUsers.forEach(user => {
        const lastUpdate = previousUsersUpdate.current[user.id];
        if (lastUpdate && new Date(user.lastMessageAt) > new Date(lastUpdate) && user.platform === 'instagram') {
           showNotification(`New message from ${user.name}`);
        }
        previousUsersUpdate.current[user.id] = user.lastMessageAt;
      });

    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchGlobalNotifications = async () => {
    try {
      const [igRes, fbRes] = await Promise.all([
        authenticatedFetch(`${API_URL}/api/notifications`).catch(() => ({ json: () => [] })),
        authenticatedFetch(`${API_URL}/api/fb/notifications`).catch(() => ({ json: () => [] }))
      ]);
      
      const igData = igRes.ok ? await igRes.json() : [];
      const fbData = fbRes.ok ? await fbRes.json() : [];

      const igNotifs = Array.isArray(igData) ? igData.map(n => ({ ...n, platform: 'instagram' })) : [];
      const fbNotifs = Array.isArray(fbData) ? fbData.map(n => ({
        id: n.id,
        user_id: n.from_id,
        user_name: n.from_name,
        user_profilePic: null,
        text: `[Comment]: ${n.message}`,
        timestamp: n.created_at,
        platform: 'facebook'
      })) : [];

      const allNotifs = [...igNotifs, ...fbNotifs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
      setGlobalNotifications(allNotifs);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const activeUser = users.find(u => u.id === userId);
      const isFb = activeUser?.platform === 'facebook';
      const endpoint = isFb ? `/api/fb/messages/${userId}` : `/api/messages/${userId}`;
      const response = await authenticatedFetch(`${API_URL}${endpoint}`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const showNotification = (text) => {
    // Show in-app toast
    setNotification(text);
    setTimeout(() => setNotification(null), 4000);

    // Show desktop notification
    if (Notification.permission === 'granted') {
      new Notification('Unified Social App', { body: text });
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeUserId) return;

    const newMessage = { text: inputValue, sender: 'agent' };
    setInputValue('');
    setMessages(prev => [...prev, { ...newMessage, id: Date.now(), timestamp: new Date().toISOString() }]);

    try {
      const activeUser = users.find(u => u.id === activeUserId);
      const isFb = activeUser?.platform === 'facebook';
      const endpoint = isFb ? `/api/fb/messages/${activeUserId}` : `/api/messages/${activeUserId}`;
      await authenticatedFetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage),
      });
      fetchMessages(activeUserId);
      fetchUsers();
    } catch (error) { console.error('Error sending message:', error); }
  };

  const sendMedia = async (file) => {
    if (!file || !activeUserId) return;
    const activeUser = users.find(u => u.id === activeUserId);
    const isFb = activeUser?.platform === 'facebook';
    const isVideo = file.type.startsWith('video/');
    const localPreview = URL.createObjectURL(file);
    const pendingId = Date.now();

    setMediaUploading(true);
    setMessages(prev => [...prev, {
      id: pendingId, sender: 'agent',
      text: isVideo ? '[video] __uploading__' : '[image] __uploading__',
      _localPreview: localPreview, _uploading: true,
      timestamp: new Date().toISOString()
    }]);

    try {
      const formData = new FormData();
      formData.append('media', file);
      const uploadRes = await authenticatedFetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();
      const endpoint = isFb ? `/api/fb/messages/${activeUserId}/media` : `/api/messages/${activeUserId}/media`;
      await authenticatedFetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: isVideo ? 'video' : 'image' }),
      });
      setMessages(prev => prev.filter(m => m.id !== pendingId));
      fetchMessages(activeUserId);
    } catch (err) {
      console.error('Media send error:', err);
      setMessages(prev => prev.filter(m => m.id !== pendingId));
    } finally {
      setMediaUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };


  const scrollToBottom = () => {
    if (!userHasScrolled.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const activeUser = users.find(u => u.id === activeUserId);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-['Inter'] overflow-hidden">
      
      {/* ─── VERY LEFT DARK NAVIGATION SIDEBAR ─── */}
      <div className="w-[72px] bg-[#0b1c2c] flex flex-col items-center py-6 border-r border-[#152b43] shrink-0 z-30 shadow-xl">
        <div 
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl mb-8 shadow-lg shadow-blue-500/20 cursor-default"
          title={currentAgent?.workspaceName || 'Workspace'}
        >
          {(currentAgent?.workspaceName || currentAgent?.domain || 'U').charAt(0).toUpperCase()}
        </div>
        
        <div className="flex flex-col gap-6 w-full px-2">
          {[
            { key: 'dashboard', icon: <Activity size={22} /> },
            { key: 'calendar', icon: <CalendarIcon size={22} /> },
            { key: 'chats', icon: <MessageCircle size={22} /> },
            { key: 'notifications', icon: <Bell size={22} />, badge: globalNotifications.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.key.charAt(0).toUpperCase() + tab.key.slice(1)}
              className={`relative flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-[#0b1c2c]"></span>
              )}
            </button>
          ))}

          <div className="h-px bg-slate-700/50 w-8 mx-auto my-2"></div>

          {[
            { key: 'settings', icon: <Settings size={22} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.key.charAt(0).toUpperCase() + tab.key.slice(1)}
              className={`relative flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {tab.icon}
            </button>
          ))}
        </div>

      </div>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* TOP HEADER */}
        <header className="h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 capitalize tracking-tight">{activeTab}</h1>
            {activeTab === 'chats' && (
              <div className="hidden md:flex items-center bg-slate-100 rounded-full px-3 py-1.5 w-64 border border-slate-200/50">
                <Search size={14} className="text-slate-400" />
                <input type="text" placeholder="Search conversations..." className="bg-transparent border-none focus:outline-none text-sm ml-2 w-full text-slate-700 placeholder-slate-400" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* DYNAMIC CONTENT PANES */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* VIEWS SIDEBAR (Zendesk style) */}
          {activeTab === 'chats' && showViews && (
            <div className="w-[220px] bg-[#f8f9fa] border-r border-slate-200 flex flex-col shrink-0 z-10">
              <div className="px-4 pt-4 pb-3 border-b border-gray-100/50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Views</span>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                <div className="px-2 space-y-1">
                  {[
                    { id: 'all', label: 'All Chats', icon: <MessageCircle size={14} /> },
                    { id: 'mine', label: 'My open Chats', icon: <User size={14} /> },
                    { id: 'unresolved', label: 'unresolved Chats', icon: <AlertCircle size={14} /> },
                  ].map(view => (
                    <button
                      key={view.id}
                      onClick={() => setActiveView(view.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${activeView === view.id ? 'bg-blue-50/70 text-blue-700 font-semibold shadow-sm border border-blue-100/50' : 'text-gray-600 hover:bg-gray-100/60 font-medium'}`}
                    >
                      {view.icon}
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MIDDLE PANE (Chats / Notifications Lists) - Only visible when those tabs are active */}
          {(activeTab === 'chats' || activeTab === 'notifications') && (
            <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10">
              {/* Chat list header */}
              {activeTab === 'chats' && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowViews(!showViews)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-md hover:bg-gray-100">
                      <Menu size={16} />
                    </button>
                    <span className="text-sm font-bold text-gray-800">
                      {activeView === 'mine' ? 'My Open Tickets' : activeView === 'unresolved' ? 'Unresolved Tickets' : activeView === 'high' ? 'High Priority' : 'All Tickets'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto hide-scrollbar">
          {activeTab === 'chats' ? (() => {
            let filtered = [...users];
            
            // Apply sidebar view filter
            if (activeView === 'mine') filtered = filtered.filter(u => u.assignedTo === currentAgent?.id);
            if (activeView === 'unresolved') filtered = filtered.filter(u => u.slaBreached || u.sentiment === 'negative');
            if (activeView === 'high') filtered = filtered.filter(u => u.priority === 'high');

            if (chatSearch) filtered = filtered.filter(u => (u.name||'').toLowerCase().includes(chatSearch.toLowerCase()));
            if (filterPriority) filtered = filtered.filter(u => (u.priority || 'normal') === filterPriority);
            if (filterTag) filtered = filtered.filter(u => (u.tags || []).includes(filterTag));
            if (filterSort === 'oldest') filtered.sort((a,b) => new Date(a.lastMessageAt)-new Date(b.lastMessageAt));
            else if (filterSort === 'name') filtered.sort((a,b) => (a.name||'').localeCompare(b.name||''));
            else filtered.sort((a,b) => new Date(b.lastMessageAt)-new Date(a.lastMessageAt));
            
            return filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm mt-10">
                {users.length === 0 ? 'No messages yet. Waiting for someone to DM your Instagram account...' : 'No chats match your filters.'}
              </div>
            ) : (
              filtered.map((user) => (
                <div
                  key={user.id}
                  onClick={() => { setActiveUserId(user.id); setActiveTab('chats'); }}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors flex items-center space-x-3 ${activeUserId === user.id ? 'bg-purple-50 hover:bg-purple-50' : ''}`}
                >
                {/* User avatar */}
                <div className="relative flex-shrink-0">
                  {user.profilePic ? (
                    <img
                      src={user.profilePic}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm"
                      onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                    />
                  ) : null}
                  <div
                    className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-orange-400 flex items-center justify-center text-white flex-shrink-0 shadow-sm text-sm font-bold"
                    style={{ display: user.profilePic ? 'none' : 'flex' }}
                  >
                    {(user.name || '').slice(0,2).toUpperCase() || <MessageCircle size={22} />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-800 truncate">{friendlyName(user.name)}</h3>
                    <span className="text-xs text-gray-400 ml-1 shrink-0">{formatTime(user.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                      {user.platform === 'facebook' ? <Globe size={12} className="text-blue-500"/> : <Smartphone size={12} className="text-pink-500"/>}
                      {user.platform === 'facebook' ? 'Facebook user' : 'Instagram user'}
                    </p>
                    <SentimentBadge sentiment={user.sentiment} />
                  </div>
                </div>

              </div>
            ))
          );
          })()
          : activeTab === 'notifications' ? (
            /* Notifications Panel Content */
            globalNotifications.length === 0 ? (
               <div className="p-4 text-center text-gray-500 text-sm mt-10">
                 No notifications yet.
               </div>
            ) : (
               globalNotifications.map((notif) => {
                 const rawText = notif.text || '';
                 const isComment = rawText.startsWith('[Comment]:');
                 const isLike = rawText.includes('LIKE') || rawText.includes('Reacted');
                 const isMention = rawText.startsWith('[Mention]:');

                 // Use shared parser â€” handles AVATAR / LINK / IMAGE tags safely
                 const parsed = parseMessageTags(rawText);
                 const { link, thumbnail } = parsed;
                 const avatarFromText = parsed.avatar;

                 // parsedText is the clean comment text after stripping all tags
                 let parsedText = parsed.text;

                 // The real avatar: prefer from text tag, then from DB column
                 const avatarUrl = avatarFromText || notif.user_profilePic || null;
                 const userName = notif.user_name || '';
                 const initials = userName.slice(0, 2).toUpperCase();

                 let displayMessage = 'interacted with you';
                 
                 if (isComment) { 
                    let rawComment = parsedText.replace('[Comment]: ', '').replace('[Comment]:', '').trim();
                    displayMessage = <span>commented: <span className="text-gray-800 italic">&ldquo;{rawComment}&rdquo;</span></span>;
                 } else if (isLike) { 
                    displayMessage = 'liked your post.';
                 } else if (isMention) { 
                    displayMessage = 'mentioned you in a story/post.';
                 }

                 return (
                   <div 
                     key={notif.id}
                     onClick={() => { setActiveUserId(notif.user_id); setActiveTab('chats'); }}
                     className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                   >
                     {/* Profile Picture Avatar */}
                     <div className="relative flex-shrink-0">
                       {avatarUrl ? (
                         <img
                           src={avatarUrl}
                           alt={userName}
                           className="w-11 h-11 rounded-full object-cover border border-gray-200 shadow-sm"
                           onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                         />
                       ) : null}
                       <div
                         className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-500 to-orange-400 flex items-center justify-center text-white text-sm font-bold shadow-sm"
                         style={{ display: avatarUrl ? 'none' : 'flex' }}
                       >
                         {initials || <Bell size={18} />}
                       </div>
                     </div>
                     
                     {/* Text */}
                     <div className="flex-1 min-w-0">
                       <p className="text-sm text-gray-900 leading-snug">
                         <span className="font-semibold">{userName}</span>{' '}
                         <span className="text-gray-600 font-normal">{displayMessage}</span>
                       </p>
                       <span className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                         {notif.platform === 'facebook' ? <Globe size={10} className="text-blue-400"/> : <Smartphone size={10} className="text-pink-400"/>}
                         {new Date(notif.timestamp).toLocaleDateString([], {month:'short', day:'numeric'})} &middot; {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                     </div>

                     
                     {/* Video / Image Thumbnail */}
                     {thumbnail && thumbnail.trim() !== '' ? (
                       <a
                         href={link || '#'}
                         target="_blank"
                         rel="noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         className="flex-shrink-0 block relative rounded-md overflow-hidden shadow border border-gray-200"
                         style={{ width: 52, height: 52 }}
                       >
                         {thumbnail.includes('.mp4') ? (
                           <video src={thumbnail} className="w-full h-full object-cover" muted playsInline />
                         ) : (
                           <img src={thumbnail} alt="post" className="w-full h-full object-cover" />
                         )}
                         {/* Video play icon overlay */}
                         {(thumbnail.includes('.mp4') || link) && (
                           <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                             <Video size={14} className="text-white drop-shadow" />
                           </div>
                         )}
                       </a>
                     ) : link ? (
                        <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-shrink-0 bg-purple-50 text-purple-600 text-[10px] px-2 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 font-medium">
                           View Post
                        </a>
                     ) : null}
                   </div>
                 );
               })
            )
          ) : null}
              </div>
            </div>
          )}



          {/* RIGHT MAIN PANE */}
          <div className="flex-1 min-w-0 flex flex-col bg-slate-50 relative h-full">
            {activeTab === 'dashboard' ? (
          <Dashboard currentAgent={currentAgent} />
        ) : activeTab === 'settings' ? (
          <SettingsTab currentAgent={currentAgent} />
        ) : activeTab === 'calendar' ? (
          <CalendarTab />
        ) : activeTab === 'integrations' ? (
          <IntegrationsTab currentAgent={currentAgent} />
        ) : activeUserId ? (
          <div className="flex flex-1 overflow-hidden h-full">
            {/* Chat Conversation Column */}
            <div className="flex-1 min-w-0 flex flex-col bg-slate-50 relative h-full">
            {/* Chat Header */}
            <div className="bg-white shadow-sm z-10">
              {/* Top row: avatar + name + platform + actions */}
              <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
                <div className="relative flex-shrink-0">
                  {activeUser?.profilePic ? (
                    <img src={activeUser.profilePic} alt={activeUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"
                      onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                    />
                  ) : null}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-orange-400 flex items-center justify-center text-white shadow-sm text-sm font-bold"
                    style={{ display: activeUser?.profilePic ? 'none' : 'flex' }}>
                    {(activeUser?.name || '').slice(0,2).toUpperCase() || <MessageCircle size={20} />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                    {activeUser ? activeUser.name : `User ${activeUserId}`}
                    {activeUser?.platform === 'facebook' ? <Globe size={13} className="text-blue-500"/> : <Smartphone size={13} className="text-pink-500"/>}
                    {/* Sentiment badge */}
                    {convMeta?.sentiment === 'positive' && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">😊 Positive</span>}
                    {convMeta?.sentiment === 'negative' && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-semibold">😟 Negative</span>}
                    {convMeta?.sentiment === 'neutral' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold">😐 Neutral</span>}
                    {/* SLA Warning */}
                    {convMeta?.sla_breached && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><TriangleAlert size={10}/>SLA Overdue</span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400">{activeUser?.platform === 'facebook' ? 'Facebook Customer' : 'Instagram Customer'}</p>
                </div>
                {/* AI Summary button */}
                <button onClick={fetchSummary} disabled={summaryLoading}
                  className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 px-2.5 py-1.5 rounded-lg border border-violet-200 font-medium transition-colors flex-shrink-0">
                  <Sparkles size={12}/>{summaryLoading ? 'Summarizingâ€¦' : 'AI Summary'}
                </button>
              </div>


              {/* AI Summary panel */}
              {summary && (
                <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-start gap-2">
                  <Sparkles size={13} className="text-violet-500 mt-0.5 flex-shrink-0"/>
                  <p className="text-xs text-violet-700 flex-1">{summary}</p>
                  <button onClick={() => setSummary(null)} className="text-violet-400 hover:text-violet-600"><X size={13}/></button>
                </div>
              )}
            </div>

            {/* Chat Messages â€” THE ONLY scrollable area */}
            <div className="flex-1 scroll-y p-5 space-y-4" onScroll={(e) => {
              const el = e.currentTarget;
              const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              userHasScrolled.current = !isAtBottom;
            }}>
              {messages.map((msg) => {
                const text = msg.text || '';
                const isComment = text.startsWith('[Comment]: ');
                const isLike = text.includes('LIKE') || text.includes('Reacted');
                
                let content = text;
                if (isComment) {
                   // Use shared parser â€” strips |||AVATAR||| / |||LINK||| / |||IMAGE||| safely
                   const parsedMsg = parseMessageTags(text.replace('[Comment]: ', '').replace('[Comment]:', ''));
                   let commentText = parsedMsg.text;
                   const videoLink = parsedMsg.link; // guaranteed clean URL or null

                  content = (
                    <div className="flex flex-col border-l-2 border-purple-500 pl-3 py-1 my-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 text-purple-600">
                          <Video size={14} />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Commented on Video/Post</span>
                        </div>
                        {videoLink && (
                          <a href={videoLink} target="_blank" rel="noreferrer" className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 px-2 py-1 rounded border border-purple-200 transition-colors shadow-sm ml-4">
                            View Post â†—
                          </a>
                        )}
                      </div>
                      <span className="text-gray-700 italic">"{commentText}"</span>
                    </div>
                  );
                } else if (isLike) {
                  content = (
                    <div className="flex items-center space-x-2 text-pink-500 font-medium py-1">
                      <Heart size={16} fill="currentColor" />
                      <span>Liked your video/post</span>
                    </div>
                  );
                } else if (msg._uploading) {
                  const isVid = msg.text.includes('[video]');
                  content = (
                    <div className="relative w-[200px] h-[140px] rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                      {msg._localPreview && !isVid && (
                        <img src={msg._localPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                      )}
                      {msg._localPreview && isVid && (
                        <video src={msg._localPreview} className="absolute inset-0 w-full h-full object-cover opacity-50" muted />
                      )}
                      <div className="relative flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-white text-[11px] font-medium drop-shadow">Uploading...</span>
                      </div>
                    </div>
                  );
                } else if (/^\[(image|video)\]\s+(https?:\/\/|\/)/i.test(text)) {
                  const mediaType = text.toLowerCase().startsWith('[video]') ? 'video' : 'image';
                  const rawUrl = text.replace(/^\[(image|video)\]\s+/i, '');
                  const mediaUrl = rawUrl.startsWith('http') ? rawUrl : `${API_URL}${rawUrl}`;
                  content = mediaType === 'video' ? (
                    <video src={mediaUrl} controls className="max-w-[240px] rounded-xl" />
                  ) : (
                    <img src={mediaUrl} alt="media" className="max-w-[240px] rounded-xl"
                      onError={e => { e.target.style.display='none'; e.target.insertAdjacentHTML('afterend','<span class="text-xs text-gray-400">Image unavailable</span>'); }} />
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm text-[15px] leading-relaxed ${
                      msg.sender === 'agent' 
                        ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' 
                        : (isComment || isLike) ? 'bg-white border border-gray-100 rounded-tl-none shadow-md' : 'bg-white text-gray-800 rounded-tl-none'
                    }`}>
                      {content}
                      <div className="text-[10px] text-gray-400 text-right mt-1">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="bg-white border-t border-gray-200">
              {/* Quick Replies panel */}
              {showQR && (
                <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-b border-gray-100 bg-gray-50">
                  {quickReplies.map(qr => (
                    <button key={qr.id}
                      onClick={() => { setInputValue(qr.body); setShowQR(false); }}
                      className="text-xs bg-white border border-gray-200 hover:border-violet-400 hover:bg-violet-50 text-gray-700 rounded-lg px-2.5 py-1.5 transition-colors">
                      <span className="font-semibold text-violet-600">{qr.title}</span>: {qr.body.slice(0, 35)}â€¦
                    </button>
                  ))}
                  {quickReplies.length === 0 && <p className="text-xs text-gray-400 py-1">No quick replies yet.</p>}
                </div>
              )}
              <div className="p-3 flex items-center gap-2">
                <button onClick={() => setShowQR(v => !v)}
                  className={`flex-shrink-0 p-2 rounded-full transition-colors ${ showQR ? 'bg-violet-100 text-violet-600' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="Quick Replies">
                  <Zap size={18}/>
                </button>
                {/* Media upload button */}
                <label className="flex-shrink-0 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-violet-500 transition-colors cursor-pointer" title="Send image or video">
                  <Paperclip size={18}/>
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { if (e.target.files[0]) sendMedia(e.target.files[0]); e.target.value=''; }} />
                </label>
                <form onSubmit={sendMessage} className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
                  <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message" className="flex-1 bg-transparent focus:outline-none text-gray-700 text-sm"/>
                  <button type="submit" disabled={!inputValue.trim()} className="text-gray-400 hover:text-green-500 disabled:opacity-50 transition-colors ml-2">
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </div>
          </div>

            {/* Right Sidebar (Properties OR Filters) */}
            <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right-4 duration-200">

              <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
                 <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Properties</h2>
              </div>
              <div className="p-4 space-y-6">
                
                {/* Contact Info */}
                <div>
                   <h3 className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Contact Info</h3>
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                       {activeUser?.profilePic ? (
                         <img src={activeUser.profilePic} alt="profile" className="w-full h-full object-cover"
                           onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                       ) : (
                         (activeUser?.name || '').slice(0,2).toUpperCase()
                       )}
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="text-sm font-bold text-gray-800 truncate">{activeUser?.name}</p>
                       <p className="text-xs text-gray-500 flex items-center gap-1">
                         {activeUser?.platform === 'facebook' ? <Globe size={10} className="text-blue-500"/> : <Smartphone size={10} className="text-pink-500"/>}
                         {activeUser?.platform === 'facebook' ? 'Facebook User' : 'Instagram User'}
                       </p>
                     </div>
                   </div>
                </div>

                {/* Priority */}
                <div>
                   <h3 className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Priority</h3>
                   <select value={convMeta?.priority || 'normal'}
                     onChange={e => updateConvMeta({ priority: e.target.value })}
                     className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-violet-300 shadow-sm">
                     <option value="high">&#x1F534; High</option>
                     <option value="normal">&#x1F7E1; Normal</option>
                     <option value="low">&#x1F7E2; Low</option>
                   </select>
                </div>

                {/* Sentiment */}
                <div>
                   <h3 className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Sentiment</h3>
                   <div className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-gray-50 font-medium flex items-center gap-2 shadow-sm">
                     {convMeta?.sentiment === 'positive' && <><span className="text-emerald-500 text-[14px]">😊</span> Positive</>}
                     {convMeta?.sentiment === 'negative' && <><span className="text-red-500 text-[14px]">😟</span> Negative</>}
                     {(!convMeta?.sentiment || convMeta?.sentiment === 'neutral') && <><span className="text-gray-400 text-[14px]">😐</span> Neutral</>}
                   </div>
                </div>
                
                {/* Tags */}
                <div>
                   <h3 className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Tags</h3>
                   <div className="flex items-center gap-1.5 flex-wrap">
                     {['Complaint','Inquiry','Feedback','Order','Pricing'].map(tag => (
                       <button key={tag}
                         onClick={() => {
                           const cur = convMeta?.tags || [];
                           const next = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag];
                           updateConvMeta({ tags: next });
                         }}
                         className={`text-[10px] px-2.5 py-1 rounded border shadow-sm font-semibold transition-colors ${
                           (convMeta?.tags || []).includes(tag)
                             ? 'bg-violet-100 text-violet-700 border-violet-200'
                             : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                         }`}>{tag}</button>
                     ))}
                   </div>
                </div>

                {/* Assignment / SLA Placeholder */}
                <div>
                   <h3 className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Assigned Agent</h3>
                   <div className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-gray-50 text-gray-600 font-medium shadow-sm flex items-center gap-2">
                     <User size={14} className="text-gray-400"/> 
                     {convMeta?.assigned_to === currentAgent?.id ? currentAgent?.name : 'Unassigned'}
                   </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          /* Empty State with Filters on the right */
          <div className="flex-1 flex overflow-hidden h-full">
            {/* Empty state center */}
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <MessageCircle size={64} className="mb-4 text-gray-300" />
              <h2 className="text-2xl font-light text-gray-500 mb-2">Unified Social Web</h2>
              <p className="text-gray-400 text-sm">Select a user from the left to start messaging.</p>
            </div>
            {/* STATIC FILTERS SIDEBAR on the right */}
            <div className="w-[280px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
              <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Filter size={14} className="text-gray-500"/> FILTERS
                </h2>
                {(chatSearch || filterPriority || filterTag || filterSort !== 'latest') && (
                  <button onClick={() => { setChatSearch(''); setFilterPriority(''); setFilterTag(''); setFilterSort('latest'); }}
                    className="text-[11px] text-violet-600 font-medium hover:underline">Clear All</button>
                )}
              </div>
              <div className="p-4 space-y-6">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Search fields</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search by name..." value={chatSearch} onChange={e => setChatSearch(e.target.value)} className="w-full text-[13px] border border-gray-200 rounded-md pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-shadow" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Priority</label>
                  <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500">
                    <option value="">Any priority</option>
                    <option value="high">High Priority</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Tags</label>
                  <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500">
                    <option value="">Any tag</option>
                    {['Complaint','Inquiry','Feedback','Order','Pricing'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Sort By</label>
                  <select value={filterSort} onChange={e => setFilterSort(e.target.value)} className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500">
                    <option value="latest">Newest first (Date created)</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Customer Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>

      {notification && (
        <div className="fixed bottom-6 right-6 bg-white border-l-4 border-indigo-500 shadow-xl rounded-xl p-4 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4 duration-300 max-w-xs">
          <div className="bg-indigo-100 p-2 rounded-full text-indigo-600 flex-shrink-0">
            <MessageCircle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-800">New Notification</h4>
            <p className="text-xs text-slate-500 truncate">{notification}</p>
          </div>
        </div>
      )}

      {/* CRISIS ALERT MODAL */}
      {crisisAlert && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border-2 border-red-400">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <TriangleAlert size={24} className="text-red-500"/>
              </div>
              <h2 className="font-bold text-gray-800 text-base">Crisis Alert</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">{crisisAlert}</p>
            <button onClick={() => setCrisisAlert(null)}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm">
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('agentToken') || null);
  const [currentAgent, setCurrentAgent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentAgent'));
    } catch {
      return null;
    }
  });

  // On startup, validate the token OR auto-login if there is no token
  useEffect(() => {
    const storedToken = localStorage.getItem('agentToken');
    
    if (!storedToken) {
      // Auto-login (Bypass UI)
      authenticatedFetch(`${API_URL}/api/auth/dev-login`)
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('agentToken', data.token);
            localStorage.setItem('currentAgent', JSON.stringify(data.agent));
            setToken(data.token);
            setCurrentAgent(data.agent);
          }
        })
        .catch(console.error);
      return;
    }

    // Validate existing token
    authenticatedFetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then(r => {
        if (!r.ok) {
          localStorage.removeItem('agentToken');
          localStorage.removeItem('currentAgent');
          setToken(null);
          setCurrentAgent(null);
          // Instead of forcing a redirect, try auto-login again
          authenticatedFetch(`${API_URL}/api/auth/dev-login`)
            .then(res => res.json())
            .then(data => {
              if (data.token) {
                localStorage.setItem('agentToken', data.token);
                localStorage.setItem('currentAgent', JSON.stringify(data.agent));
                setToken(data.token);
                setCurrentAgent(data.agent);
              }
            });
          return null;
        }
        return r.json();
      })
      .then(freshAgent => {
        if (!freshAgent) return;
        setCurrentAgent(freshAgent);
        localStorage.setItem('currentAgent', JSON.stringify(freshAgent));
      })
      .catch(() => {});
  }, []);

  if (!token) {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#0b1024] text-white">Logging you in...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<MainApp currentAgent={currentAgent} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

