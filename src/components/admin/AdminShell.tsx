// AdminShell is no longer used — auth is handled by src/app/admin/layout.tsx
// Kept as an empty re-export for backwards compat if anything still imports it.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
