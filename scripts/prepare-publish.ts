#!/usr/bin/env bun
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const packagesDir = join(import.meta.dir, "../packages");
const packages = readdirSync(packagesDir, { withFileTypes: true })
	.filter(dirent => dirent.isDirectory())
	.map(dirent => join(dirent.name, "package.json"));

// First, collect all package versions
const packageVersions = new Map<string, string>();

for (const pkgPath of packages) {
	const fullPath = join(packagesDir, pkgPath);
	const pkg = JSON.parse(readFileSync(fullPath, "utf-8"));
	packageVersions.set(pkg.name, pkg.version);
}

console.log("Found packages:", Array.from(packageVersions.keys()).join(", "));

// Now, update all workspace:* dependencies
let updatedCount = 0;

for (const pkgPath of packages) {
	const fullPath = join(packagesDir, pkgPath);
	const pkg = JSON.parse(readFileSync(fullPath, "utf-8"));
	let modified = false;

	// Check dependencies, devDependencies, and peerDependencies
	for (const depType of ["dependencies", "devDependencies", "peerDependencies"]) {
		const deps = pkg[depType];
		if (!deps) continue;

		for (const [depName, depVersion] of Object.entries(deps)) {
			if (typeof depVersion === "string" && depVersion.startsWith("workspace:")) {
				const actualVersion = packageVersions.get(depName);
				if (actualVersion) {
					// Convert workspace:* to ^version
					// Convert workspace:~ to ~version
					// Convert workspace:^version to ^version
					const prefix = depVersion === "workspace:*" 
						? "^" 
						: depVersion.replace("workspace:", "").startsWith("~")
						? "~"
						: "^";
					
					deps[depName] = `${prefix}${actualVersion}`;
					modified = true;
					updatedCount++;
					console.log(`${pkg.name}: ${depName} workspace:* -> ^${actualVersion}`);
				}
			}
		}
	}

	if (modified) {
		writeFileSync(fullPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	}
}

console.log(`Updated ${updatedCount} workspace dependencies`);
