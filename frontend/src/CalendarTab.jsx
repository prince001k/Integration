import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, FileText, Tag, Folder, ChevronDown, ChevronLeft, ChevronRight, 
  MoreHorizontal, Image as ImageIcon, Link, Camera, Smile, Hash, FilePlus, UserPlus, 
  MapPin, AtSign, Globe, Smartphone, Send, Trash2, Plus, Edit3 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('agentToken');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
};
export default function CalendarTab({ currentAgent }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasConnections, setHasConnections] = useState(null);
  
  // Date State
  const [currentDate, setCurrentDate] = useState(new Date()); 
  
  // Modal / Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [selectedDayPost, setSelectedDayPost] = useState(null);

  // Form state
  const [platform, setPlatform] = useState('instagram');
  const [postType, setPostType] = useState('feed');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // Check if agent has connections
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

  const fetchPosts = async () => {
    try {
      const r = await authenticatedFetch(`${API_URL}/api/schedule`);
      if (r.ok) {
        const data = await r.json();
        setPosts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (hasConnections === false) return; // Don't fetch if no connections
    fetchPosts();
    const interval = setInterval(fetchPosts, 30000); 
    return () => clearInterval(interval);
  }, [hasConnections]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduledAt) return alert('Please select a scheduled time');
    setLoading(true);

    try {
      let media_url = null;
      if (publicUrl) {
        media_url = publicUrl;
      } else if (file) {
        const formData = new FormData();
        formData.append('media', file);
        const uploadRes = await authenticatedFetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error);
        media_url = uploadData.url;
      }

      const scheduleRes = await authenticatedFetch(`${API_URL}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, text, media_url, scheduled_at: scheduledAt, post_type: postType })
      });
      const scheduleData = await scheduleRes.json();
      if (scheduleData.error) throw new Error(scheduleData.error);
      
      // Reset form
      setText('');
      setFile(null);
      setPublicUrl('');
      setScheduledAt('');
      setShowCompose(false);
      fetchPosts();
    } catch (err) {
      alert('Error scheduling post: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return;
    try {
      await authenticatedFetch(`${API_URL}/api/schedule/${id}`, { method: 'DELETE' });
      setSelectedDayPost(null);
      fetchPosts();
    } catch (err) {
      alert('Error deleting post');
    }
  };

  // Helper functions for Calendar
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const today = new Date();

  // Group posts by date
  const postsByDate = {};
  posts.forEach(post => {
    const d = new Date(post.scheduled_at);
    if (d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()) {
      const day = d.getDate();
      if (!postsByDate[day]) postsByDate[day] = [];
      postsByDate[day].push(post);
    }
  });

  if (hasConnections === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8f9fa] h-full p-8 text-center font-['Inter']">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
          <CalendarIcon size={36} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No integrations yet</h2>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          Connect your Facebook or Instagram account to start planning and scheduling your social media posts here.
        </p>
        <button
          onClick={() => window.location.href = '/?tab=integrations'}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
        >
          Connect your accounts →
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-['Inter'] p-4 gap-4 relative">
      
      {/* Subtle dot grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}></div>

      {/* STATIC SIDEBAR */}
      <div className="w-52 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-shrink-0 z-10 p-4 h-fit self-start">
        <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 px-1">Publish</h3>
        <nav className="space-y-0.5">
          <button className="w-full flex items-center gap-3 bg-indigo-50 text-indigo-600 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <CalendarIcon size={16} className="text-indigo-500 flex-shrink-0" /> 
            <span>All Posts</span>
          </button>
          <button className="w-full flex items-center gap-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 px-3 py-2.5 rounded-xl text-sm font-medium transition-all">
            <FileText size={16} className="flex-shrink-0" /> 
            <span>Drafts</span>
          </button>
          <button className="w-full flex items-center gap-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 px-3 py-2.5 rounded-xl text-sm font-medium transition-all">
            <Tag size={16} className="flex-shrink-0" /> 
            <span>Content Tags</span>
          </button>
          <button className="w-full flex items-center gap-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 px-3 py-2.5 rounded-xl text-sm font-medium transition-all">
            <Folder size={16} className="flex-shrink-0" /> 
            <span>Assets Library</span>
          </button>
        </nav>
      </div>

      {/* MAIN CALENDAR AREA */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col z-10 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100 gap-2">
          
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50">
               <button onClick={handlePrevMonth} className="p-1.5 rounded-md text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700 transition-all"><ChevronLeft size={16}/></button>
               <button onClick={handleNextMonth} className="p-1.5 rounded-md text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700 transition-all"><ChevronRight size={16}/></button>
            </div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight whitespace-nowrap ml-1 sm:ml-2">
               {monthName} <span className="text-slate-400 font-medium">{year}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative flex-shrink-0">
            <div className="hidden md:flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
              <button className="bg-white text-slate-800 px-3.5 py-1.5 rounded-md text-[11px] font-bold shadow-sm">Month</button>
              <button className="text-slate-500 px-3.5 py-1.5 rounded-md text-[11px] font-bold hover:text-slate-700 transition-colors">Year</button>
            </div>
            
            <button onClick={() => setShowCompose(true)} className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-indigo-200">
               <Plus size={16} /> <span className="hidden sm:inline">Compose</span>
            </button>
          </div>
        </div>

        {/* CALENDAR GRID */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Days of week */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white sticky top-0 z-20">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
              <div key={d} className={`text-center py-2.5 text-[10px] uppercase tracking-wider font-bold ${i === 0 ? 'text-rose-500' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          {/* Grid Cells - fills remaining height */}
          <div className="flex-1 grid grid-cols-7" style={{gridAutoRows: '1fr'}}>
            {Array.from({ length: 35 }).map((_, i) => {
              const day = i - firstDay + 1;
              const isCurrentMonth = day > 0 && day <= daysInMonth;
              const displayDay = isCurrentMonth ? day : (day <= 0 ? getDaysInMonth(year, currentDate.getMonth()-1) + day : day - daysInMonth);
              const dayPosts = isCurrentMonth ? (postsByDate[day] || []) : [];
              const isToday = isCurrentMonth && day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

              return (
                <div key={i} 
                  onClick={() => {
                    if (isCurrentMonth) {
                      const selectedDate = new Date(year, currentDate.getMonth(), day, 12, 0);
                      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                      const localISOTime = (new Date(selectedDate - tzoffset)).toISOString().slice(0, 16);
                      setScheduledAt(localISOTime);
                      setShowCompose(true);
                    }
                  }}
                  className={`p-1.5 sm:p-2 flex flex-col min-h-[85px] border-b border-r border-slate-100/70 transition-colors ${!isCurrentMonth ? 'bg-slate-50/50' : 'bg-white hover:bg-indigo-50/30 cursor-pointer'} ${i % 7 === 6 ? 'border-r-0' : ''}`}
                >
                  <div className="flex justify-start mb-1">
                     <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : (isCurrentMonth ? 'text-slate-700' : 'text-slate-300')}`}>
                       {displayDay}
                     </span>
                  </div>

                  {/* Scheduled Posts */}
                  <div className="space-y-1 overflow-y-auto no-scrollbar pb-1">
                    {dayPosts.map((p, idx) => (
                       <div key={p.id || idx} onClick={(e) => { e.stopPropagation(); setSelectedDayPost(p); }} 
                            className={`group relative text-[10px] text-white rounded-md px-1.5 py-1 flex items-center justify-between cursor-pointer shadow-sm hover:shadow transition-all ${p.platform === 'facebook' ? 'bg-[#1877f2] hover:bg-[#166fe5]' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'}`}>
                          <div className="flex items-center gap-1.5">
                             {p.platform === 'facebook' ? <Globe size={10} className="opacity-80"/> : <Smartphone size={10} className="opacity-80"/>}
                             <span className="font-semibold truncate max-w-[50px] hidden xl:inline">{p.post_type}</span>
                          </div>
                          <span className="font-bold opacity-90 group-hover:opacity-100">1</span>
                       </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SELECTED POST POPOVER CARD */}
      {selectedDayPost && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={() => setSelectedDayPost(null)}></div>
            
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
               <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                     <CalendarIcon size={16} className="text-indigo-500"/>
                     {new Date(selectedDayPost.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })}
                  </h3>
                  <button onClick={() => setSelectedDayPost(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><MoreHorizontal size={18}/></button>
               </div>
               
               <div className="p-5 flex-1 bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 relative flex-shrink-0 shadow-sm border border-indigo-200/50">
                        <span className="font-black italic text-sm uppercase">{selectedDayPost.platform.slice(0,2)}</span>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                           {selectedDayPost.platform === 'facebook' ? <Globe size={12} className="text-[#1877f2]"/> : <Smartphone size={12} className="text-pink-500"/>}
                        </div>
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 leading-tight capitalize truncate">{selectedDayPost.platform} Page</h4>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                           {new Date(selectedDayPost.scheduled_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                           <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                           <span className="font-semibold text-indigo-600">{selectedDayPost.post_type}</span>
                        </div>
                     </div>
                  </div>
                  
                  <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap leading-relaxed">{selectedDayPost.text}</p>
                  
                  {selectedDayPost.media_url && (
                     <div className="rounded-xl overflow-hidden border border-slate-200/60 shadow-sm bg-black relative group">
                        {selectedDayPost.media_url.match(/\.(mp4|mov)$/i) ? (
                           <video src={`${API_URL}${selectedDayPost.media_url}`} className="w-full h-48 object-cover" controls/>
                        ) : (
                           <img src={`${API_URL}${selectedDayPost.media_url}`} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105" alt="Media"/>
                        )}
                     </div>
                  )}
               </div>
               
               <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-1">
                     <button onClick={() => handleDelete(selectedDayPost.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                     <button className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"><Edit3 size={16}/></button>
                  </div>
                  <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm">
                     Publish Now
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* COMPOSE NEW POST MODAL — compact, no scroll needed */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
               <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                 <Edit3 size={15} className="text-indigo-500"/> Compose New Post
               </h3>
               <button onClick={() => setShowCompose(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
               </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Row 1: Platform + Post Type side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Platform</label>
                  <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                    <button type="button" onClick={() => setPlatform('facebook')}
                      className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                        platform === 'facebook' ? 'bg-white shadow-sm text-[#1877f2]' : 'text-slate-400 hover:text-slate-600'
                      }`}>
                      <Globe size={13} /> FB
                    </button>
                    <button type="button" onClick={() => setPlatform('instagram')}
                      className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                        platform === 'instagram' ? 'bg-white shadow-sm text-pink-600' : 'text-slate-400 hover:text-slate-600'
                      }`}>
                      <Smartphone size={13} /> IG
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Post Type</label>
                  <div className="relative">
                    <select value={postType} onChange={e => setPostType(e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-300 bg-slate-50 text-slate-700 cursor-pointer">
                      <option value="feed">Feed Post</option>
                      <option value="story">Story</option>
                      <option value="reel">Reel</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none"/>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Caption</label>
                <textarea
                  required rows="3" value={text} onChange={e => setText(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none bg-slate-50 placeholder-slate-400 transition-all"
                  placeholder="What do you want to share?"
                ></textarea>
                {/* Toolbar */}
                <div className="flex items-center gap-2.5 mt-2 px-0.5">
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><Camera size={15}/></button>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><Smile size={15}/></button>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><Hash size={15}/></button>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><FilePlus size={15}/></button>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><Link size={15}/></button>
                  <div className="w-px h-3.5 bg-slate-200"></div>
                  <button type="button" className="text-emerald-500 flex items-center gap-1 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded transition-colors">
                    <UserPlus size={12}/> Approval
                  </button>
                  <div className="w-px h-3.5 bg-slate-200"></div>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><MapPin size={15}/></button>
                  <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors"><AtSign size={15}/></button>
                </div>
              </div>

              {/* Media — compact single row */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="relative">
                  <input type="file" onChange={e => { setFile(e.target.files[0]); setPublicUrl(''); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*,video/*" />
                  <div className={`flex items-center gap-3 p-3 transition-all ${
                    file ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'
                  }`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      file ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-slate-200 text-slate-400'
                    }`}>
                      <ImageIcon size={18}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{file ? file.name : 'Upload Photo or Video'}</p>
                      <p className="text-[10px] text-slate-400">{file ? 'Ready' : 'Click to browse'}</p>
                    </div>
                    {file && <button type="button" onClick={() => setFile(null)} className="text-rose-400 hover:text-rose-600 text-[10px] font-bold flex-shrink-0 z-20 relative">✕</button>}
                  </div>
                </div>
                <div className="border-t border-slate-200 bg-white px-3 py-2">
                  <input type="url" placeholder="Or paste image/video URL…" value={publicUrl}
                    onChange={e => { setPublicUrl(e.target.value); setFile(null); }}
                    className="w-full text-xs text-slate-600 placeholder-slate-400 focus:outline-none bg-transparent font-medium" />
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Schedule Date & Time</label>
                <input type="datetime-local" required value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 bg-slate-50 font-semibold text-slate-700 cursor-pointer" />
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
                {loading ? 'Scheduling…' : 'Schedule Post'} <Send size={14} className={loading ? 'animate-pulse' : ''}/>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
