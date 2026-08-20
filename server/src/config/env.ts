import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  appEnv: process.env.APP_ENV ?? "development",
  port: Number(process.env.APP_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  invoicePrefix: process.env.INVOICE_PREFIX ?? "INV-",
  companyName: process.env.COMPANY_NAME ?? "Company Name",
  companyGstNumber: process.env.COMPANY_GST_NUMBER ?? "",
  companyAddress: process.env.COMPANY_ADDRESS ?? "",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
