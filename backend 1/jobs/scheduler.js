'use strict';
/**
 * jobs/scheduler.js
 * All background cron jobs.
 * FIX #1: Analytics and Scheduled Posts now iterate over EACH organization's
 *          SocialConnection tokens — no more hardcoded .env tokens for published content.
 */
const cron    = require('node-cron');
const prisma  = require('../lib/prisma');
const metaApi = require('../services/metaApi');

module.exports = function startJobs(io) {

    // ── SLA Breach Detector (every 5 min, global) ──────────────────────────────
    cron.schedule('*/5 * * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
            await prisma.user.updateMany({
                where: { lastCustomerMsgAt: { lt: cutoff }, slaBreached: false },
                data:  { slaBreached: true }
            });
            await prisma.fbUser.updateMany({
                where: { lastCustomerMsgAt: { lt: cutoff }, slaBreached: false },
                data:  { slaBreached: true }
            });
        } catch(e) { console.error('[SLA Cron]', e.message); }
    });

    // ── Crisis Alert (every 5 min, global) ────────────────────────────────────
    let lastMsgCount = 0;
    cron.schedule('*/5 * * * *', async () => {
        try {
            const since = new Date(Date.now() - 5 * 60 * 1000);
            const [ig, fb] = await Promise.all([
                prisma.message.count({ where: { sender: 'customer', timestamp: { gte: since } } }),
                prisma.fbMessage.count({ where: { sender: 'customer', timestamp: { gte: since } } }),
            ]);
            const count = ig + fb;
            if (count > 10 && count > lastMsgCount) {
                io.emit('crisis_alert', { message: `🚨 Crisis Alert: ${count} messages in the last 5 minutes!`, count });
            }
            lastMsgCount = count;
        } catch(e) { /* silence */ }
    });

    // ── Analytics Poller (every 5 min, PER-ORG) ───────────────────────────────
    // FIX #1: Loops through every org's SocialConnection and uses THEIR token
    cron.schedule('*/5 * * * *', async () => {
        try {
            const orgs = await prisma.organization.findMany({ include: { connections: true } });
            const today = new Date(new Date().toISOString().split('T')[0]);

            for (const org of orgs) {
                const fbConn = org.connections.find(c => c.platform === 'facebook');
                const igConn = org.connections.find(c => c.igAccountId != null);

                if (igConn) {
                    const igStats = await metaApi.fetchIgFollowers(igConn.userAccessToken || igConn.pageAccessToken);
                    if (igStats.isReal && igStats.followers !== null) {
                        await prisma.socialMetric.upsert({
                            where:  { organizationId_platform_metricDate: { organizationId: org.id, platform: 'instagram', metricDate: today } },
                            update: { followers: igStats.followers },
                            create: { organizationId: org.id, platform: 'instagram', metricDate: today, followers: igStats.followers }
                        });
                    }
                }

                if (fbConn) {
                    const fbStats = await metaApi.fetchFbFollowers(fbConn.pageAccessToken);
                    if (fbStats.isReal && fbStats.followers !== null) {
                        await prisma.socialMetric.upsert({
                            where:  { organizationId_platform_metricDate: { organizationId: org.id, platform: 'facebook', metricDate: today } },
                            update: { followers: fbStats.followers },
                            create: { organizationId: org.id, platform: 'facebook', metricDate: today, followers: fbStats.followers }
                        });
                    }
                }
            }
        } catch(e) { console.error('[Analytics Cron]', e.message); }
    });

    // ── Scheduled Post Publisher (every minute, PER-ORG) ──────────────────────
    // FIX #1: Looks up the org's SocialConnection and uses THEIR token to publish
    cron.schedule('* * * * *', async () => {
        try {
            const posts = await prisma.scheduledPost.findMany({
                where: { status: 'pending', scheduledAt: { lte: new Date() } }
            });

            for (const post of posts) {
                try {
                    if (!post.organizationId) throw new Error('Post has no organizationId');

                    // Get the correct token for this post's org + platform
                    const connection = await prisma.socialConnection.findFirst({
                        where: {
                            organizationId: post.organizationId,
                            platform: post.platform
                        }
                    });

                    if (!connection) {
                        console.warn(`[Scheduler] No ${post.platform} connection for org ${post.organizationId}, post ${post.id}`);
                        await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'failed' } });
                        continue;
                    }

                    await metaApi.publishPost(post, connection);
                    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'published' } });
                    console.log(`[Scheduler] Published post ${post.id} for org ${post.organizationId}`);
                } catch(e) {
                    console.error(`[Scheduler] Failed post ${post.id}:`, e.response?.data || e.message);
                    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'failed' } }).catch(() => {});
                }
            }
        } catch(e) { console.error('[Scheduler Cron]', e.message); }
    });

    console.log('[Jobs] All background jobs started.');
};
