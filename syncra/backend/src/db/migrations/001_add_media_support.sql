-- Migration: Add media support to messages table
-- Safe to run multiple times (uses IF NOT EXISTS / exception handling)

DO $$
BEGIN
  -- Add message_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
    ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
    ALTER TABLE messages ADD CONSTRAINT chk_message_type CHECK (message_type IN ('text', 'image', 'video', 'document'));
  END IF;

  -- Add media_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') THEN
    ALTER TABLE messages ADD COLUMN media_url TEXT;
  END IF;

  -- Add file_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'file_name') THEN
    ALTER TABLE messages ADD COLUMN file_name VARCHAR(255);
  END IF;

  -- Add file_size column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'file_size') THEN
    ALTER TABLE messages ADD COLUMN file_size BIGINT;
  END IF;

  -- Add mime_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mime_type') THEN
    ALTER TABLE messages ADD COLUMN mime_type VARCHAR(100);
  END IF;

  -- Make content nullable (media messages may not have text)
  ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
END $$;

-- Index on message_type for filtering
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type) WHERE message_type != 'text';
