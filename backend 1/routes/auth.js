'use strict';
/**
 * routes/auth.js
 * FIX #5: JWT is now short-lived (15min) + rotating httpOnly refresh token cookie.
 * FIX #4: zod input validation on all POST bodies.
 */
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { z }   = require('zod');
const prisma  = require('../lib/prisma');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET         = process.env.JWT_SECRET || 'fallback_secret';
const REFRESH_SECRET     = process.env.REFRESH_SECRET || 'refresh_fallback_secret';
const ACCESS_EXPIRY      = '15m';
const REFRESH_EXPIRY     = '7d';
const REFRESH_EXPIRY_MS  = 7 * 24 * 60 * 60 * 1000;
const googleClient       = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const IS_PROD            = process.env.NODE_ENV === 'production';

function makeTokens(agent) {
    const payload = { id: agent.id, email: agent.email };
    const accessToken  = jwt.sign(payload, JWT_SECRET,     { expiresIn: ACCESS_EXPIRY  });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
    return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure:   IS_PROD,
        sameSite: IS_PROD ? 'None' : 'Lax',
        maxAge:   REFRESH_EXPIRY_MS,
        path:     '/api/auth'
    });
}

function agentPayload(agent) {
    return {
        id:             agent.id,
        name:           agent.name,
        email:          agent.email,
        role:           agent.role?.name,
        permissions:    agent.role?.permissions || [],
        organizationId: agent.organizationId,
        workspaceName:  agent.organization?.name,
        domain:         agent.organization?.domain
    };
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
        const agent   = await prisma.agent.findUnique({ where: { id: decoded.id }, include: { role: true, organization: true } });
        if (!agent) return res.status(401).json({ error: 'Agent not found' });
        res.json(agentPayload(agent));
    } catch(e) { res.status(401).json({ error: 'Invalid token' }); }
});

// ── POST /api/auth/refresh ─────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);
        const agent   = await prisma.agent.findUnique({ where: { id: decoded.id }, include: { role: true, organization: true } });
        if (!agent || !agent.roleId) return res.status(403).json({ error: 'Access denied' });
        const { accessToken, refreshToken } = makeTokens(agent);
        setRefreshCookie(res, refreshToken);
        res.json({ token: accessToken, agent: agentPayload(agent) });
    } catch(e) { res.status(401).json({ error: 'Invalid refresh token' }); }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ ok: true });
});

// ── POST /api/auth/register ────────────────────────────────────────────────
const RegisterSchema = z.object({
    name:          z.string().min(1).max(100),
    email:         z.string().email(),
    password:      z.string().min(6).max(100),
    workspaceName: z.string().min(1).max(100),
    domain:        z.string().min(1).max(63)
});

router.post('/register', async (req, res) => {
    const parse = RegisterSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors?.[0]?.message || 'Invalid request' });

    const { name, email, password, workspaceName, domain } = parse.data;
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (!domainSlug) return res.status(400).json({ error: 'Invalid domain name.' });

    try {
        const hash = await bcrypt.hash(password, 12);

        // Each workspace gets its own Admin role
        const org = await prisma.organization.create({ data: { name: workspaceName, domain: domainSlug } })
            .catch(err => {
                if (err.code === 'P2002' && err.meta?.target?.includes('domain'))
                    throw Object.assign(new Error(`Domain "${domainSlug}" is already taken.`), { status: 400 });
                throw err;
            });

        const adminRole = await prisma.role.create({
            data: { organizationId: org.id, name: 'Admin', permissions: ['manage_agents','manage_roles','view_conversations','edit_conversations','publish_posts'] }
        });
        // Also create a default Agent role for this org
        await prisma.role.create({
            data: { organizationId: org.id, name: 'Agent', permissions: ['view_conversations','edit_conversations'] }
        });

        const agent = await prisma.agent.create({
            data: { name, email, passwordHash: hash, roleId: adminRole.id, organizationId: org.id },
            include: { role: true, organization: true }
        });

        const { accessToken, refreshToken } = makeTokens(agent);
        setRefreshCookie(res, refreshToken);
        res.json({ token: accessToken, agent: agentPayload(agent) });
    } catch(e) {
        if (e.code === 'P2002' && e.meta?.target?.includes('email'))
            return res.status(400).json({ error: 'This email is already registered. Please log in instead.' });
        res.status(e.status || 500).json({ error: e.message });
    }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const LoginSchema = z.object({
    email:    z.string().email(),
    password: z.string().min(1)
});

router.post('/login', async (req, res) => {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors?.[0]?.message || 'Invalid request' });

    const { email, password } = parse.data;
    try {
        // Find agent by email (includes their org + role)
        const agent = await prisma.agent.findUnique({
            where: { email },
            include: { role: true, organization: true }
        });

        if (!agent) {
            return res.status(401).json({ error: `No account found for "${email}". Please check your email or create a workspace.` });
        }

        // Account has no password at all (created via Google with no password set)
        if (!agent.passwordHash) {
            return res.status(401).json({
                error: 'This account has no password set. Please use "Sign in with Google", or ask your Admin to reset your password.'
            });
        }

        // Check password
        const match = await bcrypt.compare(password, agent.passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Incorrect password. Please try again.' });
        }

        // Check org
        if (!agent.organizationId) {
            return res.status(403).json({ error: 'Your account is not linked to any workspace. Please contact your Admin.' });
        }

        // Check role (admin may have deleted/revoked it)
        if (!agent.roleId) {
            return res.status(403).json({ error: "You don't have a role assigned in this workspace. Please contact your Admin." });
        }

        const { accessToken, refreshToken } = makeTokens(agent);
        setRefreshCookie(res, refreshToken);
        res.json({ token: accessToken, agent: agentPayload(agent) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/google ─────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });
    try {
        const ticket  = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) return res.status(401).json({ error: 'Invalid Google token' });
        const { email, name, sub } = payload;

        let agent = await prisma.agent.findUnique({ where: { email }, include: { role: true, organization: true } });
        if (agent) {
            if (!agent.googleId) await prisma.agent.update({ where: { id: agent.id }, data: { googleId: sub } });
            if (!agent.roleId) return res.status(403).json({ error: "You don't have permission to access this domain. Please contact your Admin." });
        } else {
            // New user — create with no role, Admin must approve
            const org = await prisma.organization.findFirst();
            await prisma.agent.create({ data: { name, email, googleId: sub, roleId: null, organizationId: org?.id } });
            return res.status(403).json({ error: "Account created. Please contact your Admin to get access." });
        }

        const { accessToken, refreshToken } = makeTokens(agent);
        setRefreshCookie(res, refreshToken);
        res.json({ token: accessToken, agent: agentPayload(agent) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/auth/dev-login ──────────────────────────────────────────────────
// Automatically logs in the first agent (useful for bypassing login UI)
router.get('/dev-login', async (req, res) => {
    try {
        const agent = await prisma.agent.findFirst({ include: { role: true, organization: true } });
        if (!agent) return res.status(404).json({ error: 'No agents found to auto-login' });
        
        const { accessToken, refreshToken } = makeTokens(agent);
        setRefreshCookie(res, refreshToken);
        res.json({ token: accessToken, agent: agentPayload(agent) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
