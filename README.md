# Frontend Template - Next.js 15 + Tailwind CSS v4 + Supabase

A modern SaaS template built with Next.js 15, Tailwind CSS v4, Shadcn UI v2, Upstash Redis, and Supabase.

## Features

- ⚡️ **Next.js 15** - The React framework for production
- 💨 **Tailwind CSS v4** - A utility-first CSS framework
- 🔥 **Shadcn UI v2** - Beautifully designed components
- 🔐 **Supabase** - For authentication and database
- 📝 **TypeScript** - Static type checking
- 🌓 **Dark Mode** - Light and dark theme support
- 🧩 **React Hook Form** - Flexible form validation
- ⚙️ **Zod** - Schema validation
- 🛡️ **Enhanced Security** - Robust authentication with rate limiting using Upstash
- 📚 **RAG (Chat with Data)** - Upload and chat with PDF, DOCX, TXT, and Images using Google Gemini embeddings
- 🔒 **Security Headers** - CSP and other security headers (Coming Soon)
- 🚫 **Anti-Brute Force** - Protection against authentication attacks (Coming Soon)

## Prerequisites

Make sure you have the following installed on your machine:

- Node.js 20+
- npm or yarn or pnpm (pnpm is redcommended)
- Docker Desktop
- Supabase CLI

Refer to the [Installation Guides](#installation-guides) Section of this README to find short guides and links to recommended installation guides for the above.

## Getting Started

### 1. Setup the project

#### Option 1: Clone the repository

```bash
git clone https://github.com/devsForFun/starterkit.git
cd starterkit
```

#### Option 2: Create a repository on GitHub, using this template.

1. Visit [github.com/devsforfun/starterkit](https://github.com/devsForFun/starterkit)
2. Click on the **Use this template** button on the top right corner.
3. Create your repository and clone it.

### 2. Install dependencies

```bash
# recomended:
pnpm intstall
# or
npm install
# or
yarn install
```

### 3. Start the local Supabase database container

```bash
supabase start
```

> After the contianer starts, you will be provided with some credentials like the following example:
>
> ```
>         API URL: http://127.0.0.1:54321
>     GraphQL URL: http://127.0.0.1:54321/graphql/v1
>  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
>          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
>      Studio URL: http://127.0.0.1:54323
>    Inbucket URL: http://127.0.0.1:54324
>      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
>        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
> service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
>   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
>   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
>       S3 Region: local
> ```
>
> **Copy those credentials from you terminal** and save them in your notes or create a `supabase-local-credentials.txt` file in this repo (it is already added to `.gitignore` so that it is not pushed into the repository.)

#### Run RAG Migrations

To enable vector search, you need to apply the RAG database schema:

1. Go to your Supabase Dashboard (http://127.0.0.1:54323).
2. Open the **SQL Editor**.
3. Open the file `supabase/migrations/20251217_add_rag_columns.sql` from your project.
4. Copy the content and run it in the SQL Editor.

### 4. Set up environment variables

1. Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

2. Update the environment variables in `.env.local` with your Supabase credentials:

```
# Basic
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Credentials (From your local project generated using Supabase CLI)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxx

# Upstash
UPSTASH_REDIS_REST_URL=xxxxxxxxx
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxx

# RAG & AI (Google Gemini is required for RAG)
GOOGLE_GENERATIVE_AI_API_KEY=xxxxxxxxx
TAVILY_API_KEY=xxxxxxxxx # Optional, for web search
# OPENAI_API_KEY=xxxxxxxxx # Optional, but Google is preferred for this RAG implementation
```

### 5. Run the development server

```bash
# recommended:
pnpm dev
# or
npm run dev
# or
yarn dev
```

Your application should now be running at [http://localhost:3000](http://localhost:3000).

### 6. How to use RAG (Chat with Data)

1. **Upload Documents**: Click the paperclip icon in the chat input area.
2. **Select Files**: Choose PDF, Word (.docx), Text (.txt), or Image files.
3. **Chat**: Once uploaded, ask questions about your documents. The AI will retrieve relevant context to answer.

## RAG Architecture

### Document Ingestion Flow

```mermaid
graph TD
    A["User Uploads File"] --> B["API: /api/process-document"]
    B --> C{"File Type?"}
    C -- "PDF/DOCX/TXT" --> D["Extract Text"]
    C -- "Image" --> E["Gemini Vision Analysis"]
    D --> F["Chunk Text"]
    E --> F
    F --> G["Generate Embeddings (Google/OpenAI)"]
    G --> H["Store in Supabase (pgvector)"]
```

### Chat Retrieval Flow

```mermaid
sequenceDiagram
    participant User
    participant API as Chat API
    participant DB as Supabase (Vector DB)
    participant LLM as Google Gemini

    User->>API: Send Message
    API->>API: Generate Embedding for Query
    API->>DB: match_documents(embedding)
    DB-->>API: Return Relevant Chunks
    API->>API: Inject Context into System Prompt
    API->>LLM: Generate Response (Query + Context)
    LLM-->>User: Stream Response
```

## Some **Features**

- Email/password authentication
- Google OAuth integration
- Strong password requirements
- Secure password handling
- Session management with secure cookies
- Rate Limiting with Upstash Redis

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication routes
│   │   ├── forgot-password/
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   ├── (public)/           # Public routes
│   ├── (authenticated)/    # Protected routes
│   │   └── chat/           # Chat interface
│   ├── api/                # API Routes
│   │   ├── chat/           # Chat API
│   │   └── process-document/# RAG Ingestion API
│   ├── actions/            # Server actions
│   └── globals.css         # Global styles
├── assets/                 # Project assets
│   ├── images/             # Image assets
│   └── logos/              # Logo files
├── components/             # React components
│   ├── ui/                 # Shadcn UI components
│   ├── chat/               # Chat components
│   ├── mode-toggle.tsx     # Dark/light mode toggle
│   └── theme-provider.tsx  # Theme context provider
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and libraries
├── public/                 # Static assets (favicons, etc.)
├── supabase/               # Supabase configuration
├── utils/                  # Helper functions
│   └── supabase/           # Supabase client configuration
├── middleware.ts           # Next.js middleware
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── components.json         # Shadcn UI configuration
```

## Deployment

The application can be deployed to any platform that supports Next.js, such as Vercel, Netlify, or a custom server.

```bash
# Build the application
pnpm build
# or
npm run build
# or
yarn build

# Start the production server
pnpm start
# or
npm start
# or
yarn start
```

## Available Scripts

- `pnpm dev` - Run the development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm clean:dotfiles` - Clean up dotfiles
- `pnpm clean:node_modules` - Remove node_modules
- `pnpm clean:cache` - Clear Next.js cache

## Installation Guides

### Install Node.js 20+

Refer to this: [Node.js - Download Node.js &reg;](https://nodejs.org/en/download)

### Install `pnpm`

Refer to [Installation | pnpm](https://pnpm.io/installation)

### Install Docker

Refer to this: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Install Supabase CLI

Refer to this article for more details: [Supabase CLI | Supabase Docs](https://supabase.com/docs/guides/local-development/cli/getting-started)

Or, Simply use the following:

```bash
# macos & linux:
brew install supabase/tap/supabase

# windows:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
