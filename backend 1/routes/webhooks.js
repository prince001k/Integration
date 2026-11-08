'use strict';
/**
 * routes/webhooks.js
 * Facebook + Instagram webhooks.
 * MULTI-TENANT: Routes each incoming message to the correct org via SocialConnection lookup.
 */
const router  = require('express').Router();
const prisma  = require('../lib/prisma');
const metaApi = require('../services/metaApi');

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'Facebook@123';
const IG_VERIFY_TOKEN = process.env.VERIFY_TOKEN    || 'instagram_verify_123';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertUser(userId, name, profilePic, organizationId) {
    await prisma.user.upsert({
        where:  { id: userId.toString() },
        update: { name, profilePic: profilePic || undefined, lastMessageAt: new Date() },
        create: { id: userId.toString(), name, profilePic: profilePic || null, lastMessageAt: new Date(), organizationId }
    });
}

async function upsertFbUser(userId, name, profilePic, organizationId) {
    await prisma.fbUser.upsert({
        where:  { id: userId.toString() },
        update: { name, profilePic: profilePic || undefined, lastMessageAt: new Date() },
        create: { id: userId.toString(), name, profilePic: profilePic || null, lastMessageAt: new Date(), organizationId }
    });
}

async function detectSentiment(text) {
    if (!text?.trim()) return 'neutral';
    const lower = text.toLowerCase();
    const pos = ['thank','great','awesome','love','good'].filter(w => lower.includes(w)).length;
    const neg = ['bad','terrible','awful','hate','worst'].filter(w => lower.includes(w)).length;
    if (neg > pos) return 'negative';
    if (pos > neg) return 'positive';
    return 'neutral';
}

async function updateSentiment(userId, platform, text) {
    const sentiment = await detectSentiment(text);
    if (platform === 'facebook') {
        await prisma.fbUser.update({ where: { id: userId }, data: { sentiment, lastCustomerMsgAt: new Date() } });
    } else {
        await prisma.user.update({ where: { id: userId }, data: { sentiment, lastCustomerMsgAt: new Date() } });
    }
}

/** Find org by the FB page ID or IG account ID in the incoming webhook entry */
async function resolveOrgFromEntry(entryId) {
    const connection = await prisma.socialConnection.findFirst({
        where: { OR: [{ pageId: entryId }, { igAccountId: entryId }] }
    });
    if (connection) return connection;
    // Fallback if no integration was performed — use correct env tokens per platform
    const defaultOrg = await prisma.organization.findFirst();
    if (!defaultOrg) return null;
    return {
        organizationId: defaultOrg.id,
        pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '',
        userAccessToken: process.env.META_ACCESS_TOKEN || ''
    };
}

// ── Facebook Webhook ──────────────────────────────────────────────────────────

