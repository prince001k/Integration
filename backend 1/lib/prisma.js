'use strict';
/**
 * lib/prisma.js  – Singleton Prisma client shared across the app
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
