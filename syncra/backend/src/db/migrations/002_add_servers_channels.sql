-- Migration 002: Add servers, channels, roles, invites, message enhancements
-- Safe to re-run (all uses IF NOT EXISTS / IF EXISTS checks)

-- ============================================================
-- SERVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SERVER MEMBERS + ROLES
-- ============================================================
DO $$ BEGIN
    CREATE TYPE server_role AS ENUM ('owner', 'admin', 'moderator', 'member');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS server_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role server_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, user_id)
);

-- ============================================================
-- CHANNEL CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS channel_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CHANNELS
-- ============================================================
DO $$ BEGIN
    CREATE TYPE channel_type AS ENUM ('text', 'voice', 'announcement');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    topic VARCHAR(1024),
    type channel_type NOT NULL DEFAULT 'text',
    position INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SERVER INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS server_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_uses INTEGER,
    uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ENHANCE MESSAGES: add channel_id, reply_to, edited flags
-- ============================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- MESSAGE REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- ============================================================
-- PINNED MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_channels_category_id ON channels(category_id);
CREATE INDEX IF NOT EXISTS idx_channel_categories_server_id ON channel_categories(server_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_server_invites_code ON server_invites(code);
CREATE INDEX IF NOT EXISTS idx_server_invites_server_id ON server_invites(server_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_channel_id ON pinned_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_conversation_id ON pinned_messages(conversation_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_servers_updated_at ON servers;
CREATE TRIGGER update_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
