# PROJECT

You are my Senior Software Architect, Senior UI/UX Designer, Senior Product Engineer, and Senior Full Stack Developer.

We are building a production-ready SaaS application named:

Compress Image to Exact KB/MB

The application's primary goal is simple:

Upload an image → Enter a target file size (KB/MB) → Compress the image to that exact size (or as close as technically possible while preserving maximum quality).

This is NOT a demo project.

Build everything as if this application will be used by millions of users.

Never write temporary code.

Never use shortcuts.

Always follow clean architecture.

Always think long-term.

Whenever making architectural decisions, choose scalability over quick implementation.

------------------------------------------------------------
TECH STACK
------------------------------------------------------------

Framework
- Next.js 15+
- React 19
- App Router
- Server Components by default

Language
- TypeScript (Strict Mode)

Styling
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- Lucide Icons

Forms
- React Hook Form
- Zod

ORM
- Prisma

Database
- Supabase PostgreSQL

Authentication
- Supabase Auth

Storage
- Supabase Storage

Emails
- Resend

Theme
- next-themes

State Management
- Zustand

Image Processing
- Sharp
- pngquant
- mozjpeg
- imagemin

Deployment
- Vercel

Package Manager
- pnpm

------------------------------------------------------------
PROJECT RULES
------------------------------------------------------------

Never create a separate backend.

Everything must exist inside the Next.js application.

Use Route Handlers.

Use Server Actions whenever appropriate.

Avoid unnecessary Client Components.

Use Server Components by default.

Keep every file under approximately 250 lines whenever possible.

Avoid duplicated code.

Everything must be reusable.

------------------------------------------------------------
PROJECT STRUCTURE
------------------------------------------------------------

app/

components/

features/

lib/

services/

hooks/

emails/

prisma/

config/

constants/

types/

utils/

providers/

styles/

public/

middleware.ts

------------------------------------------------------------
DESIGN GOAL
------------------------------------------------------------

The UI should feel like a premium SaaS.

Take inspiration from

• Linear
• Vercel
• Stripe
• Notion
• Raycast

Characteristics

Minimal

Elegant

Rounded corners

Soft shadows

Large spacing

Micro animations

Glassmorphism only where appropriate

Fast

Professional

Trustworthy

------------------------------------------------------------
BRANDING
------------------------------------------------------------

Name

Compress Image

Tagline

Compress Images to Exact KB & MB

Logo

Design a completely original logo.

Do NOT imitate existing applications.

The logo should contain

Rounded square

Minimal image icon

Compression arrows

Purple → Pink → Cyan gradient

Small sparkle

Modern SVG

------------------------------------------------------------
COLOR PALETTE
------------------------------------------------------------

Primary

#7C3AED

Secondary

#EC4899

Accent

#06B6D4

Background

#FAFAFC

Card

#FFFFFF

Border

#ECECEC

Dark Background

#09090B

Dark Card

#18181B

------------------------------------------------------------
LANDING PAGE
------------------------------------------------------------

Navigation

Logo

Features

Pricing

FAQ

Blog

Theme Toggle

Login

Dashboard

------------------------------------------------------------

Hero

Title

Compress Image to Exact KB/MB

Subtitle

Smart compression.
Exact size.
Maximum quality.

CTA

Upload Image

------------------------------------------------------------

Main Upload Card

Supports

Drag & Drop

Browse Files

Paste Image (Ctrl + V)

Supported Formats

PNG

JPEG

WEBP

AVIF

Maximum Upload Size

100 MB

------------------------------------------------------------
TARGET SIZE
------------------------------------------------------------

Input

100

Dropdown

KB

MB

Quick Presets

20 KB

50 KB

100 KB

200 KB

500 KB

1 MB

2 MB

Auto detect unit.

------------------------------------------------------------
COMPRESS BUTTON
------------------------------------------------------------

Large gradient button.

Animated.

Loading indicator.

Disabled until image selected.

------------------------------------------------------------
COMPRESSION PROCESS
------------------------------------------------------------

Animated steps

Uploading

Reading Metadata

Analyzing

Compressing

Optimizing

Matching Target Size

Finalizing

Done

------------------------------------------------------------
RESULT CARD
------------------------------------------------------------

Display

Original Size

Compressed Size

Saved Space

Compression Ratio

Image Resolution

