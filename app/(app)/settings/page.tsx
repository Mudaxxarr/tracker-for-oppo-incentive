import { getConstants } from "@/lib/settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const c = await getConstants();
  return <SettingsClient initial={c} />;
}
