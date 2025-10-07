# PaperPaste

[![Live Demo](https://img.shields.io/badge/Live%20Demo-paperpaste.somritdasgupta.in-blue?style=for-the-badge&logo=vercel)](https://paperpaste.somritdasgupta.in)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Real--time-green?style=for-the-badge&logo=supabase)](https://supabase.com/)

A secure, real-time clipboard sharing application that enables seamless synchronization across multiple devices. Built with end-to-end encryption and zero-knowledge architecture for maximum privacy and security.

### **End-to-End Encryption**

- **AES-GCM 256-bit encryption** with session-specific keys
- **Zero-knowledge architecture** - server never sees your data
- **Client-side encryption/decryption** for maximum security
- **Anonymous device identification** with encrypted device names

### **Real-time Synchronization**

- **Instant content sharing** across all connected devices
- **Live device presence** indicators and management
- **Automatic heartbeat monitoring** with 5-second intervals
- **Multi-channel subscription** system for optimal performance

### **Modern User Experience**

- **Responsive design** optimized for all device sizes
- **Dark/Light theme** support with system preference detection
- **Collapsible content** for better UI management
- **One-click copy** functionality with visual feedback
- **Device identification** badges with unique icons

### **Cross-Platform Compatibility**

- **QR Code scanning** for quick device pairing
- **Mobile-optimized** interface with touch-friendly controls
- **Progressive Web App** capabilities
- **Universal device support** (Desktop, Mobile, Tablet)

### Quick Start Guide:

1. Visit the application URL
2. Create or join a session with a secure code
3. Start sharing content instantly across your devices
4. Use QR codes for quick mobile device pairing

## Technology Stack

### **Frontend**

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

### **Security & Encryption**

- **Encryption Algorithm:** AES-GCM with 256-bit keys
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Session Security:** Cryptographically secure session codes
- **Privacy:** Zero-knowledge architecture with anonymous devices

## Prerequisites

- **Node.js** 18.17 or higher
- **pnpm** package manager (recommended)
- **Supabase** account and project
- **Modern web browser** with Web Crypto API support

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/somritdasgupta/paperpaste.git
cd paperpaste
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Database Setup

Initialize the database schema:

```bash
# Start development server
pnpm dev

# Initialize database tables
curl -X POST http://localhost:3000/api/schema/init
```

### 5. Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
paperpaste/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── schema/        # Database schema management
│   │   └── upload/        # File upload handling
│   ├── session/[code]/    # Dynamic session pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout component
│   └── page.tsx          # Home page
├── components/            # Reusable UI components
│   ├── session/          # Session-specific components
│   │   ├── clipboard-input.tsx
│   │   ├── devices-panel.tsx
│   │   ├── items-list.tsx
│   │   └── session-header.tsx
│   └── ui/               # Base UI components (Radix UI)
├── lib/                  # Utility libraries
│   ├── encryption.ts     # End-to-end encryption utilities
│   ├── device.ts         # Device management functions
│   └── supabase/         # Supabase client configuration
├── hooks/                # Custom React hooks
├── scripts/sql/          # Database setup scripts
├── supabase/migrations/  # Supabase migration files
└── public/              # Static assets
```

## Security Architecture

### **Encryption Flow**

1. **Session Key Generation:** Derived from session code using PBKDF2
2. **Content Encryption:** All data encrypted client-side before transmission
3. **Anonymous Devices:** Device identifiers are cryptographically generated
4. **Zero-Knowledge:** Server stores only encrypted data, never plaintext

### **Privacy Features**

- **No personal data collection** or storage
- **Anonymous session codes** with automatic expiration
- **Encrypted device names** for complete anonymity
- **Local key derivation** - encryption keys never leave the client

## Usage Examples

### **Basic Session Creation**

```typescript
// Session creation with encryption
const sessionCode = generateSecureCode();
const sessionKey = await generateSessionKey(sessionCode);
```

### **Content Sharing**

```typescript
// Encrypt and share content
const encryptedContent = await encryptData(content, sessionKey);
await supabase.from("items").insert({
  session_code: sessionCode,
  content_encrypted: encryptedContent,
  device_id: anonymousDeviceId,
});
```

### **Real-time Synchronization**

```typescript
// Subscribe to real-time updates
supabase
  .channel(`session:${sessionCode}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "items",
    },
    handleNewItem
  )
  .subscribe();
```

## Deployment

### **Vercel Deployment (Recommended)**

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on every push to main branch

### **Manual Deployment**

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

### **Development Guidelines**

- Follow TypeScript best practices
- Maintain end-to-end encryption standards
- Ensure real-time functionality remains performant
- Write comprehensive tests for security-critical code

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Developer

**Somrit Dasgupta**

- Website: [somritdasgupta.in](https://somritdasgupta.in)
- GitHub: [@somritdasgupta](https://github.com/somritdasgupta)

---

<div align="center">

**[Try PaperPaste Now](https://paperpaste.somritdasgupta.in)**

</div>
