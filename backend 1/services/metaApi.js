'use strict';
/**
 * services/metaApi.js
 * All Meta (Facebook / Instagram) API calls in one place.
 * MULTI-TENANT: Every function that calls Meta takes a `token` parameter
 * from the database (SocialConnection.pageAccessToken), NOT from .env
 */
const axios = require('axios');

const IG_GRAPH = 'https://graph.instagram.com/v26.0';
const FB_GRAPH = 'https://graph.facebook.com/v21.0';

// ── Profile Fetchers ──────────────────────────────────────────────────────────

const fbProfileCache = {};

async function getFacebookUserProfile(psid, pageToken) {
    const cacheKey = `${psid}:${pageToken?.slice(-8)}`;
    if (fbProfileCache[cacheKey]) return fbProfileCache[cacheKey];
    const token = pageToken || (process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
    if (!token) return { name: `FB User ${psid}`, profilePic: null };
    try {
        const res = await axios.get(
            `${FB_GRAPH}/${psid}?fields=first_name,last_name,profile_pic&access_token=${token}`
        );
        const name = `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || `FB User ${psid}`;
        const profilePic = res.data.profile_pic || null;
        fbProfileCache[cacheKey] = { name, profilePic };
        return { name, profilePic };
    } catch (err) {
        return { name: `FB User ${psid}`, profilePic: null };
    }
}

async function getInstagramUserProfile(userId, igToken) {
    const token = igToken || (process.env.META_ACCESS_TOKEN || '').trim().replace(/^"|"$/g, '');
    try {
        const url  = `${IG_GRAPH}/${userId}?fields=name,profile_pic&access_token=${encodeURIComponent(token)}`;
        const res  = await fetch(url);
        const data = await res.json();
        return {
            name:       data?.name      || `User ${userId}`,
            profilePic: data?.profile_pic || null
        };
    } catch { return { name: `User ${userId}`, profilePic: null }; }
}

async function getInstagramMediaDetails(mediaId, igToken) {
    const token = igToken || (process.env.META_ACCESS_TOKEN || '').trim().replace(/^"|"$/g, '');
    try {
        const url = `${IG_GRAPH}/${mediaId}?fields=permalink,media_url,thumbnail_url&access_token=${encodeURIComponent(token)}`;
        return await (await fetch(url)).json();
    } catch { return null; }
}

// ── Analytics Fetchers (per-workspace token) ─────────────────────────────────

async function fetchIgFollowers(igToken) {
    const token = (igToken || process.env.META_ACCESS_TOKEN || '').trim().replace(/^"|"$/g, '');
    if (!token) return { followers: null, isReal: false };
    try {
        const url  = `${IG_GRAPH}/me?fields=id,followers_count,media_count,username,account_type&access_token=${encodeURIComponent(token)}`;
        const data = await (await fetch(url)).json();
        if (data && !data.error && data.followers_count !== undefined) {
            return { followers: data.followers_count, media_count: data.media_count || 0, username: data.username, account_type: data.account_type, isReal: true };
        }
    } catch(e) { /* silent */ }
    return { followers: null, isReal: false };
}

async function fetchFbFollowers(pageToken) {
    const token = (pageToken || process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
    if (!token) return { followers: null, isReal: false };
    try {
        const res = await axios.get(`${FB_GRAPH}/me?fields=fan_count,followers_count,name&access_token=${token}`);
        const followers = res.data.fan_count ?? res.data.followers_count ?? null;
        if (followers !== null) return { followers, name: res.data.name, isReal: true };
    } catch(e) { /* silent */ }
    return { followers: null, isReal: false };
}

// ── Post Publishers ──────────────────────────────────────────────────────────

const FormData = require('form-data');
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:5001';

async function uploadImageBinary(imageUrl, endpoint, token, extraFields = {}) {
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer   = Buffer.from(imgRes.data);
    const mimeType = imgRes.headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
    const extMap   = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
    const ext      = extMap[mimeType] || 'jpg';
    const form     = new FormData();
    form.append('access_token', token);
    form.append('source', buffer, { filename: `upload.${ext}`, contentType: mimeType, knownLength: buffer.length });
    for (const [k, v] of Object.entries(extraFields)) form.append(k, v);
    return axios.post(endpoint, form, { headers: form.getHeaders() });
}

async function publishFbPhoto(mediaUrl, pageToken, fbEndpoint, extraFields = {}) {
    const isLocal     = mediaUrl.startsWith('/uploads/');
    const encodedPath = mediaUrl.split('/').map(encodeURIComponent).join('/');
    const fullUrl     = mediaUrl.startsWith('http') ? mediaUrl : `${PUBLIC_URL}${encodedPath}`;
    if (isLocal) return axios.post(fbEndpoint, { url: fullUrl, access_token: pageToken, ...extraFields });
    return uploadImageBinary(fullUrl, fbEndpoint, pageToken, extraFields);
}

/**
 * Publish a ScheduledPost to Facebook or Instagram.
 * Uses the page/IG token from the SocialConnection table — NOT .env
 */
async function publishPost(post, connection) {
    if (!connection) throw new Error(`No social connection found for post ${post.id}`);

    const fbToken = connection.pageAccessToken;
    const igToken = connection.userAccessToken || connection.pageAccessToken;

    if (post.platform === 'facebook') {
        if (post.postType === 'story') {
            if (!post.mediaUrl) throw new Error('Story requires media');
            const fullUrl = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${PUBLIC_URL}${post.mediaUrl}`;
            const isVideo = /\.(mp4|mov)$/i.test(fullUrl);
            if (isVideo) {
                const vidRes  = await axios.get(fullUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
                const videoBuffer  = Buffer.from(vidRes.data);
                const startRes = await axios.post(`${FB_GRAPH}/me/video_stories`, { upload_phase: 'START', file_size: videoBuffer.length, access_token: fbToken });
                const { upload_session_id, video_id, start_offset } = startRes.data;
                await axios.post(`https://rupload.facebook.com/video-upload/v21.0/${video_id}`, videoBuffer, {
                    headers: { Authorization: `OAuth ${fbToken}`, offset: start_offset || '0', file_size: videoBuffer.length, 'Content-Type': 'application/octet-stream' }
                });
                await axios.post(`${FB_GRAPH}/me/video_stories`, { upload_phase: 'FINISH', upload_session_id, video_id, access_token: fbToken });
            } else {
                const photoRes = await publishFbPhoto(post.mediaUrl, fbToken, `${FB_GRAPH}/me/photos`, { published: 'false' });
                const photoId  = photoRes.data?.id;
                if (!photoId) throw new Error('Failed to get photo_id');
                await axios.post(`${FB_GRAPH}/me/photo_stories`, { photo_id: photoId, access_token: fbToken });
            }
        } else if (post.postType === 'reel') {
            const fullUrl = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${PUBLIC_URL}${post.mediaUrl}`;
            await axios.post(`${FB_GRAPH}/me/videos`, { file_url: fullUrl, description: post.text || '', access_token: fbToken });
        } else {
            if (post.mediaUrl) {
                const fullUrl = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${PUBLIC_URL}${post.mediaUrl}`;
                if (/\.(mp4|mov)$/i.test(fullUrl)) {
                    await axios.post(`${FB_GRAPH}/me/videos`, { file_url: fullUrl, description: post.text || '', access_token: fbToken });
                } else {
                    await publishFbPhoto(post.mediaUrl, fbToken, `${FB_GRAPH}/me/photos`, { message: post.text || '' });
                }
            } else {
                await axios.post(`${FB_GRAPH}/me/feed`, { message: post.text || '', access_token: fbToken });
            }
        }
    } else if (post.platform === 'instagram') {
        const meRes = await axios.get(`${IG_GRAPH}/me?fields=id&access_token=${igToken}`);
        const igId  = meRes.data.id;
        if (!post.mediaUrl) throw new Error('Instagram requires media to publish.');
        const fullUrl = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${PUBLIC_URL}${post.mediaUrl}`;
        let mediaPayload = { image_url: fullUrl, caption: post.text || '', access_token: igToken };
        if (post.postType === 'story')     mediaPayload = { image_url: fullUrl, media_type: 'STORIES', access_token: igToken };
        else if (post.postType === 'reel') mediaPayload = { video_url: fullUrl, media_type: 'REELS', caption: post.text || '', share_to_feed: true, access_token: igToken };
        const createRes = await axios.post(`${IG_GRAPH}/${igId}/media`, mediaPayload);
        const creationId = createRes.data.id;
        if (!creationId) throw new Error('Instagram media creation failed');
        if (post.postType === 'reel' || (post.postType === 'story' && /\.(mp4|mov)$/i.test(fullUrl))) {
            for (let i = 0; i < 12; i++) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const statusRes = await axios.get(`${FB_GRAPH}/${creationId}?fields=status_code&access_token=${igToken}`);
                    if (statusRes.data.status_code === 'FINISHED') break;
                    if (statusRes.data.status_code === 'ERROR') throw new Error('Video processing failed on Instagram');
                } catch(err) { if (err.message === 'Video processing failed on Instagram') throw err; }
            }
        }
        await axios.post(`${IG_GRAPH}/${igId}/media_publish`, { creation_id: creationId, access_token: igToken });
    } else {
        throw new Error(`Unknown platform: ${post.platform}`);
    }
}

module.exports = {
    getFacebookUserProfile, getInstagramUserProfile, getInstagramMediaDetails,
    fetchIgFollowers, fetchFbFollowers, publishPost,
    IG_GRAPH, FB_GRAPH
};
