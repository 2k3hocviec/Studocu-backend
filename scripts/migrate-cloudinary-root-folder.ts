/**
 * One-shot migration: rename Cloudinary assets from `studocu/...` to `home/...`
 * and rewrite URLs in the database accordingly.
 *
 * Usage (from Studocu-backend/):
 *   npx ts-node scripts/migrate-cloudinary-root-folder.ts           # dry-run
 *   npx ts-node scripts/migrate-cloudinary-root-folder.ts --apply   # actually mutate
 *
 * Safe to re-run: only touches assets whose public_id starts with `studocu/`.
 * - RAW assets: renamed in place via Cloudinary Admin API.
 * - IMAGE assets: renamed via Cloudinary Admin API update (works for existing
 *   public_ids; the SDK exposes a helper for this).
 */
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const OLD_PREFIX = "studocu/";
const NEW_PREFIX = "home/";

if (!process.env.CLOUDINARY_URL) {
  console.error("CLOUDINARY_URL is not set");
  process.exit(1);
}

type Asset = {
  public_id: string;
  secure_url: string;
  resourceType: "raw" | "image";
};

async function listAllByTag(tag: string, resourceType: "raw" | "image"): Promise<Asset[]> {
  const out: Asset[] = [];
  let nextCursor: string | undefined;
  do {
    const res: any = await cloudinary.api.resources_by_tag(tag, {
      resource_type: resourceType,
      max_results: 500,
      next_cursor: nextCursor,
    });
    for (const r of res.resources || []) {
      out.push({ public_id: r.public_id, secure_url: r.secure_url, resourceType });
    }
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return out;
}

function buildNewUrl(oldUrl: string, oldPublicId: string, newPublicId: string): string {
  // Cloudinary URL: https://res.cloudinary.com/<cloud>/<type>/upload/v<n>/<public_id>.<ext>
  // Replace the path segment containing oldPublicId (without extension) with newPublicId.
  const extMatch = /\.[a-z0-9]+$/i.exec(oldPublicId);
  const oldIdNoExt = extMatch ? oldPublicId.slice(0, -extMatch[0].length) : oldPublicId;
  const ext = extMatch ? extMatch[0] : "";
  return oldUrl.replace(`/${oldIdNoExt}${ext}`, `/${newPublicId}`);
}

async function renameAsset(asset: Asset): Promise<{ from: string; to: string }> {
  const newPublicId = NEW_PREFIX + asset.public_id.slice(OLD_PREFIX.length);
  // Cloudinary Admin API: rename chỉ áp dụng cho resource_type raw.
  // Với image, dùng uploader.rename cũng được (kể từ API 1.16).
  await cloudinary.uploader.rename(asset.public_id, newPublicId, {
    resource_type: asset.resourceType,
    overwrite: false,
    invalidate: true,
  });
  return { from: asset.public_id, to: newPublicId };
}

async function updateDbUrls(): Promise<number> {
  const prisma = new PrismaClient();
  const oldSegment = `/${OLD_PREFIX}`;
  const newSegment = `/${NEW_PREFIX}`;
  const like = `%res.cloudinary.com%/${OLD_PREFIX}%`;

  const [r1, r2, r3] = await Promise.all([
    prisma.$executeRawUnsafe(
      `UPDATE "User" SET avatar_url = REPLACE(avatar_url, $1, $2) WHERE avatar_url LIKE $3;`,
      oldSegment,
      newSegment,
      like,
    ),
    prisma.$executeRawUnsafe(
      `UPDATE "DocumentFile" SET
         file_url = REPLACE(file_url, $1, $2),
         converted_pdf_url = REPLACE(converted_pdf_url, $1, $2)
       WHERE file_url LIKE $3 OR converted_pdf_url LIKE $3;`,
      oldSegment,
      newSegment,
      like,
    ),
    prisma.$executeRawUnsafe(
      `UPDATE "DocumentPreview" SET
         image_url = REPLACE(image_url, $1, $2)
       WHERE image_url LIKE $3;`,
      oldSegment,
      newSegment,
      like,
    ),
  ]);

  await prisma.$disconnect();
  return Number(r1) + Number(r2) + Number(r3);
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (mutating)" : "DRY-RUN (no changes)"}\n`);

  const [raw, image] = await Promise.all([
    listAllByTag("studocu", "raw"),
    listAllByTag("studocu", "image"),
  ]);
  const all = [...raw, ...image];
  console.log(`Found ${raw.length} raw + ${image.length} image assets tagged "studocu".`);

  const targets = all.filter((a) => a.public_id.startsWith(OLD_PREFIX));
  console.log(`Of those, ${targets.length} have public_id starting with "${OLD_PREFIX}".\n`);

  if (targets.length === 0) {
    console.log("Nothing to rename.");
    return;
  }

  for (const a of targets.slice(0, 20)) {
    const newId = NEW_PREFIX + a.public_id.slice(OLD_PREFIX.length);
    const newUrl = buildNewUrl(a.secure_url, a.public_id, newId);
    console.log(`  [${a.resourceType}] ${a.public_id}`);
    console.log(`     -> ${newId}`);
    console.log(`     URL: ${newUrl}`);
  }
  if (targets.length > 20) console.log(`  ... and ${targets.length - 20} more`);

  if (!APPLY) {
    console.log("\n(dry-run) Re-run with --apply to mutate.");
    return;
  }

  console.log("\nRenaming assets on Cloudinary...");
  let renamed = 0;
  for (const a of targets) {
    try {
      await renameAsset(a);
      renamed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${a.public_id}: ${msg}`);
    }
  }
  console.log(`Renamed ${renamed}/${targets.length}.\n`);

  console.log("Updating database URLs...");
  const rows = await updateDbUrls();
  console.log(`Updated ${rows} DB rows.\n`);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
