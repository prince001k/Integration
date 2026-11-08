import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  Smartphone, Globe, TrendingUp, MessageCircle, Heart,
  Share2, Users, Activity, RefreshCw, ChevronRight,
  Zap, Target, Clock, ArrowUpRight, ArrowDownRight,
  Eye, Bookmark, ExternalLink, Image, Film, LayoutGrid, MousePointerClick
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend, trendVal, badge, badgeColor }) {
  const up = trend === 'up';
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeColor || 'bg-emerald-50 text-emerald-600'}`}>
              {badge}
            </span>
          )}
          {trendVal && (
            <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {trendVal}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-0.5 truncate">{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Post Card ───────────────────────────────────────────────────────
function PostCard({ post, rank, platform }) {
  const isVideo = post.media_type === 'VIDEO' || post.media_type === 'REEL';
  const thumb = post.thumbnail_url || post.media_url;
  const colors = ['bg-amber-400', 'bg-slate-400', 'bg-orange-400'];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-gray-100">
        {thumb ? (
          <img src={thumb} alt="post" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            {isVideo ? <Film size={32} /> : <Image size={32} />}
          </div>
        )}
        {rank <= 3 && (
          <div className={`absolute top-2 left-2 w-6 h-6 ${colors[rank-1]} rounded-full flex items-center justify-center text-white text-xs font-black shadow`}>
            {rank}
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
          {isVideo ? <Film size={9} /> : <Image size={9} />}
          {post.media_type || 'POST'}
        </div>
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
            <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </a>
        )}
      </div>
      {/* Stats */}
      <div className="p-3">
        <p className="text-xs text-gray-600 truncate mb-2 leading-relaxed">{post.caption || '(no text)'}</p>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5">
              {platform === 'fb' ? <Heart size={9} className="text-blue-500"/> : <Heart size={9} className="text-pink-400"/>} 
              {platform === 'fb' ? 'Reactions' : 'Likes'}
            </p>
            <p className="text-xs font-bold text-gray-800">{(post.insights?.likes || post.insights?.reactions || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><MessageCircle size={9} className="text-blue-400"/> Comm.</p>
            <p className="text-xs font-bold text-gray-800">{(post.insights?.comments || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5">
              {platform === 'fb' ? <MousePointerClick size={9} className="text-orange-400"/> : <Bookmark size={9} className="text-violet-400"/>} 
              {platform === 'fb' ? 'Clicks' : 'Saves'}
            </p>
            <p className="text-xs font-bold text-gray-800">{(post.insights?.saves || post.insights?.clicks || 0).toLocaleString()}</p>
          </div>
        </div>
        {(post.insights?.reach > 0 || post.insights?.impressions > 0) && (
          <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-0.5"><Eye size={9}/> {(post.insights?.reach || post.insights?.impressions || 0).toLocaleString()} {platform==='fb' ? 'impressions' : 'reach'}</span>
            <span className="flex items-center gap-0.5"><Share2 size={9}/> {(post.insights?.shares || 0).toLocaleString()} shares</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ currentAgent }) {
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeGrowthPeriod, setActiveGrowthPeriod] = useState('7d');

  // Per-account integration check
  const [hasConnections, setHasConnections] = useState(null); // null = checking

  // Instagram Insights state
  const [igAccount, setIgAccount] = useState(null);
  const [igPosts, setIgPosts] = useState([]);
  const [igTopPosts, setIgTopPosts] = useState([]);
  const [igInsightsLoading, setIgInsightsLoading] = useState(false);
  const [igInsightsError, setIgInsightsError] = useState(null);
  
  // Facebook Insights state
  const [fbAccount, setFbAccount] = useState(null);
  const [fbPosts, setFbPosts] = useState([]);
  const [fbTopPosts, setFbTopPosts] = useState([]);
  const [fbInsightsLoading, setFbInsightsLoading] = useState(false);
  const [fbInsightsError, setFbInsightsError] = useState(null);

  const [activeInsightsTab, setActiveInsightsTab] = useState('overview');
  const [topPostsPlatform, setTopPostsPlatform] = useState('ig');

  const apiFetch = async (path, defaultReturn = {}) => {
    try {
      const token = localStorage.getItem('agentToken');
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return defaultReturn;
      return res.json();
    } catch(e) {
      return defaultReturn;
    }
  };

  // Bypass integration check: assume always connected
  useEffect(() => {
    setHasConnections(true);
  }, []);

  // Fetch existing analytics
  const fetchAll = useCallback(async () => {
    try {
      const [analyticsRes, summaryRes, trendRes, hourlyRes, topUsersRes, feedRes] = await Promise.all([
        apiFetch('/api/analytics', {}),
        apiFetch('/api/analytics/summary', {}),
        apiFetch('/api/analytics/engagement-trend', []),
        apiFetch('/api/analytics/hourly', []),
        apiFetch('/api/analytics/top-users', []),
        apiFetch('/api/notifications', [])
      ]);
      setAnalytics(analyticsRes);
      setSummary(summaryRes);
      setEngagementTrend(Array.isArray(trendRes) ? trendRes : []);
      setHourlyData(Array.isArray(hourlyRes) ? hourlyRes : []);
      setTopUsers(Array.isArray(topUsersRes) ? topUsersRes : []);
      setLiveFeed(Array.isArray(feedRes) ? feedRes.slice(0, 6) : []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch REAL Instagram Insights
  const fetchIgInsights = useCallback(async () => {
    setIgInsightsLoading(true);
    setIgInsightsError(null);
    try {
      const [accountRes, postsRes, topPostsRes] = await Promise.all([
        apiFetch('/api/ig/account-insights', {}),
        apiFetch('/api/ig/posts?limit=12', { posts: [] }),
        apiFetch('/api/ig/top-posts?limit=6', [])
      ]);
      if (accountRes.error) throw new Error(accountRes.error);
      setIgAccount(accountRes);
      setIgPosts(postsRes.posts || []);
      setIgTopPosts(Array.isArray(topPostsRes) ? topPostsRes : []);
    } catch(e) {
      setIgInsightsError(e.message);
      console.error('[IG Insights]', e.message);
    } finally {
      setIgInsightsLoading(false);
    }
  }, []);

  // Fetch REAL Facebook Insights
  const fetchFbInsights = useCallback(async () => {
    setFbInsightsLoading(true);
    setFbInsightsError(null);
    try {
      const [accountRes, postsRes, topPostsRes] = await Promise.all([
        apiFetch('/api/fb/account-insights', {}),
        apiFetch('/api/fb/posts?limit=12', { posts: [] }),
        apiFetch('/api/fb/top-posts?limit=6', [])
      ]);
      if (accountRes.error) throw new Error(accountRes.error);
      setFbAccount(accountRes);
      setFbPosts(postsRes.posts || []);
      setFbTopPosts(Array.isArray(topPostsRes) ? topPostsRes : []);
    } catch(e) {
      setFbInsightsError(e.message);
      console.error('[FB Insights]', e.message);
    } finally {
      setFbInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchIgInsights();
    fetchFbInsights();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchIgInsights, fetchFbInsights]);

  const growthData = analytics?.growthData ?? [];
  const filteredGrowth = activeGrowthPeriod === '7d' ? growthData : growthData.slice(0, 7);
  const followerChartData = igAccount?.followerHistory?.length > 0 ? igAccount.followerHistory : filteredGrowth;

  // Integration empty state removed per user request

  return (
    <div className="flex-1 bg-[#f8f9fa] scroll-y w-full" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900">Social Analytics</h1>
              <p className="text-xs text-gray-400">{lastRefreshed ? `Last updated ${lastRefreshed.toLocaleTimeString()}` : 'Loading...'}</p>
            </div>
            <div className="flex items-center gap-2">
              {igAccount?.profile && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-pink-50 border border-pink-100 px-3 py-1.5 rounded-xl">
                  {igAccount.profile.profilePic && (
                    <img src={igAccount.profile.profilePic} alt="ig" className="w-6 h-6 rounded-full object-cover border border-pink-200" />
                  )}
                  <span className="text-xs font-bold text-pink-600">@{igAccount.profile.username}</span>
                </div>
              )}
              {fbAccount?.profile && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                  {fbAccount.profile.profilePic && (
                    <img src={fbAccount.profile.profilePic} alt="fb" className="w-6 h-6 rounded-full object-cover border border-blue-200" />
                  )}
                  <span className="text-xs font-bold text-blue-600">{fbAccount.profile.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchAll(); fetchIgInsights(); fetchFbInsights(); }}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
              <RefreshCw size={13} /> Refresh
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mt-2">
          {[
            { key: 'overview', label: '📊 Overview' },
            { key: 'ig-insights', label: '📸 Instagram' },
            { key: 'fb-insights', label: '📘 Facebook' },
            { key: 'posts', label: '🖼️ Top Posts' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveInsightsTab(tab.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeInsightsTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-white hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 space-y-5">

        {/* ══════════════════════════════════════════════════════════
            TAB 1: OVERVIEW
        ══════════════════════════════════════════════════════════ */}
        {activeInsightsTab === 'overview' && (<>

          {/* Row 1: Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Smartphone size={18} className="text-pink-500" />}
              label="Instagram Followers"
              value={(igAccount?.profile?.followers ?? analytics?.instagram?.followers)?.toLocaleString() ?? '—'}
              sub={igAccount?.profile?.username ? `@${igAccount.profile.username}` : analytics?.instagram?.username ? `@${analytics.instagram.username}` : undefined}
              badge={igAccount ? 'Real' : 'Live'}
              badgeColor="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={<Globe size={18} className="text-blue-500" />}
              label="Facebook Followers"
              value={(fbAccount?.profile?.followers ?? analytics?.facebook?.followers)?.toLocaleString() ?? '—'}
              sub={fbAccount?.profile?.name ? `${fbAccount.profile.name} Page` : 'Requires Facebook Page API setup'}
              badge={fbAccount ? 'Real' : (analytics?.facebook?.isReal ? 'Live' : undefined)}
              badgeColor="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={<Users size={18} className="text-violet-500" />}
              label="Unique Users"
              value={(summary?.totalUsers ?? 0).toLocaleString()}
              sub="Across all platforms"
              trendVal={`+${summary?.todayIncoming ?? 0} today`}
              trend="up"
            />
            <StatCard
              icon={<Eye size={18} className="text-indigo-500" />}
              label="Total Views (Today)"
              value={((igAccount?.insights?.views ?? 0) + (fbAccount?.insights?.impressions ?? 0)).toLocaleString()}
              sub="Combined IG Views + FB Impressions"
              badge={(igAccount || fbAccount) ? 'Real' : 'N/A'}
              badgeColor={(igAccount || fbAccount) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-emerald-500" />}
              label="Total Reach (Today)"
              value={((igAccount?.insights?.reach ?? 0) + (fbAccount?.insights?.engagedUsers ?? 0)).toLocaleString()}
              sub="Combined IG Reach + FB Engaged"
              badge={(igAccount || fbAccount) ? 'Real' : 'N/A'}
              badgeColor={(igAccount || fbAccount) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}
            />
            <StatCard
              icon={<Zap size={18} className="text-yellow-500" />}
              label="Total Interactions"
              value={((igAccount?.insights?.totalInteractions ?? 0) + (fbAccount?.insights?.postEngagements ?? 0)).toLocaleString()}
              sub="Combined Engagements"
              badge={(igAccount || fbAccount) ? 'Real' : 'N/A'}
              badgeColor={(igAccount || fbAccount) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}
            />
          </div>

          {/* Row 2: Follower Growth + Engagement Breakdown */}
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Follower Growth" subtitle={(igAccount?.followerHistory?.length > 0 || fbAccount?.followerHistory?.length > 0) ? "Real data from Meta API" : "Instagram vs Facebook over time"} />
                {!igAccount?.followerHistory?.length && !fbAccount?.followerHistory?.length && (
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    {['7d', '14d'].map(p => (
                      <button key={p} onClick={() => setActiveGrowthPeriod(p)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeGrowthPeriod === p ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                        {p === '7d' ? 'Last 7 Days' : 'Last 14 Days'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  {(igAccount?.followerHistory?.length > 0 || fbAccount?.followerHistory?.length > 0) ? (
                    <AreaChart margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fbGradApi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" type="category" allowDuplicatedCategory={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-8} tickFormatter={v => v.toLocaleString()} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      {igAccount?.followerHistory && (
                        <Area data={igAccount.followerHistory} type="monotone" dataKey="followers" name="IG Followers" stroke="#ec4899" strokeWidth={2.5} fill="url(#igGrad)" dot={{ r: 3, fill: '#ec4899' }} />
                      )}
                      {fbAccount?.followerHistory && (
                        <Area data={fbAccount.followerHistory} type="monotone" dataKey="followers" name="FB Page Fans" stroke="#3b82f6" strokeWidth={2.5} fill="url(#fbGradApi)" dot={{ r: 3, fill: '#3b82f6' }} />
                      )}
                    </AreaChart>
                  ) : (
                    <AreaChart data={filteredGrowth} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="igGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fbGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-8} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      <Area type="monotone" dataKey="instagram" name="Instagram" stroke="#ec4899" strokeWidth={2.5} fill="url(#igGrad2)" dot={false} />
                      <Area type="monotone" dataKey="facebook" name="Facebook" stroke="#3b82f6" strokeWidth={2.5} fill="url(#fbGrad)" dot={false} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-5">
              <div>
                <SectionHeader title="Engagement Breakdown" subtitle="Last 7 days" />
                <div className="space-y-3.5">
                  {(() => {
                    const likes = analytics?.breakdown?.likes ?? 0;
                    const comments = analytics?.breakdown?.comments ?? 0;
                    const shares = analytics?.breakdown?.shares ?? 0;
                    const total = likes + comments + shares || 1;
                    return [
                      { label: 'Reactions', value: likes.toLocaleString(), pct: Math.round((likes/total)*100), color: 'bg-pink-500', icon: <Heart size={13} className="text-pink-500" /> },
                      { label: 'Comments', value: comments.toLocaleString(), pct: Math.round((comments/total)*100), color: 'bg-blue-500', icon: <MessageCircle size={13} className="text-blue-500" /> },
                      { label: 'Direct Messages', value: shares.toLocaleString(), pct: Math.round((shares/total)*100), color: 'bg-emerald-500', icon: <Share2 size={13} className="text-emerald-500" /> },
                    ];
                  })().map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600 font-medium text-xs">{item.icon}{item.label}</span>
                        <span className="font-bold text-gray-900 text-xs">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`${item.color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Platform Share</h3>
                <div className="space-y-3">
                  {(() => {
                    const igInt = analytics?.igInteractions ?? 0;
                    const fbInt = analytics?.fbInteractions ?? 0;
                    const total = igInt + fbInt || 1;
                    return [
                      { label: 'Instagram', pct: Math.round((igInt/total)*100), color: 'from-orange-400 to-pink-500', icon: <Smartphone size={12} className="text-pink-500" /> },
                      { label: 'Facebook', pct: Math.round((fbInt/total)*100), color: 'bg-blue-500', single: true, icon: <Globe size={12} className="text-blue-500" /> },
                    ];
                  })().map(p => (
                    <div key={p.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 text-gray-600">{p.icon} {p.label}</span>
                        <span className="font-bold text-gray-800">{p.pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`${p.single ? p.color : `bg-gradient-to-r ${p.color}`} h-1.5 rounded-full`} style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Engagement Trend + Hourly */}
          <div className="grid grid-cols-5 gap-5">
            <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <SectionHeader title="Engagement Trend" subtitle="Comments, reactions & DMs over the last 14 days" />
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementTrend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={8} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-8} allowDecimals={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="comments" name="Comments" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="reactions" name="Reactions" stroke="#ec4899" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="messages" name="DMs" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <SectionHeader title="Messages by Hour" subtitle="Incoming activity (IST)" />
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} interval={3} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Messages" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </>)}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: INSTAGRAM INSIGHTS
        ══════════════════════════════════════════════════════════ */}
        {activeInsightsTab === 'ig-insights' && (<>
          {igInsightsLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
              <p className="text-sm text-gray-500">Fetching real Instagram data...</p>
            </div>
          )}
          {igInsightsError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <p className="text-red-600 font-semibold text-sm mb-1">Instagram API Error</p>
              <p className="text-red-500 text-xs">{igInsightsError}</p>
              <p className="text-xs text-gray-400 mt-2">Check that your META_ACCESS_TOKEN in .env is valid and the account is a Business/Creator account.</p>
              <button onClick={fetchIgInsights} className="mt-3 text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition-colors">
                Retry
              </button>
            </div>
          )}
          {!igInsightsLoading && !igInsightsError && igAccount && (<>

            {/* Profile Banner */}
            <div className="bg-gradient-to-r from-orange-50 via-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-5 flex items-center gap-5">
              {igAccount.profile.profilePic && (
                <img src={igAccount.profile.profilePic} alt="profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-pink-200 shadow-sm flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-black text-gray-900 text-lg">{igAccount.profile.name}</h2>
                  <span className="text-xs bg-gradient-to-r from-orange-400 to-pink-500 text-white px-2 py-0.5 rounded-full font-bold">Instagram</span>
                </div>
                <p className="text-sm text-gray-500 mb-1">@{igAccount.profile.username}</p>
                {igAccount.profile.bio && <p className="text-xs text-gray-400 truncate">{igAccount.profile.bio}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-center flex-shrink-0">
                <div>
                  <p className="text-2xl font-black text-gray-900">{(igAccount.profile.followers || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{(igAccount.profile.mediaCount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Posts</p>
                </div>
              </div>
            </div>

            {/* 4 insight metric cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Views (Today)', value: igAccount.insights.views, icon: <Eye size={18} className="text-indigo-500" />, color: 'text-indigo-600', sub: 'Total profile/post views' },
                { label: 'Reach (Today)', value: igAccount.insights.reach, icon: <TrendingUp size={18} className="text-emerald-500" />, color: 'text-emerald-600', sub: 'Unique accounts reached' },
                { label: 'Total Interactions', value: igAccount.insights.totalInteractions, icon: <Zap size={18} className="text-yellow-500" />, color: 'text-yellow-600', sub: 'Likes, comments, saves, shares' },
                { label: 'Accounts Engaged', value: igAccount.insights.accountsEngaged, icon: <Users size={18} className="text-violet-500" />, color: 'text-violet-600', sub: 'Unique accounts who engaged' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-50 rounded-lg">{card.icon}</div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 uppercase">Real API</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                  <p className={`text-2xl font-extrabold ${card.color} mt-0.5`}>{(card.value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Follower History Chart */}
            {igAccount.followerHistory?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <SectionHeader title="Follower Growth (7 Days)" subtitle="Real data from Instagram Insights API — follower_count per day" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={igAccount.followerHistory} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="igFollGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-8} tickFormatter={v => v.toLocaleString()} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="followers" name="Followers" stroke="#ec4899" strokeWidth={2.5} fill="url(#igFollGrad)" dot={{ r: 3, fill: '#ec4899' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Post-level insights table */}
            {igPosts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <SectionHeader title="Recent Post Analytics" subtitle={`${igPosts.length} most recent posts with real insights`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 font-semibold pb-2 pr-3">Post</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2">Type</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><Eye size={11} className="inline"/> Views</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><TrendingUp size={11} className="inline"/> Reach</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><Heart size={11} className="inline"/> Likes</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><MessageCircle size={11} className="inline"/> Comm.</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><Bookmark size={11} className="inline"/> Saves</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 pl-2"><Share2 size={11} className="inline"/> Shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {igPosts.map((post, i) => (
                        <tr key={post.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              {(post.thumbnail_url || post.media_url) ? (
                                <img src={post.thumbnail_url || post.media_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                              ) : (
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  {post.media_type === 'VIDEO' ? <Film size={14} className="text-gray-400" /> : <Image size={14} className="text-gray-400" />}
                                </div>
                              )}
                              <span className="text-xs text-gray-700 truncate max-w-[140px]">{post.caption ? post.caption.slice(0, 40) + (post.caption.length > 40 ? '…' : '') : '(no caption)'}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2"><span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">{post.media_type}</span></td>
                          <td className="text-right py-2 px-2 font-semibold text-gray-800 text-xs">{(post.insights?.views || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-gray-800 text-xs">{(post.insights?.reach || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-pink-600 text-xs">{(post.insights?.likes || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-600 text-xs">{(post.insights?.comments || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-violet-600 text-xs">{(post.insights?.saves || 0).toLocaleString()}</td>
                          <td className="text-right py-2 pl-2 font-semibold text-emerald-600 text-xs">{(post.insights?.shares || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>)}
        </>)}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: FACEBOOK INSIGHTS
        ══════════════════════════════════════════════════════════ */}
        {activeInsightsTab === 'fb-insights' && (<>
          {fbInsightsLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Fetching real Facebook data...</p>
            </div>
          )}
          {fbInsightsError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <p className="text-red-600 font-semibold text-sm mb-1">Facebook API Error</p>
              <p className="text-red-500 text-xs">{fbInsightsError}</p>
              <p className="text-xs text-gray-400 mt-2">Check that your FB_PAGE_ACCESS_TOKEN in .env is valid and has `read_insights` permissions.</p>
              <button onClick={fetchFbInsights} className="mt-3 text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition-colors">
                Retry
              </button>
            </div>
          )}
          {!fbInsightsLoading && !fbInsightsError && fbAccount && (<>

            {/* Profile Banner */}
            <div className="bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 rounded-2xl border border-blue-100 p-5 flex items-center gap-5">
              {fbAccount.profile.profilePic && (
                <img src={fbAccount.profile.profilePic} alt="profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 shadow-sm flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-black text-gray-900 text-lg">{fbAccount.profile.name}</h2>
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">Facebook Page</span>
                </div>
                {fbAccount.profile.about && <p className="text-xs text-gray-500 mb-1 truncate">{fbAccount.profile.about}</p>}
                {fbAccount.profile.link && <a href={fbAccount.profile.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">{fbAccount.profile.link}</a>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-center flex-shrink-0">
                <div>
                  <p className="text-2xl font-black text-gray-900">{(fbAccount.profile.followers || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{(fbAccount.profile.likes || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Page Likes</p>
                </div>
              </div>
            </div>

            {/* 4 insight metric cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Page Impressions (Today)', value: fbAccount.insights.impressions, icon: <Eye size={18} className="text-blue-500" />, color: 'text-blue-600', sub: 'Total page impressions' },
                { label: 'Engaged Users (Today)', value: fbAccount.insights.engagedUsers, icon: <Users size={18} className="text-emerald-500" />, color: 'text-emerald-600', sub: 'Unique users who engaged' },
                { label: 'Post Engagements (Today)', value: fbAccount.insights.postEngagements, icon: <Zap size={18} className="text-orange-500" />, color: 'text-orange-600', sub: 'Clicks, stories, and reactions' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-50 rounded-lg">{card.icon}</div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 uppercase">Real API</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                  <p className={`text-2xl font-extrabold ${card.color} mt-0.5`}>{(card.value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Post-level insights table */}
            {fbPosts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <SectionHeader title="Recent Page Posts" subtitle={`${fbPosts.length} most recent posts with real insights`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 font-semibold pb-2 pr-3">Post Message</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><Eye size={11} className="inline"/> Impressions</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><TrendingUp size={11} className="inline"/> Reach (Engaged)</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><Heart size={11} className="inline"/> Reactions</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><MessageCircle size={11} className="inline"/> Comm.</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 px-2"><MousePointerClick size={11} className="inline"/> Clicks</th>
                        <th className="text-right text-xs text-gray-400 font-semibold pb-2 pl-2"><Share2 size={11} className="inline"/> Shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fbPosts.map((post, i) => (
                        <tr key={post.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              {(post.full_picture) ? (
                                <img src={post.full_picture} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                              ) : (
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Image size={14} className="text-gray-400" />
                                </div>
                              )}
                              <span className="text-xs text-gray-700 truncate max-w-[200px]">{post.message ? post.message.slice(0, 60) + (post.message.length > 60 ? '…' : '') : '(no text)'}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2 font-semibold text-gray-800 text-xs">{(post.insights?.impressions || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-gray-800 text-xs">{(post.insights?.reach || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-600 text-xs">{(post.insights?.reactions || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-600 text-xs">{(post.insights?.comments || 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-semibold text-orange-600 text-xs">{(post.insights?.clicks || 0).toLocaleString()}</td>
                          <td className="text-right py-2 pl-2 font-semibold text-emerald-600 text-xs">{(post.insights?.shares || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>)}
        </>)}

        {/* ══════════════════════════════════════════════════════════
            TAB 4: TOP POSTS GRID
        ══════════════════════════════════════════════════════════ */}
        {activeInsightsTab === 'posts' && (<>
          
          <div className="flex items-center justify-between mb-2">
            <SectionHeader
              title="Top Performing Content"
              subtitle="Ranked by total engagement (likes + comments + saves/clicks + shares)"
            />
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setTopPostsPlatform('ig')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${topPostsPlatform === 'ig' ? 'bg-white shadow text-pink-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Smartphone size={14} /> Instagram
              </button>
              <button 
                onClick={() => setTopPostsPlatform('fb')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${topPostsPlatform === 'fb' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Globe size={14} /> Facebook
              </button>
            </div>
          </div>

          {topPostsPlatform === 'ig' && (<>
            {igInsightsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
              </div>
            ) : (igTopPosts.length > 0 || igPosts.length > 0) ? (
              <div className="grid grid-cols-3 gap-4">
                {(igTopPosts.length > 0 ? igTopPosts : igPosts).map((post, i) => (
                  <PostCard key={post.media_id || post.id} platform="ig" post={{
                    id: post.media_id || post.id,
                    caption: post.caption,
                    media_type: post.media_type,
                    media_url: post.media_url,
                    thumbnail_url: post.thumbnail_url,
                    permalink: post.permalink,
                    insights: {
                      likes: post.likes || post.insights?.likes || 0,
                      comments: post.comments || post.insights?.comments || 0,
                      saves: post.saves || post.insights?.saves || 0,
                      shares: post.shares || post.insights?.shares || 0,
                      reach: post.reach || post.insights?.reach || 0,
                    }
                  }} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <LayoutGrid size={48} className="text-gray-200" />
                <p className="text-gray-500 font-semibold">No IG post data yet</p>
                <button onClick={fetchIgInsights} className="text-sm flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl transition-colors font-semibold shadow-sm">
                  <RefreshCw size={14} /> Load from Instagram
                </button>
              </div>
            )}
          </>)}

          {topPostsPlatform === 'fb' && (<>
            {fbInsightsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
              </div>
            ) : (fbTopPosts.length > 0 || fbPosts.length > 0) ? (
              <div className="grid grid-cols-3 gap-4">
                {(fbTopPosts.length > 0 ? fbTopPosts : fbPosts).map((post, i) => (
                  <PostCard key={post.post_id || post.id} platform="fb" post={{
                    id: post.post_id || post.id,
                    caption: post.message,
                    media_type: 'POST',
                    media_url: post.media_url || post.full_picture,
                    thumbnail_url: post.media_url || post.full_picture,
                    permalink: post.permalink || post.permalink_url,
                    insights: {
                      reactions: post.reactions || post.insights?.reactions || 0,
                      comments: post.comments || post.insights?.comments || 0,
                      clicks: post.clicks || post.insights?.clicks || 0,
                      shares: post.shares || post.insights?.shares || 0,
                      impressions: post.impressions || post.insights?.impressions || 0,
                    }
                  }} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <LayoutGrid size={48} className="text-gray-200" />
                <p className="text-gray-500 font-semibold">No FB post data yet</p>
                <button onClick={fetchFbInsights} className="text-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-semibold shadow-sm">
                  <RefreshCw size={14} /> Load from Facebook
                </button>
              </div>
            )}
          </>)}
        </>)}

      </div>
    </div>
  );
}
