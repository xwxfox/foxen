#!/usr/bin/env bun
import { Glob } from "bun";

const packagesDir = `${import.meta.dir}/../packages`;
const glob = new Glob("*/package.json");

// First, collect all package versions
const packageVersions = new Map<string, string>();

for await (const pkgPath of glob.scan(packagesDir)) {
	const fullPath = `${packagesDir}/${pkgPath}`;
	const pkg = await Bun.file(fullPath).json();
	packageVersions.set(pkg.name, pkg.version);
}

console.log("Found packages:", Array.from(packageVersions.keys()).join(", "));

// Now, update all workspace:* dependencies
let updatedCount = 0;

for await (const pkgPath of glob.scan(packagesDir)) {
	const fullPath = `${packagesDir}/${pkgPath}`;
	const pkg = await Bun.file(fullPath).json();
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
		await Bun.write(fullPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	}
}

console.log(`Updated ${updatedCount} workspace dependencies`);
