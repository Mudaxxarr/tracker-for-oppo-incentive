import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activityPath = new URL(
  "../android/app/src/main/java/com/alhamdtelecom/incentomanager/MainActivity.java",
  import.meta.url,
);
const manifestPath = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
const gradlePath = new URL("../android/app/build.gradle", import.meta.url);

test("authenticated attachment downloads are handed to Android DownloadManager", async () => {
  const activity = await readFile(activityPath, "utf8");

  assert.match(activity, /setDownloadListener\s*\(/);
  assert.match(activity, /CookieManager\.getInstance\(\)\.getCookie\(url\)/);
  assert.match(activity, /addRequestHeader\("Cookie",\s*cookies\)/);
  assert.match(activity, /addRequestHeader\("User-Agent",\s*userAgent\)/);
  assert.match(activity, /DownloadManager\.Request\.VISIBILITY_VISIBLE_NOTIFY_COMPLETED/);
  assert.match(activity, /Environment\.DIRECTORY_DOWNLOADS/);
  assert.match(activity, /downloadManager\.enqueue\(request\)/);
});

test("legacy Android storage permission and upgrade version are present", async () => {
  const [manifest, gradle] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(gradlePath, "utf8"),
  ]);

  assert.match(manifest, /android\.permission\.WRITE_EXTERNAL_STORAGE/);
  assert.match(manifest, /android:maxSdkVersion="28"/);
  assert.match(gradle, /versionCode\s+2\b/);
  assert.match(gradle, /versionName\s+"1\.1"/);
});
