/** Esquema criado automaticamente na partida (CREATE ... IF NOT EXISTS). */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    city TEXT NOT NULL,
    uf CHAR(2) NOT NULL,
    city_key TEXT NOT NULL,
    receive_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS users_city_idx ON users (city_key)`,
  `CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT NOT NULL,
    color TEXT,
    size TEXT,
    sex TEXT,
    photo_id UUID REFERENCES images(id) ON DELETE SET NULL,
    tag_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('perdido','avistado')),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','arquivado')),
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    animal_name TEXT,
    species TEXT NOT NULL,
    breed TEXT NOT NULL,
    color TEXT,
    size TEXT,
    sex TEXT,
    description TEXT NOT NULL,
    reward TEXT,
    city TEXT NOT NULL,
    uf CHAR(2) NOT NULL,
    city_key TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    last_seen_at TIMESTAMPTZ,
    image_ids TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmation_requested_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS alerts_city_idx ON alerts (city_key, status)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy INTEGER,
    message TEXT,
    scanner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];