Image Format

Estimated Quality

Status

Exact Match

Closest Match

Tolerance

±1 KB

Buttons

Download

Compress Another

------------------------------------------------------------
BEFORE / AFTER
------------------------------------------------------------

Interactive comparison slider.

Zoom

Fullscreen

Responsive

------------------------------------------------------------
STATISTICS
------------------------------------------------------------

Display only

Original Size

Compressed Size

Saved Space

Compression Ratio

Resolution

Format

Estimated Quality

Avoid technical information.

------------------------------------------------------------
QUALITY INDICATOR
------------------------------------------------------------

Never display JPEG quality percentages.

Instead

Excellent

Very Good

Good

Acceptable

Poor

------------------------------------------------------------
DARK MODE
------------------------------------------------------------

Support

Light

Dark

System

Remember user preference.

------------------------------------------------------------
ANIMATIONS
------------------------------------------------------------

Use Framer Motion.

Add

Page transitions

Card animations

Hover effects

Fade

Scale

Slide

Progress animations

Skeleton loaders

Confetti after successful compression

------------------------------------------------------------
AUTHENTICATION
------------------------------------------------------------

Supabase Auth

Email Login

Magic Link

Google (prepare)

GitHub (prepare)

Middleware protection

------------------------------------------------------------
EMAILS
------------------------------------------------------------

Use Resend.

Phase 1

Welcome Email

Beautiful HTML email.

Responsive.

Dark mode compatible.

Includes

Logo

Welcome message

Dashboard Button

Support email

Footer

------------------------------------------------------------
DATABASE
------------------------------------------------------------

Create Prisma models

User

CompressionHistory

Settings

EmailLog

Usage

Subscription (future)

APIKey (future)

------------------------------------------------------------
COMPRESSION ENGINE
------------------------------------------------------------

Implement an intelligent compression algorithm.

Goal

Reach requested target size.

Algorithm

Binary search image quality.

If necessary

Resize progressively.

Retry until

Target reached

or

Closest possible

Tolerance

±1 KB

Never freeze UI.

Run server side.

------------------------------------------------------------
API ROUTES
------------------------------------------------------------

/api/upload

/api/compress

/api/history

/api/settings

/api/email

/api/auth

------------------------------------------------------------
SECURITY
------------------------------------------------------------

Validate MIME types.

Validate uploads.

Rate limiting.

Secure headers.

Input validation.

Environment validation.

Prevent XSS.

Prevent SQL Injection.

Never trust client input.

------------------------------------------------------------
SEO
------------------------------------------------------------

Metadata

OpenGraph

Twitter Cards

JSON-LD

Robots

Sitemap

Canonical

------------------------------------------------------------
ACCESSIBILITY
------------------------------------------------------------

Keyboard navigation

ARIA

Focus states

Reduced motion

Color contrast

------------------------------------------------------------
PERFORMANCE
------------------------------------------------------------

Server Components

Streaming

Lazy Loading

Dynamic Imports

Caching

Memoization

Image optimization

------------------------------------------------------------
ERROR HANDLING
------------------------------------------------------------

Beautiful error pages.

Toast notifications.

Retry actions.

Helpful messages.

------------------------------------------------------------
TESTING
------------------------------------------------------------

Vitest

Playwright

Unit Tests

Integration Tests

------------------------------------------------------------
CI/CD
------------------------------------------------------------

GitHub Actions

Type Check

Lint

Build

Tests

------------------------------------------------------------
PHASES
------------------------------------------------------------

Do NOT generate the entire project at once.

Work phase by phase.

Before writing code, explain the architecture.

Wait for confirmation.

Then continue.

Phase 1

Project setup

Folder structure

Theme

Prisma

Supabase

Authentication

Landing Page

Navigation

Homepage

Responsive Design

Welcome Email

Phase 2

Image Upload

Compression Engine

Progress UI

Results

Download

Phase 3

Dashboard

History

Profile

Settings

Theme

Phase 4

Performance

SEO

Accessibility

Testing

Deployment

------------------------------------------------------------
CODING STANDARDS
------------------------------------------------------------

Use strict TypeScript.

Never use any.

Prefer interfaces.

Document exported functions.

Use meaningful names.

Follow SOLID principles.

Keep components reusable.

Separate business logic from UI.

------------------------------------------------------------
IMPORTANT

