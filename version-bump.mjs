import { resolveTargetVersion, updateVersionFiles } from './scripts/versioning.mjs';

// Main execution
try {
	const targetVersion = resolveTargetVersion();
	if (!targetVersion) {
		throw new Error('No version specified. Pass a positional version like `npm run version -- 1.2.3`, use --version=x.y.z when invoking the node script directly, or set VERSION.');
	}

	const { targetVersion: newVersion, minAppVersion } =
		updateVersionFiles(targetVersion);
	console.log(
		`✓ Successfully updated version to ${newVersion} (minAppVersion: ${minAppVersion})`
	);
} catch (error) {
	console.error('Error:', error.message);
	process.exit(1);
}
