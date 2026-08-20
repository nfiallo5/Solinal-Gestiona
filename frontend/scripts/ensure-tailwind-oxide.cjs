#!/usr/bin/env node
/**
 * Self-healing postinstall step.
 *
 * On Node < 20, npm silently prunes @tailwindcss/oxide's platform-specific
 * native binding (e.g. @tailwindcss/oxide-linux-x64-gnu) from
 * optionalDependencies during `npm install`, because that binding declares
 * `"engines": { "node": ">=20" }` and npm treats optional deps with a
 * mismatched engine as "not applicable to this platform" and drops them
 * — even with engine-strict=false. This breaks `vite build`/`vite dev`
 * with "Cannot find native binding" on Node 18.
 *
 * This script detects that situation and force-installs the matching
 * platform binding as a direct (non-optional) install target, which npm
 * does NOT prune. It's a no-op on Node >= 20 or once the binding is
 * already present (e.g. CI running on a newer Node).
 */
const { execSync } = require("node:child_process");

function canLoadOxide() {
  try {
    require("@tailwindcss/oxide");
    return true;
  } catch {
    return false;
  }
}

if (canLoadOxide()) {
  process.exit(0);
}

let oxideVersion;
try {
  oxideVersion = require("@tailwindcss/oxide/package.json").version;
} catch {
  // @tailwindcss/oxide isn't installed at all (e.g. different package
  // manager / lockfile state) — nothing we can safely fix here.
  process.exit(0);
}

const platform = process.platform; // 'linux' | 'darwin' | 'win32' | ...
const arch = process.arch; // 'x64' | 'arm64' | ...

// Map Node's platform/arch to the @tailwindcss/oxide-* package suffix.
// Only the common CI/dev targets are covered; anything else is left alone.
let pkgSuffix = null;
if (platform === "linux" && arch === "x64") pkgSuffix = "linux-x64-gnu";
else if (platform === "linux" && arch === "arm64") pkgSuffix = "linux-arm64-gnu";
else if (platform === "darwin" && arch === "x64") pkgSuffix = "darwin-x64";
else if (platform === "darwin" && arch === "arm64") pkgSuffix = "darwin-arm64";
else if (platform === "win32" && arch === "x64") pkgSuffix = "win32-x64-msvc";
else if (platform === "win32" && arch === "arm64") pkgSuffix = "win32-arm64-msvc";

if (!pkgSuffix) {
  console.warn(
    `[ensure-tailwind-oxide] Unrecognized platform ${platform}/${arch}; skipping native binding fix.`,
  );
  process.exit(0);
}

const pkgName = `@tailwindcss/oxide-${pkgSuffix}`;
console.warn(
  `[ensure-tailwind-oxide] Native binding for @tailwindcss/oxide not found ` +
    `(likely pruned by npm on Node < 20). Force-installing ${pkgName}@${oxideVersion}...`,
);

try {
  execSync(`npm install ${pkgName}@${oxideVersion} --no-save --force --loglevel=error`, {
    stdio: "inherit",
  });
} catch (err) {
  console.warn(
    `[ensure-tailwind-oxide] Could not install ${pkgName} automatically. ` +
      `Tailwind builds may fail; install it manually if so. (${err.message})`,
  );
}
