import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Gis", slug: "gis", sortOrder: 1 },
  { name: "Rash Guards", slug: "rash-guards", sortOrder: 2 },
  { name: "Shorts", slug: "shorts", sortOrder: 3 },
  { name: "T-Shirts", slug: "t-shirts", sortOrder: 4 },
  { name: "Hoodies", slug: "hoodies", sortOrder: 5 },
  { name: "Belts", slug: "belts", sortOrder: 6 },
  { name: "Patches", slug: "patches", sortOrder: 7 },
  { name: "Accessories", slug: "accessories", sortOrder: 8 },
];

async function main() {
  console.log("Seeding categories...");

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("Categories seeded.");

  const gisCategory = await prisma.category.findUnique({ where: { slug: "gis" } });
  const rashGuardsCategory = await prisma.category.findUnique({ where: { slug: "rash-guards" } });
  const tshirtsCategory = await prisma.category.findUnique({ where: { slug: "t-shirts" } });
  const hoodiesCategory = await prisma.category.findUnique({ where: { slug: "hoodies" } });
  const patchesCategory = await prisma.category.findUnique({ where: { slug: "patches" } });

  if (!gisCategory || !rashGuardsCategory || !tshirtsCategory || !hoodiesCategory || !patchesCategory) {
    throw new Error("Categories not found");
  }

  console.log("Seeding sample products...");

  await prisma.product.upsert({
    where: { slug: "ceconi-bjj-white-gi" },
    update: {},
    create: {
      name: "Ceconi BJJ White Gi",
      slug: "ceconi-bjj-white-gi",
      description: "Premium white Gi with embroidered Ceconi BJJ logo. Made from durable 450gsm pearl weave fabric. Perfect for training and competition.",
      price: 149.99,
      categoryId: gisCategory.id,
      featured: true,
      active: true,
      variants: {
        create: [
          { size: "A0", color: "White", stock: 5 },
          { size: "A1", color: "White", stock: 8 },
          { size: "A2", color: "White", stock: 10 },
          { size: "A3", color: "White", stock: 7 },
          { size: "A4", color: "White", stock: 3 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "ceconi-bjj-rash-guard-black" },
    update: {},
    create: {
      name: "Ceconi BJJ Competition Rash Guard",
      slug: "ceconi-bjj-rash-guard-black",
      description: "High-performance black rash guard featuring the Ceconi BJJ crest. Compression fit with flatlock stitching for maximum comfort during rolls.",
      price: 59.99,
      categoryId: rashGuardsCategory.id,
      featured: true,
      active: true,
      variants: {
        create: [
          { size: "S", color: "Black", stock: 10 },
          { size: "M", color: "Black", stock: 15 },
          { size: "L", color: "Black", stock: 12 },
          { size: "XL", color: "Black", stock: 8 },
          { size: "XXL", color: "Black", stock: 4 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "ceconi-bjj-logo-tee" },
    update: {},
    create: {
      name: "Ceconi BJJ Logo Tee",
      slug: "ceconi-bjj-logo-tee",
      description: "Classic cotton t-shirt with the Ceconi BJJ logo. Comfortable fit for everyday wear. Show your academy pride on and off the mats.",
      price: 29.99,
      categoryId: tshirtsCategory.id,
      featured: true,
      active: true,
      variants: {
        create: [
          { size: "S", color: "Black", stock: 20 },
          { size: "M", color: "Black", stock: 25 },
          { size: "L", color: "Black", stock: 20 },
          { size: "XL", color: "Black", stock: 15 },
          { size: "S", color: "White", stock: 15 },
          { size: "M", color: "White", stock: 20 },
          { size: "L", color: "White", stock: 15 },
          { size: "XL", color: "White", stock: 10 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "ceconi-bjj-pullover-hoodie" },
    update: {},
    create: {
      name: "Ceconi BJJ Pullover Hoodie",
      slug: "ceconi-bjj-pullover-hoodie",
      description: "Heavyweight pullover hoodie with embroidered Ceconi BJJ logo on chest. Fleece-lined for warmth. Perfect for post-training comfort.",
      price: 54.99,
      categoryId: hoodiesCategory.id,
      featured: false,
      active: true,
      variants: {
        create: [
          { size: "S", color: "Black", stock: 8 },
          { size: "M", color: "Black", stock: 12 },
          { size: "L", color: "Black", stock: 10 },
          { size: "XL", color: "Black", stock: 6 },
          { size: "XXL", color: "Black", stock: 3 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "ceconi-bjj-academy-patch" },
    update: {},
    create: {
      name: "Ceconi BJJ Academy Patch",
      slug: "ceconi-bjj-academy-patch",
      description: "Official Ceconi BJJ embroidered patch. Iron-on backing for easy application to your Gi or gear bag.",
      price: 12.99,
      categoryId: patchesCategory.id,
      featured: false,
      active: true,
      variants: {
        create: [
          { size: "One Size", color: null, stock: 50 },
        ],
      },
    },
  });

  console.log("Sample products seeded.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