module.exports = function webhookRoutes(io) {
    router.get('/fb/webhook', (req, res) => {
        const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
        if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
            console.log('[FB] Webhook verified.');
            return res.status(200).send(challenge);
        }
        res.sendStatus(403);
    });

    router.post('/fb/webhook', async (req, res) => {
        const body = req.body;
        if (body.object !== 'page') return res.sendStatus(404);
        res.status(200).send('EVENT_RECEIVED'); // Respond immediately to Meta

        try {
            for (const entry of body.entry || []) {
                const conn = await resolveOrgFromEntry(entry.id);
                if (!conn) { console.log('[FB Webhook] Unknown page:', entry.id); continue; }
                const { organizationId, pageAccessToken } = conn;

                for (const event of entry.messaging || []) {
                    const senderId = event.sender?.id;
                    if (!event.message || event.message.is_echo || !senderId) continue;
                    const profile = await metaApi.getFacebookUserProfile(senderId, pageAccessToken);
                    await upsertFbUser(senderId, profile.name, profile.profilePic, organizationId);

                    let messageText = event.message.text || '';
                    // Handle media attachments (image, video, audio, file)
                    if (!messageText && event.message.attachments?.length) {
                        const att = event.message.attachments[0];
                        const attUrl = att.payload?.url || '';
                        messageText = `[${att.type}] ${attUrl}`;
                    }
                    if (!messageText) continue;

                    await prisma.fbMessage.create({ data: { userId: senderId.toString(), text: messageText, sender: 'customer', organizationId } });
                    await updateSentiment(senderId, 'facebook', messageText);
                    io.emit('fb_new_message', { senderId, name: profile.name, text: messageText });
                }

                for (const change of entry.changes || []) {
                    if (change.field !== 'feed' && change.field !== 'videos') continue;
                    const val = change.value;
                    if (!val || !(val.item === 'comment' || val.verb === 'add') || !val.message) continue;
                    const commentData = {
                        organizationId,
                        commentId:   val.comment_id || val.id || null,
                        videoId:     val.video_id || val.post_id || null,
                        fromId:      val.from?.id || null,
                        fromName:    val.from?.name || 'Unknown',
                        message:     val.message,
                        createdTime: BigInt(val.created_time || Math.floor(Date.now() / 1000))
                    };
                    try {
                        if (commentData.commentId) {
                            await prisma.fbVideoComment.upsert({ where: { commentId: commentData.commentId }, update: {}, create: commentData });
                        } else {
                            await prisma.fbVideoComment.create({ data: commentData });
                        }
                    } catch(e) { console.error('[FB] Comment DB error:', e.message); }
                    io.emit('fb_new_comment', { ...commentData, createdTime: commentData.createdTime.toString(), timestamp: new Date().toISOString() });
                }
            }
        } catch(e) { console.error('[FB Webhook] Error:', e); }
    });

    // ── Instagram Webhook ──────────────────────────────────────────────────────

    router.get('/webhook', (req, res) => {
        const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
        if (mode === 'subscribe' && token === IG_VERIFY_TOKEN) {
            console.log('[IG] Webhook verified.');
            return res.status(200).send(challenge);
        }
        res.sendStatus(403);
    });

    router.post('/webhook', async (req, res) => {
        const body = req.body;
        if (body.object !== 'instagram' && body.object !== 'page') return res.sendStatus(404);
        res.status(200).send('EVENT_RECEIVED'); // Respond immediately

        try {
            for (const entry of body.entry || []) {
                const conn = await resolveOrgFromEntry(entry.id);
                if (!conn) { console.log('[IG Webhook] Unknown account:', entry.id); continue; }
                const { organizationId, userAccessToken, pageAccessToken } = conn;
                const igToken = userAccessToken || pageAccessToken;

                for (const messagingItem of entry.messaging || []) {
                    const senderId = messagingItem.sender?.id;
                    if (messagingItem.message && !messagingItem.message.is_echo && senderId) {
                        let text = messagingItem.message.text || '';
                        // Handle media attachments (images, videos, audio sent by user)
                        if (!text && messagingItem.message.attachments?.length) {
                            const att = messagingItem.message.attachments[0];
                            const attUrl = att.payload?.url || '';
                            text = `[${att.type}] ${attUrl}`;
                        }
                        if (!text) continue;
                        const profile = await metaApi.getInstagramUserProfile(senderId, igToken);
                        await upsertUser(senderId, profile.name, profile.profilePic, organizationId);
                        await prisma.message.create({ data: { userId: senderId.toString(), text, sender: 'customer', organizationId } });
                        updateSentiment(senderId.toString(), 'instagram', text).catch(() => {});
                        io.emit('new_message', { userId: senderId.toString() });
                    } else if (messagingItem.reaction?.reaction && senderId) {
                        const reaction = messagingItem.reaction.reaction;
                        const profile  = await metaApi.getInstagramUserProfile(senderId, igToken);
                        await upsertUser(senderId, profile.name, profile.profilePic, organizationId);
                        await prisma.message.create({ data: { userId: senderId.toString(), text: `[Reacted to message]: ${reaction}`, sender: 'customer', organizationId } });
                    }
                }

                for (const change of entry.changes || []) {
                    if (change.field === 'comments') {
                        const cv = change.value;
                        if (!cv?.from) continue;
                        const senderId = cv.from.id;
                        let text = `[Comment]: ${cv.text || 'Media interaction'}`;
                        if (cv.media?.id) {
                            const mediaData = await metaApi.getInstagramMediaDetails(cv.media.id, igToken);
                            if (mediaData?.permalink) {
                                const imageUrl = mediaData.thumbnail_url || mediaData.media_url || '';
                                text += ` |||LINK|||${mediaData.permalink}|||IMAGE|||${imageUrl}`;
                            }
                        }
                        const profile  = await metaApi.getInstagramUserProfile(senderId, igToken);
                        const userName = cv.from.username || profile.name;
                        if (profile.profilePic) text += `|||AVATAR|||${profile.profilePic}`;
                        await upsertUser(senderId, userName, profile.profilePic, organizationId);
                        await prisma.message.create({ data: { userId: senderId.toString(), text, sender: 'customer', organizationId } });
                        updateSentiment(senderId.toString(), 'instagram', cv.text || '').catch(() => {});
                        io.emit('new_message', { userId: senderId.toString() });
                    } else if (change.field === 'mentions') {
                        const mv = change.value;
                        if (!mv) continue;
                        const senderId = mv.sender_id || 'Unknown';
                        const profile  = await metaApi.getInstagramUserProfile(senderId, igToken);
                        await upsertUser(senderId, profile.name, profile.profilePic, organizationId);
                        await prisma.message.create({ data: { userId: senderId.toString(), text: `[Comment]: Mentioned you in their ${mv.media_type || 'Story/Post'}`, sender: 'customer', organizationId } });
                    }
                }
            }
        } catch(e) { console.error('[IG Webhook] Error:', e); }
    });

    return router;
};
