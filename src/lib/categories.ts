import { prisma } from "@/lib/prisma";

const UNCATEGORIZED_SLUG = "uncategorized";

/**
 * Find or create the gym's "Uncategorized" fallback category. Used as the safe
 * landing spot when a category with products is deleted, since Product.categoryId
 * is required and has no onDelete behavior. Created lazily so existing gyms don't
 * need a backfill migration.
 */
export async function ensureUncategorized(gymId: string) {
  const existing = await prisma.category.findFirst({
    where: { gymId, slug: UNCATEGORIZED_SLUG },
  });
  if (existing) return existing;

  return prisma.category.create({
    data: {
      gymId,
      name: "Uncategorized",
      slug: UNCATEGORIZED_SLUG,
      sortOrder: 999,
    },
  });
}
