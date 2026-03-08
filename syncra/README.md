# Syncra

A production-ready real-time 1-to-1 chat application built with clean architecture and scaling-ready design.

![Syncra Logo](./frontend/public/syncra-icon.svg)

## 🎯 Core Philosophy

Syncra represents **synchronization**. The architecture is clean, modular, and scalable-ready. The UI is intentionally designed to feel:

- **Minimal** - No clutter, focused on communication
- **Structured** - Clear visual hierarchy
- **Calm** - Restrained color palette
- **Engineered** - Thoughtful spacing and interactions
- **Portfolio-worthy** - Production-quality code

## 🏗 Tech Stack

### Frontend
- **React 18** (JavaScript)
- **Tailwind CSS v4** - Modern CSS-first styling
- **Zustand** - State management
- **Socket.io Client** - Real-time communication
- **Framer Motion** - Animations
- **date-fns** - Date formatting
- **Vite** - Build tool

### Backend
- **Node.js** + **Express**
- **Socket.io** - WebSocket server
- **PostgreSQL** (Supabase) - Primary database
- **Redis** - Online presence & pub/sub
- **JWT** - Authentication
- **bcrypt** - Password hashing

## 📁 Project Structure

```
syncra/
├── README.md                 # This file
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── config/          # Configuration (Redis)
│   │   ├── controllers/     # HTTP controllers
│   │   ├── services/        # Business logic
│   │   ├── routes/          # API routes
│   │   ├── sockets/         # Socket.io handlers
│   │   ├── middleware/      # Auth middleware
│   │   ├── db/              # Database layer
│   │   └── server.js        # Main server entry
│   ├── package.json
│   └── .env.example
│
└── frontend/                 # React + Tailwind v4 frontend
    ├── src/
    │   ├── components/      # UI components
    │   ├── pages/           # Route pages
    │   ├── store/           # Zustand stores
    │   ├── socket/          # Socket.io client
    │   ├── hooks/           # Custom hooks
    │   ├── utils/           # Utility functions
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css        # Tailwind v4 CSS-first config
    ├── public/
    ├── package.json
    ├── vite.config.js
    └── postcss.config.js
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works) or local PostgreSQL 14+
- Redis 7+

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string → URI**
3. Copy the connection string (it looks like `postgresql://postgres.[ref]:[password]@...`)
4. You'll paste this as `DATABASE_URL` in your `.env` file

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Set DATABASE_URL to your Supabase connection string
# Set JWT_SECRET to a strong random value

# Initialize database
npm run db:init

# Start server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🎨 Tailwind CSS v4

This project uses **Tailwind CSS v4** with the new CSS-first configuration approach:

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-surface-50: #f8fafc;
  --color-surface-100: #f1f5f9;
  /* ... */
  --color-primary-600: #2563eb;
  /* ... */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

Key differences from v3:
- No `tailwind.config.js` - configuration is in CSS
- Uses `@import "tailwindcss"` instead of directives
- `@theme` block for custom tokens
- No `autoprefixer` needed

## 🔌 Socket Events

### Client → Server
- `message:send` - Send a message
- `message:seen` - Mark messages as seen
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

### Server → Client
- `message:new` - New message received
- `message:sent` - Message sent confirmation
- `message:delivered` - Message delivered
- `message:seen` - Messages seen by recipient
- `user:online` - User came online
- `user:offline` - User went offline
- `typing:update` - Typing status update

## 🗄 Database Schema

### Users
- `id` (UUID, PK)
- `username` (VARCHAR, unique)
- `email` (VARCHAR, unique)
- `password_hash` (VARCHAR)
- `created_at` (TIMESTAMP)

### Conversations
- `id` (UUID, PK)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Conversation Participants
- `id` (UUID, PK)
- `conversation_id` (UUID, FK)
- `user_id` (UUID, FK)

### Messages
- `id` (UUID, PK)
- `conversation_id` (UUID, FK)
- `sender_id` (UUID, FK)
- `content` (TEXT)
- `status` (ENUM: sent, delivered, seen)
- `created_at` (TIMESTAMP)

## 🔐 Authentication

