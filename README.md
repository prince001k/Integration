# Integration — Omnichannel Social Media & Customer Support Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61dafb)](frontend/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green)](backend%201/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748)](backend%201/prisma/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)](https://www.postgresql.org/)

**Integration** is an all-in-one social media engagement, messaging, and analytics suite designed for businesses and support teams. Connect Instagram and Facebook accounts to manage incoming messages, schedule content, track engagement metrics, and collaborate with team members under a multi-tenant workspace architecture.

---

## ✨ Features

- 💬 **Omnichannel Real-Time Messaging**: Unified inbox for Instagram Direct Messages, Facebook Messenger, and post/video comments powered by **Socket.IO**.
- 👥 **Multi-Tenant Workspaces & RBAC**: Organization-level isolation with granular Role-Based Access Control (Admins, Agents, Custom Roles) and ticket/agent assignment.
- 📅 **Content Scheduling & Calendar**: Visual calendar to plan, draft, and schedule posts, stories, and reels for Instagram and Facebook.
- 📊 **Real-Time Analytics Dashboard**: Track follower growth, reach, impressions, customer engagement rates, SLA response times, and sentiment trends.
- ⚡ **Quick Replies**: Save reusable message templates for rapid agent response times.
- 🔔 **Meta Webhooks Integration**: Real-time event consumption for Instagram messaging, Facebook lead/comment interactions, and token management.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Real-Time**: [Socket.IO Client](https://socket.io/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Database ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Real-Time**: [Socket.IO](https://socket.io/)
- **Storage**: Local filesystem / AWS S3 via Multer
- **Scheduling**: `node-cron`
- **Social APIs**: Meta Graph API (v19.0+)

---

## 📁 Project Structure

```plaintext
Integration/
├── backend 1/
│   ├── jobs/             # Scheduled background workers (post publishing, sync)
│   ├── lib/              # Prisma client and utility singletons
│   ├── middleware/       # JWT auth & request validation middlewares
│   ├── prisma/           # Database schema & migrations
│   ├── routes/           # REST endpoints (api, auth, webhooks)
│   ├── services/         # Meta Graph API and storage adapters
│   ├── .env.example      # Sample backend environment variables
│   ├── package.json      # Backend dependencies and scripts
│   └── server.js         # Express & Socket.IO application server
├── frontend/
│   ├── public/           # Static assets and icons
│   ├── src/              # React components, pages, dashboard, tabs
│   ├── package.json      # Frontend dependencies and scripts
│   └── vite.config.js    # Vite configuration
├── .gitignore            # Git ignore rules
├── LICENSE               # MIT License
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or later)
- **PostgreSQL** (running locally or cloud instance)
- **Meta for Developers Account** (for Facebook & Instagram app credentials)

---

### 1. Backend Setup

1. Open your terminal and navigate to the backend folder:
   ```bash
   cd "backend 1"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Example `.env`:
   ```env
   DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/instagram_chat"
   PORT=5000
   JWT_SECRET="your-super-secret-jwt-key"
   META_ACCESS_TOKEN="your_meta_page_access_token"
   VERIFY_TOKEN="your_webhook_verification_token"
   ```

4. Push the Prisma schema to your PostgreSQL database:
   ```bash
   npx prisma db push
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000` (or your configured `PORT`).

---

### 2. Frontend Setup

1. In a new terminal window, navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set up frontend environment variables:
   Create a `.env` file inside `frontend/` if you want to override default API paths:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🔒 Security Best Practices

- Never commit `.env` or production API secrets to version control.
- Ensure all incoming Meta Webhook requests validate signatures with your App Secret.
- Rate-limiting and JWT token authentication are enforced across all protected API routes.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

## 👤 Author

Developed by **[prince001k](https://github.com/prince001k)**.
