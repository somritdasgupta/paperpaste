# PaperPaste

[![CI](https://github.com/somritdasgupta/paperpaste/actions/workflows/ci.yml/badge.svg)](https://github.com/somritdasgupta/paperpaste/actions/workflows/ci.yml)
[![CodeQL](https://github.com/somritdasgupta/paperpaste/actions/workflows/codeql.yml/badge.svg)](https://github.com/somritdasgupta/paperpaste/actions/workflows/codeql.yml)
[![Security Audit](https://github.com/somritdasgupta/paperpaste/actions/workflows/security-audit.yml/badge.svg)](https://github.com/somritdasgupta/paperpaste/actions/workflows/security-audit.yml)

A secure, real-time clipboard sharing application with zero-knowledge end-to-end encryption. Share text, code, and files instantly across multiple devices with complete privacy.

## Features

### Security & Privacy

- **Zero-knowledge encryption** - Server cannot read your data
- **AES-256-GCM encryption** with session-specific keys
- **Client-side encryption/decryption** for maximum security
- **Complete file encryption** including names and metadata
- **Enhanced timestamp encryption** for activity privacy
- **Anonymous device identification** with encrypted metadata

### Real-time Synchronization

- **Instant content sharing** across all connected devices
- **Live device presence** indicators
- **Automatic sync** with manual refresh fallback
- **Real-time updates** using WebSocket connections

### User Experience

- **Responsive design** for all device sizes
- **QR code scanning** for quick device pairing
- **One-click copy** with visual feedback
- **Dark/light theme** support
- **Mobile-optimized** interface

## Quick Start

1. Visit the application
2. Create or join a session with a code
3. Start sharing content across your devices
4. Use QR codes for mobile pairing

## Security Architecture

- **Framework:** Next.js 15.2.4 with App Router
- **UI Library:** React 19 with TypeScript 5
- **Styling:** Tailwind CSS 4.1.9 with custom animations
- **Components:** Radix UI primitives for accessibility
- **Icons:** Lucide React for consistent iconography

### **Backend & Database**

- **Database:** Supabase (PostgreSQL) with real-time subscriptions
- **Authentication:** Session-based with anonymous device tracking
- **Real-time:** WebSocket connections with automatic reconnection
- **Security:** Row-level security policies and encrypted storage

### Encryption Details

**Key Generation**

```javascript
sessionKey = PBKDF2(sessionCode + salt, 100000 iterations)
```

**Content Flow**

```
Text/Code → AES-256-GCM → Base64 → Database → Decrypt → Display
Files → ArrayBuffer → AES-256-GCM → Base64 → Database → Decrypt → Download
```

**What's Encrypted**

- Text and code content
- File data, names, and metadata
- Device names and system information
- Creation and modification timestamps
- Human-readable item identifiers

**What's Not Encrypted**

- Session codes (required for joining)
- Anonymous device IDs (technical requirement)
- Server timestamps (cleanup only)
- Database primary keys (technical requirement)

## Technology Stack

- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Supabase** for backend and real-time features
- **Web Crypto API** for encryption
- **Tailwind CSS** for styling

## Installation

1. **Clone and install**

   ```bash
   git clone https://github.com/somritdasgupta/paperpaste.git
   cd paperpaste
   pnpm install
   ```

2. **Environment setup**

   ```bash
   cp .env.example .env.local
   # Add your Supabase credentials
   ```

3. **Database setup**

   ```bash
   pnpm dev
   # Visit http://localhost:3000/api/schema/init
   ```

4. **Run application**
   ```bash
   pnpm dev  # Development
   pnpm build && pnpm start  # Production
   ```

## Database Schema

```sql
-- Items with encrypted content
CREATE TABLE items (
  id uuid PRIMARY KEY,
  session_code text,
  kind text,
  content_encrypted text,           -- Encrypted text/code
  file_data_encrypted text,         -- Encrypted file data
  file_name_encrypted text,         -- Encrypted filename
  file_mime_type_encrypted text,    -- Encrypted MIME type
  file_size_encrypted text,         -- Encrypted file size
  created_at_encrypted text,        -- Encrypted timestamp
  display_id_encrypted text,        -- Encrypted display ID
  device_id text,                   -- Anonymous device ID
  created_at timestamptz            -- Server timestamp (cleanup)
);

-- Devices with encrypted metadata
CREATE TABLE devices (
  id uuid PRIMARY KEY,
  session_code text,
  device_id text,                   -- Anonymous ID
  device_name_encrypted text,       -- Encrypted device name
  device_metadata_encrypted text,   -- Encrypted browser/OS info
  is_host boolean,
  last_seen timestamptz
);
```

## Development

**Scripts**

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run linting
```

**Environment Variables**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

## Security Features

- **Zero-knowledge architecture** - Server cannot read user data
- **AES-256-GCM encryption** with authenticated encryption
- **Session-scoped keys** - Each session has unique encryption
- **Client-side encryption** - All encryption happens in browser
- **Anonymous devices** - No personal device information stored
- **Auto-cleanup** - Sessions expire after 3 hours

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Developer

**Somrit Dasgupta**

- Website: [somritdasgupta.in](https://somritdasgupta.in)
- GitHub: [@somritdasgupta](https://github.com/somritdasgupta)
