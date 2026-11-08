import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, MessageCircle, Camera, Globe, Settings, ExternalLink, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('agentToken');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
};
export default function IntegrationsTab({ currentAgent }) {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const [configStatus, setConfigStatus] = useState({ loading: true, metaConfigured: false, fbConnected: false, igConnected: false, connections: [] });

  useEffect(() => {
    const agentId = currentAgent?.id;
    const url = agentId
      ? `${API_URL}/api/integrations/status?agentId=${agentId}`
      : `${API_URL}/api/integrations/status`;
    authenticatedFetch(url)
      .then(r => r.json())
      .then(data => setConfigStatus({ loading: false, ...data }))
      .catch(() => setConfigStatus({ loading: false, metaConfigured: false, fbConnected: false, igConnected: false, connections: [] }));
  }, [currentAgent]);

  const connectMeta = (platform) => {
    if (!configStatus.metaConfigured) return;
    const agentId = currentAgent?.id || '';
    window.location.href = `${API_URL}/auth/meta?platform=${platform}&agentId=${agentId}`;
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-200 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-slate-400 mb-8">Connect your social media and messaging channels to the dashboard.</p>

        {success && (
          <div className="mb-6 p-4 bg-green-900/40 border border-green-500 rounded-lg flex items-center gap-3 text-green-300">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Social account connected successfully! Your analytics will sync shortly.</span>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500 rounded-lg flex items-center gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Connection failed. Please try again.</span>
          </div>
        )}

        {/* Setup Warning */}
        {!configStatus.loading && !configStatus.metaConfigured && (
          <div className="mb-8 p-5 bg-amber-900/30 border border-amber-600 rounded-xl">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-300 mb-1">Meta Developer App Not Configured</h3>
                <p className="text-sm text-amber-200/80 mb-3">
                  To connect Facebook or Instagram, you need to create a Meta Developer App and add your App ID & Secret to the backend <code className="bg-black/30 px-1 rounded">.env</code> file.
                </p>
                <ol className="text-sm text-amber-200/70 space-y-1 list-decimal list-inside mb-3">
                  <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline text-amber-300 hover:text-amber-100">developers.facebook.com</a> and create a Business App</li>
                  <li>Copy your <strong>App ID</strong> and <strong>App Secret</strong></li>
                  <li>Add to your backend <code className="bg-black/30 px-1 rounded">.env</code>:</li>
                </ol>
                <pre className="text-xs bg-black/40 border border-amber-700/50 rounded p-3 text-amber-100 mb-3">
{`META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:5001/auth/meta/callback`}
                </pre>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <ExternalLink className="w-3 h-3" /> Open Meta Developer Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Instagram */}
          <div className={`bg-slate-800 rounded-xl border ${configStatus.igConnected ? 'border-green-500/50' : 'border-slate-700'} p-6 flex flex-col items-start shadow-sm hover:border-slate-600 transition-colors`}>
            <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 text-white">
              <Camera className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-white">Instagram</h3>
              {configStatus.igConnected && <span className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full">Connected</span>}
            </div>
            {configStatus.connections?.filter(c => c.igUsername).map(c => (
              <p key={c.id} className="text-xs text-slate-400 mb-1">📷 @{c.igUsername}</p>
            ))}
            <p className="text-slate-400 text-sm mb-6 flex-1">
              Connect your Instagram Business or Creator account to view analytics, posts, and reply to DMs.
            </p>
            <button
              onClick={() => connectMeta('instagram')}
              disabled={!configStatus.metaConfigured}
              className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm
                ${configStatus.metaConfigured
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white cursor-pointer'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              {configStatus.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {configStatus.igConnected ? 'Reconnect Instagram' : 'Connect Instagram'}
            </button>
          </div>

          {/* Facebook */}
          <div className={`bg-slate-800 rounded-xl border ${configStatus.fbConnected ? 'border-green-500/50' : 'border-slate-700'} p-6 flex flex-col items-start shadow-sm hover:border-slate-600 transition-colors`}>
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 text-white">
              <Globe className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-white">Facebook</h3>
              {configStatus.fbConnected && <span className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full">Connected</span>}
            </div>
            {configStatus.connections?.filter(c => c.platform === 'facebook').map(c => (
              <p key={c.id} className="text-xs text-slate-400 mb-1">📄 {c.pageName}</p>
            ))}
            <p className="text-slate-400 text-sm mb-6 flex-1">
              Connect your Facebook Page to view page analytics, posts, comments, and manage messages.
            </p>
            <button
              onClick={() => connectMeta('facebook')}
              disabled={!configStatus.metaConfigured}
              className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm
                ${configStatus.metaConfigured
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              {configStatus.fbConnected ? 'Reconnect Facebook' : 'Connect Facebook'}
            </button>
          </div>

          {/* WhatsApp */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-start shadow-sm hover:border-slate-600 transition-colors">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4 text-white">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-white">WhatsApp Business</h3>
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Coming Soon</span>
            </div>
            <p className="text-slate-400 text-sm mb-6 flex-1">
              Connect your WhatsApp Business API to reply to customer messages directly from the omnichannel inbox.
            </p>
            <button
              disabled
              className="w-full bg-slate-700 text-slate-500 cursor-not-allowed font-medium py-2.5 rounded-lg text-sm"
            >
              Coming Soon
            </button>
          </div>

        </div>

        {/* How it works */}
        <div className="mt-10 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h3 className="font-semibold text-white mb-3">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-slate-400">
            {[
              { step: '1', label: 'Click Connect', desc: 'Click the connect button for your platform' },
              { step: '2', label: 'Login with Meta', desc: 'You are redirected to Facebook to log in securely' },
              { step: '3', label: 'Grant Access', desc: 'Approve the permissions for your Page/account' },
              { step: '4', label: 'Done!', desc: 'Your analytics and messages sync automatically' },
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">{s.step}</div>
                <div className="font-medium text-slate-300">{s.label}</div>
                <div className="text-xs">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
