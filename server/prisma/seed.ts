import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.stockLedger.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  const [mainStore, cityMall, warehouse2] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Showroom 1", location: "MG Road, Pune", contactPerson: "Rahul Sharma", phone: "9876500001" },
    }),
    prisma.warehouse.create({
      data: { name: "Showroom 2", location: "City Mall, Pune", contactPerson: "Priya Desai", phone: "9876500002" },
    }),
    prisma.warehouse.create({
      data: { name: "Warehouse", location: "MIDC, Pune", contactPerson: "Amit Kulkarni", phone: "9876500003" },
    }),
  ]);

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.createMany({
    data: [
      { name: "Admin User", email: "admin@example.com", passwordHash, role: "admin" },
      { name: "Staff User", email: "staff@example.com", passwordHash, role: "staff" },
    ],
  });

  const products = [
    { name: "Colgate Toothpaste 100g", sku: "SKU-0001", barcode: "8901030710001", category: "Personal Care", brand: "Colgate", mrp: 55, sellingPrice: 49, taxPercent: 12, unit: "pcs" },
    { name: "Parle-G Biscuits 200g", sku: "SKU-0002", barcode: "8901030710002", category: "Grocery", brand: "Parle", mrp: 30, sellingPrice: 28, taxPercent: 5, unit: "pcs" },
    { name: "Tata Salt 1kg", sku: "SKU-0003", barcode: "8901030710003", category: "Grocery", brand: "Tata", mrp: 25, sellingPrice: 24, taxPercent: 5, unit: "pcs" },
    { name: "Dettol Handwash 200ml", sku: "SKU-0004", barcode: "8901030710004", category: "Personal Care", brand: "Dettol", mrp: 99, sellingPrice: 89, taxPercent: 18, unit: "pcs" },
    { name: "Maggi Noodles 70g", sku: "SKU-0005", barcode: "8901030710005", category: "Grocery", brand: "Nestle", mrp: 14, sellingPrice: 14, taxPercent: 5, unit: "pcs" },
    { name: "Amul Butter 500g", sku: "SKU-0006", barcode: "8901030710006", category: "Dairy", brand: "Amul", mrp: 275, sellingPrice: 265, taxPercent: 12, unit: "pcs" },
    { name: "Surf Excel Detergent 1kg", sku: "SKU-0007", barcode: "8901030710007", category: "Household", brand: "Surf Excel", mrp: 130, sellingPrice: 119, taxPercent: 18, unit: "pcs" },
    { name: "Boat Rockerz 235 Earphones", sku: "SKU-0008", barcode: "8901030710008", category: "Electronics", brand: "Boat", mrp: 1499, sellingPrice: 1199, taxPercent: 18, unit: "pcs" },
    { name: "Classmate Notebook 200pg", sku: "SKU-0009", barcode: "8901030710009", category: "Stationery", brand: "Classmate", mrp: 60, sellingPrice: 55, taxPercent: 12, unit: "pcs" },
    { name: "Cello Ballpoint Pen (Pack of 5)", sku: "SKU-0010", barcode: "8901030710010", category: "Stationery", brand: "Cello", mrp: 50, sellingPrice: 45, taxPercent: 12, unit: "pack" },
    { name: "Philips LED Bulb 9W", sku: "SKU-0011", barcode: "8901030710011", category: "Electronics", brand: "Philips", mrp: 150, sellingPrice: 129, taxPercent: 18, unit: "pcs" },
    { name: "Bisleri Water Bottle 1L", sku: "SKU-0012", barcode: "8901030710012", category: "Beverages", brand: "Bisleri", mrp: 20, sellingPrice: 20, taxPercent: 5, unit: "pcs" },
    { name: "Britannia Bread 400g", sku: "SKU-0013", barcode: "8901030710013", category: "Bakery", brand: "Britannia", mrp: 45, sellingPrice: 42, taxPercent: 5, unit: "pcs" },
    { name: "Fortune Sunflower Oil 1L", sku: "SKU-0014", barcode: "8901030710014", category: "Grocery", brand: "Fortune", mrp: 165, sellingPrice: 155, taxPercent: 5, unit: "pcs" },
    { name: "Lays Chips 52g", sku: "SKU-0015", barcode: "8901030710015", category: "Snacks", brand: "Lays", mrp: 20, sellingPrice: 20, taxPercent: 12, unit: "pcs" },
    { name: "HP 20L Printer Paper Ream", sku: "SKU-0016", barcode: "8901030710016", category: "Stationery", brand: "HP", mrp: 320, sellingPrice: 299, taxPercent: 12, unit: "pcs" },
    { name: "Samsung USB-C Cable 1m", sku: "SKU-0017", barcode: "8901030710017", category: "Electronics", brand: "Samsung", mrp: 499, sellingPrice: 399, taxPercent: 18, unit: "pcs" },
    { name: "Nivea Body Lotion 200ml", sku: "SKU-0018", barcode: "8901030710018", category: "Personal Care", brand: "Nivea", mrp: 210, sellingPrice: 189, taxPercent: 18, unit: "pcs" },
  ];

  const warehouses = [mainStore, cityMall, warehouse2];

  for (let i = 0; i < products.length; i++) {
    const product = await prisma.product.create({ data: products[i] });

    // Spread stock across warehouses; a couple of items are deliberately low/out of stock
    // in one location to demonstrate the low-stock and "which warehouse has it" flows.
    const stockPlan = [
      { warehouse: mainStore, quantity: 20 + ((i * 7) % 40), reorderLevel: 10 },
      { warehouse: cityMall, quantity: i % 4 === 0 ? 0 : 5 + ((i * 3) % 20), reorderLevel: 5 },
      { warehouse: warehouse2, quantity: 50 + ((i * 11) % 60), reorderLevel: 15 },
    ];

    for (const plan of stockPlan) {
      await prisma.stock.create({
        data: {
          productId: product.id,
          warehouseId: plan.warehouse.id,
          quantity: plan.quantity,
          reorderLevel: plan.reorderLevel,
        },
      });
    }
  }

  await prisma.customer.createMany({
    data: [
      { name: "Walk-in Customer", phone: null, email: null },
      { name: "Suresh Patel", phone: "9822011111", email: "suresh.patel@example.com" },
      { name: "Anita Rao", phone: "9822022222", email: "anita.rao@example.com" },
    ],
  });

  console.log(`Seeded ${warehouses.length} warehouses, ${products.length} products, and 2 users.`);
  console.log("Login with admin@example.com / password123 or staff@example.com / password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