JWT-based authentication with:
- Access tokens (7-day expiry)
- Protected REST endpoints
- Socket.io handshake validation
- bcrypt password hashing (12 rounds)

## 📦 Building for Production

### Frontend
```bash
cd frontend
npm run build
# Output: dist/
```

### Backend
```bash
cd backend
npm start
```

## 🐳 Docker Deployment

### Quick Start (Docker Compose)

```bash
# 1. Copy environment file and configure
cp .env.example .env

# 2. Generate a strong JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Paste into .env as JWT_SECRET

# 3. Set strong passwords for DB_PASSWORD and REDIS_PASSWORD in .env

# 4. Build and start all services
docker compose up -d --build

# 5. View logs
docker compose logs -f
```

The app will be available at `http://localhost` (nginx serves frontend and proxies API/WebSocket).

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Nginx     │────▶│   Backend    │────▶│ PostgreSQL │
│  (Frontend) │     │  (Node.js)   │     └────────────┘
│   :80       │     │   :3001      │────▶┌────────────┐
└─────────────┘     └──────────────┘     │   Redis    │
                                         └────────────┘
```

- **Nginx** serves the frontend SPA and reverse-proxies `/api/*` and `/socket.io/*` to the backend
- **Backend** runs Express + Socket.io
- **PostgreSQL** stores users, conversations, and messages
- **Redis** handles online presence and pub/sub for scaling

### Deploying to a VPS

```bash
# On your server
git clone <repo-url> syncra && cd syncra
cp .env.example .env
# Edit .env with production values:
#   CLIENT_URL=https://yourdomain.com
#   VITE_API_URL=https://yourdomain.com/api
#   VITE_SOCKET_URL=https://yourdomain.com

docker compose up -d --build
```

For HTTPS, put a reverse proxy like Caddy or Traefik in front, or use Cloudflare Tunnel.

### Deploying to Railway / Render / Fly.io

For PaaS platforms, deploy backend and frontend separately:

**Backend:**
- Set root directory to `backend/`
- Build command: `npm install`
- Start command: `npm start`
- Set all environment variables from `.env.example`

**Frontend:**
- Set root directory to `frontend/`
- Build command: `npm install && npm run build`
- Publish directory: `dist/`
- Set `VITE_API_URL` and `VITE_SOCKET_URL` to your backend URL

## � Environment Variables

Copy the example env file and configure:

```bash
cd backend
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `CLIENT_URL` | Frontend URL (CORS). Comma-separated for multiple origins | `http://localhost:5173` |
| `DATABASE_URL` | Supabase/PostgreSQL connection string | — |
| `DB_HOST` | PostgreSQL host (if not using `DATABASE_URL`) | `localhost` |
| `DB_PORT` | PostgreSQL port (if not using `DATABASE_URL`) | `5432` |
| `DB_NAME` | Database name (if not using `DATABASE_URL`) | `syncra` |
| `DB_USER` | Database user (if not using `DATABASE_URL`) | `postgres` |
| `DB_PASSWORD` | Database password (if not using `DATABASE_URL`) | `password` |
| `REDIS_URL` | Redis connection URL (for managed Redis) | — |
| `REDIS_HOST` | Redis host (if not using `REDIS_URL`) | `localhost` |
| `REDIS_PORT` | Redis port (if not using `REDIS_URL`) | `6379` |
| `REDIS_PASSWORD` | Redis password (if not using `REDIS_URL`) | _(empty)_ |
| `JWT_SECRET` | **Required.** Secret key for JWT signing (min 32 chars in production) | — |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |

### Frontend Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001/api` |
| `VITE_SOCKET_URL` | Socket.io server URL | `http://localhost:3001` |

## �🚧 Scope (MVP)

✅ Implemented:
- 1-to-1 real-time messaging
- Message status tracking (sent/delivered/seen)
- Online presence with Redis
- Dark/light theme
- User search
- Conversation list
- Typing indicators
- Tailwind CSS v4

❌ Not in MVP:
- Group chat
- File uploads
- Voice/video calls
- Message reactions
- Message editing/deletion

## 📄 License

MIT License - feel free to use this project for learning or as a foundation for your own applications.

---

Built with intention and care. Every line of code is deliberate.
