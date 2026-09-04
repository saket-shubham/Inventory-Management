-- Camera-captured/uploaded product images, stored directly in the database as
-- a compressed base64 data URI. Purely additive and nullable — existing
-- products and the existing image_url column/behavior are untouched.
ALTER TABLE "products" ADD COLUMN "image_data" TEXT;
