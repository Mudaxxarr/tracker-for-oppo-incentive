/**
 * Client-only. Downscales + re-encodes an image file so uploads (e.g. CNIC /
 * tax-certificate photos taken on a phone camera, routinely 3-8MB each) stay
 * small regardless of any platform request-size ceiling. Non-image files
 * (PDFs) pass through unchanged — canvas re-encoding doesn't apply to them.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
