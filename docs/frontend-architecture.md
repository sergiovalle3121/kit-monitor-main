# Frontend Architecture - Next.js Premium Shell

## Tech Stack
- **Framework**: Next.js (App Router)
- **Library**: React 18+
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui + Radix UI
- **Animations**: Framer Motion
- **State/Data**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod

## Design System
- Use the `@axos/ui` package (packages/ui) for all shared components.
- Maintain a "Premium White" and "Deep Dark" theme.
- Typography: Inter / Roboto / Montserrat (System fonts preferred for speed, Google Fonts for branding).

## Page Structure
- **(auth)**: Login, registration, password recovery.
- **(dashboard)**: Protected routes for the main application.
- **(admin)**: Tenant and system administration.

## Rules
- No business logic in components; use custom hooks.
- Every page must be responsive.
- Use `loading.tsx` and `error.tsx` for better UX.
