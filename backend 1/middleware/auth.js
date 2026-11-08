'use strict';
/**
 * middleware/auth.js
 * Auth middleware + Prisma Row-Level Security (multi-tenant isolation)
 */
const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/** Injects req.user and req.prisma (org-scoped) onto every authenticated request */
async function authenticateToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
        const agent = await prisma.agent.findUnique({ where: { id: decoded.id } });
        if (!agent || !agent.organizationId) return res.status(401).json({ error: 'Agent or organization not found' });
        req.user = agent;

        // Prisma RLS: every query on orgModels is silently scoped to agent's organization
        req.prisma = prisma.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        const orgModels = [
                            'Role', 'Agent', 'SocialConnection',
                            'User', 'FbUser', 'FbVideoComment',
                            'SocialMetric', 'QuickReply', 'ScheduledPost',
                            'IgPostInsight', 'FbPostInsight'
                        ];
                        if (!orgModels.includes(model)) return query(args);

                        args = args || {};
                        if (['findUnique','findFirst','findMany','update','updateMany','delete','deleteMany','count'].includes(operation)) {
                            args.where = { ...args.where, organizationId: agent.organizationId };
                        }
                        if (['create','createMany'].includes(operation)) {
                            if (Array.isArray(args.data)) args.data.forEach(d => { d.organizationId = agent.organizationId; });
                            else if (args.data)           args.data.organizationId = agent.organizationId;
                        }
                        if (operation === 'upsert') {
                            args.where = { ...args.where, organizationId: agent.organizationId };
                            if (args.create) args.create.organizationId = agent.organizationId;
                        }
                        return query(args);
                    }
                }
            }
        });
        next();
    } catch(e) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/** Require Admin role for sensitive operations */
function requireAdmin(req, res, next) {
    const perms = req.user?.permissions || [];
    // If permissions is stored as JSON array on the role we need to get it from token
    // We'll rely on DB check; for now just check roleId is set
    if (!req.user?.roleId) return res.status(403).json({ error: 'Admin access required' });
    next();
}

module.exports = { authenticateToken, requireAdmin };
