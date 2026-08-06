# 🖼️ Compress Image SaaS

> Compress images to an exact KB or MB target while preserving the highest possible quality.

A production-ready image compression SaaS built with **Next.js 15**, **React 19**, **TypeScript**, and **Supabase**. The application allows users to compress single or multiple images, download results individually or as ZIP/PDF, manage compression history, and securely authenticate using Supabase.

---

# ✨ Features

## Image Compression

- Compress images to an exact KB or MB target
- Intelligent compression algorithm
- Binary search quality optimization
- Preserves maximum possible quality
- Supports:
  - JPEG
  - PNG
  - WEBP
- Automatic format conversion
- Quality indicator
- Before/After comparison

---

## Batch Compression

- Compress multiple images simultaneously
- Individual compression progress
- Overall batch progress
- Batch summary
- Download all compressed images as:
  - ZIP
  - PDF
- Individual image download
- Compress Again without re-uploading images

---

## Authentication

- Email & Password Authentication
- Email Verification
- Login
- Signup
- Password Reset
- Protected Dashboard
- Protected Profile
- Session Management
- Supabase Auth

---

## Dashboard

- Compression History
- Batch Compression History
- Statistics
- Download Previous Files

---

## Profile

- Update Name
- Upload Avatar
- Profile Management

---

## User Experience

- Responsive Design
- Dark Mode
- Light Mode
- Mobile Friendly
- Modern SaaS UI
- Framer Motion Animations
- Loading States
- Toast Notifications

---

# 🛠 Tech Stack

## Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- Lucide Icons

---

## Backend

- Next.js Route Handlers
- Server Actions

---

## Database

- Supabase PostgreSQL
- Prisma

---

## Authentication

- Supabase Auth

---

## Storage

- Supabase Storage

---

## Image Processing

- Sharp
- pngquant
- mozjpeg
- imagemin

---

## Validation

- React Hook Form
- Zod

---

## State Management

- Zustand

---

# 📂 Project Structure

```
app/
components/
lib/
providers/
services/
supabase/
tests/
types/
public/
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/AnmolFatima-852/Compress-image-saas.git
```

Go into the project

```bash
cd Compress-image-saas
```

Install dependencies

```bash
npm install
```

Start the development server

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

# ⚙ Environment Variables

Create a file named

```
.env.local
```

Example

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

# 🗄 Database Setup

Run these SQL files in the Supabase SQL Editor in order:

```
001_profiles_and_compression_history.sql

002_storage_buckets_and_policies.sql

003_batch_history.sql

004_batch_history_output_format.sql
```

These create:

- profiles
- compression_history
- batch_history
- user_settings
- avatars bucket
- compression-outputs bucket
- Row Level Security policies

---

# 📦 Storage

Buckets

- avatars
- compression-outputs

---

# 🔒 Security

- Supabase Authentication
- Row Level Security (RLS)
- Input Validation
- MIME Type Validation
- Protected Routes
- Secure Storage Policies

---

# 🌙 Theme Support

- Light Mode
- Dark Mode
- System Theme

---

# 📈 Future Improvements

- AI-powered image optimization
- Cloud image processing
- Team workspaces
- Google Authentication
- GitHub Authentication
- Premium Plans
- Stripe Integration
- API Access
- Image Editing
- Watermark Removal
- Background Removal

---

# 📷 Screenshots

Add screenshots after deployment.

Example:

```
Homepage

Dashboard

Batch Compression

Compression History

Profile

Dark Theme
```

---

# 🌍 Deployment

Recommended Platform

- Vercel

Backend Services

- Supabase

---

# 👩‍💻 Developer

**Anmol Fatima**

Built as a production-ready SaaS project using modern web technologies.

---

# 📄 License

This project is licensed under the MIT License.