-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "role_id" INTEGER,
    "organization_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connections" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "page_id" TEXT,
    "page_name" TEXT,
    "ig_account_id" TEXT,
    "ig_username" TEXT,
    "page_access_token" TEXT NOT NULL,
    "user_access_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" INTEGER,
    "name" TEXT,
    "profile_pic" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_to" TEXT,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "last_customer_msg_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "user_id" TEXT NOT NULL,
    "text" TEXT,
    "sender" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_users" (
    "id" TEXT NOT NULL,
    "organization_id" INTEGER,
    "name" TEXT,
    "profile_pic" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_to" TEXT,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "last_customer_msg_at" TIMESTAMP(3),

    CONSTRAINT "fb_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_messages" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "user_id" TEXT NOT NULL,
    "text" TEXT,
    "sender" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_video_comments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "comment_id" TEXT,
    "video_id" TEXT,
    "from_id" TEXT,
    "from_name" TEXT,
    "message" TEXT NOT NULL,
    "created_time" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_video_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_metrics" (
    "organization_id" INTEGER,
    "platform" TEXT NOT NULL,
    "metric_date" DATE NOT NULL,
    "followers" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "engagement" INTEGER,
    "interactions" INTEGER,
    "id" SERIAL NOT NULL,

    CONSTRAINT "social_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "platform" TEXT NOT NULL,
    "text" TEXT,
    "media_url" TEXT,
    "post_type" TEXT NOT NULL DEFAULT 'feed',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ig_post_insights" (
    "media_id" TEXT NOT NULL,
    "organization_id" INTEGER,
    "caption" TEXT,
    "media_type" TEXT,
    "media_url" TEXT,
    "permalink" TEXT,
    "thumbnail_url" TEXT,
    "timestamp" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ig_post_insights_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "fb_post_insights" (
    "post_id" TEXT NOT NULL,
    "organization_id" INTEGER,
    "message" TEXT,
    "media_url" TEXT,
    "permalink" TEXT,
    "timestamp" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_post_insights_pkey" PRIMARY KEY ("post_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_organization_id_platform_page_id_key" ON "social_connections"("organization_id", "platform", "page_id");

-- CreateIndex
CREATE UNIQUE INDEX "fb_video_comments_comment_id_key" ON "fb_video_comments"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_metrics_organization_id_platform_metric_date_key" ON "social_metrics"("organization_id", "platform", "metric_date");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_users" ADD CONSTRAINT "fb_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_messages" ADD CONSTRAINT "fb_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "fb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_video_comments" ADD CONSTRAINT "fb_video_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ig_post_insights" ADD CONSTRAINT "ig_post_insights_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_post_insights" ADD CONSTRAINT "fb_post_insights_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
