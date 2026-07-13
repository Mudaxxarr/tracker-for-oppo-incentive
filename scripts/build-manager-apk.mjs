import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const managerRoot = join(repoRoot, "manager-app");
const androidRoot = join(managerRoot, "android");

function javaMajor(javaHome) {
  const executable = join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(executable)) return 0;
  const result = spawnSync(executable, ["-version"], { encoding: "utf8" });
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return Number(text.match(/version "(\d+)/)?.[1] ?? 0);
}

function findJava21() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);

  if (process.platform === "win32") {
    const adoptium = "C:\\Program Files\\Eclipse Adoptium";
    if (existsSync(adoptium)) {
      for (const name of readdirSync(adoptium).sort().reverse()) {
        if (name.startsWith("jdk-21")) candidates.push(join(adoptium, name));
      }
    }
    candidates.push("C:\\Program Files\\Android\\Android Studio\\jbr");
  }

  const selected = candidates.find((candidate) => javaMajor(candidate) >= 21);
  if (!selected) {
    throw new Error("Java 21 or newer is required to build the Incento Manager APK.");
  }
  return selected;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const javaHome = findJava21();
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${join(javaHome, "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
};

if (process.platform === "win32") {
  // Node 24 no longer launches .cmd shims directly through spawnSync on this
  // workstation (EINVAL). Route the npm shim through Windows' command host.
  run(process.env.ComSpec ?? "cmd.exe", [
    "/d",
    "/s",
    "/c",
    "npm.cmd",
    "--prefix",
    managerRoot,
    "run",
    "cap:sync",
  ], { env });
} else {
  run("npm", [
    "--prefix",
    managerRoot,
    "run",
    "cap:sync",
  ], { env });
}

if (process.platform === "win32") {
  run("cmd.exe", [
    "/d",
    "/s",
    "/c",
    "gradlew.bat",
    "assembleDebug",
    "--no-problems-report",
    "--no-daemon",
  ], { cwd: androidRoot, env });
} else {
  run("./gradlew", [
    "assembleDebug",
    "--no-problems-report",
    "--no-daemon",
  ], { cwd: androidRoot, env });
}