Whenever you generate code:

1. First explain what you are going to build.
2. Then generate the folder structure.
3. Then generate code.
4. Explain why each decision was made.
5. Never skip architecture.
6. Never assume anything.
7. If there are multiple good approaches, explain the trade-offs before choosing one.
8. Optimize for maintainability, readability, and scalability over brevity.
9. Build each feature completely before moving to the next phase.
10. Treat this as a real commercial SaaS product intended for production.

------------------------------------------------------------
BATCH PROCESSING
------------------------------------------------------------

The application must support both:

1. Single Image Compression
2. Batch Image Compression

Batch mode requirements:

- Upload multiple images simultaneously.
- Drag & Drop multiple images.
- Browse multiple images.
- Remove individual images before compression.
- Display thumbnail previews.
- Display file name and original size.
- Compress all images in one operation.
- Show per-image progress.
- Show overall batch progress.
- Support JPEG, PNG, WEBP and AVIF.
- Never freeze the UI.
- Support at least 100 images in one batch.

------------------------------------------------------------
DOWNLOAD OPTIONS
------------------------------------------------------------

After batch compression the application must provide:

Download ZIP

Download PDF

Download Individual Images

ZIP Requirements

Include every compressed image.

Preserve filenames.

Use compressed versions.

PDF Requirements

Each image appears on its own page.

Images centered.

Maintain aspect ratio.

High quality rendering.

Support landscape and portrait images.

Do not distort images.

------------------------------------------------------------
PDF TOOLS
------------------------------------------------------------

Add a second tool inside the application.

Modes

Compress Images

Images to PDF

Images to PDF mode should

Not compress images.

Simply combine uploaded images into a PDF.

Support multiple images.

Allow drag and drop.

Allow image reordering.

Generate a high-quality PDF.

Download PDF.

Preserve image quality.

------------------------------------------------------------
BATCH HISTORY
------------------------------------------------------------

Save every completed batch.

History should include

Batch ID

Number of images

Original total size

Compressed total size

Saved space

Compression ratio

Processing time

Date

Time

ZIP download

PDF download

Individual downloads

------------------------------------------------------------
USER EXPERIENCE
------------------------------------------------------------

All new features must match the existing application.

Requirements

Same gradients

Same spacing

Same typography

Same animations

Same buttons

Same cards

Same rounded corners

Same theme support

No redesigns.

Extend the existing UI only.

------------------------------------------------------------
PHASE 5
------------------------------------------------------------

Batch Processing

Support selecting multiple images.

Compress all images.

Continue processing if one image fails.

Never enlarge an image.

Support:

- JPEG
- PNG
- WEBP

Allow:

Download ZIP

Download PDF

Download Individually

Allow recompression without reuploading.

Generate PDF without compression.

Release all temporary resources after downloads.

Support large batches (100+ images).

Optimize memory usage.

Show batch statistics.

Show per-image progress.

Show overall progress.

Save batch history in Supabase.

Never stop the batch because one image fails.

Maintain the same premium UI/UX as the rest of the application.

------------------------------------------------------------
BATCH PROCESSING
------------------------------------------------------------

Support selecting multiple images.

Allow drag & drop multiple images.

Allow browsing multiple images.

Support batch compression.

Never fail the entire batch because of one image.

Images already smaller than the requested target must be marked as:

Skipped
Already below target size

Continue compressing all remaining images.

Show:

- Per-image progress
- Overall progress
- Batch statistics
- Done
- Failed
- Skipped

Allow:

Download ZIP

Download PDF

Download individual images

Compress Again

Batch history must be saved in Supabase.

------------------------------------------------------------
PDF FEATURES
------------------------------------------------------------

Support Image → PDF without compression.

Allow:

- Multiple images
- Drag to reorder pages
- Download merged PDF

Keep original image quality.

------------------------------------------------------------
PERFORMANCE
------------------------------------------------------------

Support thousands of concurrent users.

Never block the UI.

Use streaming where possible.

Large downloads must be generated server-side.

Avoid memory leaks.

Retry failed downloads.

------------------------------------------------------------
ERROR HANDLING
------------------------------------------------------------

Never silently fail.

Always explain why an image failed.

Examples:

Image already below target size

Cannot compress PNG further

WebP conversion failed

File corrupted

Continue processing the remaining images.