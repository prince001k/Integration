'use strict';
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const cookieParser = require('cookie-parser');
const path         = require('path');
const { Server }   = require('socket.io');

// ─── App Init ─────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 5001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Static uploads (org-scoped folders: /uploads/{orgId}/filename)
app.use('/uploads', (req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
}, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const { router: apiRoutes } = require('./routes/api');

app.use('/api/auth', authRoutes);
app.use('/',         webhookRoutes(io));     // /fb/webhook, /webhook
app.use('/api',      apiRoutes);

// Meta OAuth (kept in server.js as it's a redirect flow, not a JSON API)
const axios = require('axios');
const prisma = require('./lib/prisma');

const META_API_VERSION  = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_URL    = `https://graph.facebook.com/${META_API_VERSION}`;
const PUBLIC_URL        = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || `${PUBLIC_URL}/auth/meta/callback`;

app.get('/auth/meta', (req, res) => {
    if (!process.env.META_APP_ID || process.env.META_APP_ID === '123456789') {
        return res.status(400).send(`<html><body style="font-family:sans-serif;padding:2rem;background:#1e293b;color:#f1f5f9"><h2 style="color:#f97316">⚠️ Meta App Not Configured</h2><p>Please add your <strong>META_APP_ID</strong> and <strong>META_APP_SECRET</strong> to your backend .env file.</p><a href="https://developers.facebook.com/apps/" style="color:#60a5fa">→ Open Meta Developer Dashboard</a></body></html>`);
    }
    const permissions = ['pages_show_list','pages_read_engagement','instagram_basic','instagram_manage_insights'].join(',');
    const authUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${encodeURIComponent(process.env.META_APP_ID)}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&scope=${encodeURIComponent(permissions)}&response_type=code&state=${encodeURIComponent(req.query.agentId || '')}`;
    res.redirect(authUrl);
});

app.get('/auth/meta/callback', async (req, res) => {
    const { code, state } = req.query;
    const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (!code) return res.redirect(`${FRONTEND}/?tab=integrations&error=missing_code`);
    try {
        const tokenRes = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, { params: { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: META_REDIRECT_URI, code } });
        const userAccessToken = tokenRes.data.access_token;
        const pagesRes = await axios.get(`${META_GRAPH_URL}/me/accounts`, { params: { fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: userAccessToken } });
        const pages = pagesRes.data.data || [];
        const agentId = parseInt(state) || null;
        let organizationId = null;
        if (agentId) {
            const agent = await prisma.agent.findUnique({ where: { id: agentId } });
            organizationId = agent?.organizationId;
        }
        if (organizationId && pages.length > 0) {
            for (const page of pages) {
                const igAccount = page.instagram_business_account;
                await prisma.socialConnection.upsert({
                    where:  { organizationId_platform_pageId: { organizationId, platform: 'facebook', pageId: page.id } },
                    update: { pageName: page.name, pageAccessToken: page.access_token, userAccessToken, igAccountId: igAccount?.id || null, igUsername: igAccount?.username || null, connectedAt: new Date() },
                    create: { organizationId, platform: 'facebook', pageId: page.id, pageName: page.name, pageAccessToken: page.access_token, userAccessToken, igAccountId: igAccount?.id || null, igUsername: igAccount?.username || null }
                });
            }
            console.log(`[OAuth] Saved ${pages.length} page(s) for org ${organizationId}`);
        }
        res.redirect(`${FRONTEND}/?tab=integrations&success=true`);
    } catch(e) {
        console.error('[OAuth] Failed:', e.response?.data || e.message);
        res.redirect(`${FRONTEND}/?tab=integrations&error=true`);
    }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
    console.log('[Socket.IO] Frontend connected');
    socket.on('disconnect', () => console.log('[Socket.IO] Frontend disconnected'));
});

// ─── DB Init ──────────────────────────────────────────────────────────────────
async function initDB() {
    console.log('Database ready (Prisma).');
    // Note: Role seeding is now per-workspace (done in /api/auth/register)
    // Quick reply seeding is also per-workspace now
}

initDB().catch(err => { console.error('DB init failed:', err); process.exit(1); });

// ─── Background Jobs ──────────────────────────────────────────────────────────
require('./jobs/scheduler')(io);

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`   Instagram webhook: ${PUBLIC_URL}/webhook`);
    console.log(`   Facebook webhook:  ${PUBLIC_URL}/fb/webhook`);
    console.log(`   Connected to PostgreSQL via Prisma ORM`);
});
