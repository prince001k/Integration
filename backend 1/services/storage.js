'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// S3 Configuration
// You need these variables in your .env if you want to use S3:
// S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
const useS3 = !!process.env.S3_BUCKET;

let storage;

if (useS3) {
    console.log('[Storage] AWS S3 bucket configured. File uploads will go to S3.');
    const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
    });

    storage = multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET,
        acl: 'public-read', // Depending on your bucket settings
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            const orgId = req.user?.organizationId || 'shared';
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${orgId}/${Date.now()}-${safeName}`;
            cb(null, fileName);
        }
    });
} else {
    console.log('[Storage] No S3_BUCKET found in .env. Falling back to local disk storage.');
    storage = multer.diskStorage({
        destination: (req, _file, cb) => {
            const orgId = req.user?.organizationId || 'shared';
            const folder = path.join(__dirname, '..', 'uploads', String(orgId));
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
            cb(null, folder);
        },
        filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, Date.now() + '-' + safeName);
        }
    });
}

const upload = multer({ 
    storage, 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

module.exports = {
    upload,
    useS3
};
