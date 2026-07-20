import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

loadOptionalEnvFile();

const profile = process.argv[2]?.trim().toLowerCase();
if (!['phone', 'tablet'].includes(profile)) {
	console.error('Error: Specify an Android profile: phone or tablet.');
	process.exit(1);
}

const envPrefix = `OBSIDIAN_${profile.toUpperCase()}`;
const vaultPath = process.env[`${envPrefix}_VAULT_PATH`]?.trim();
const device = process.env[`${envPrefix}_DEVICE`]?.trim();
const adbPath = process.env[`${envPrefix}_ADB_PATH`]?.trim() || 'adb';
const adbServerPort = process.env[`${envPrefix}_ADB_SERVER_PORT`]?.trim();
const pluginId = readPluginId();
const filesToSync = ['main.js', 'manifest.json', 'styles.css'];

if (!vaultPath) {
	console.error(`Error: ${envPrefix}_VAULT_PATH is not set. Add it to .env (see .env.example).`);
	process.exit(1);
}

if (!vaultPath.startsWith('/') || vaultPath === '/') {
	console.error(`Error: ${envPrefix}_VAULT_PATH must be an absolute Android vault path.`);
	process.exit(1);
}

if (!pluginId) {
	console.error('Error: Could not determine plugin id from manifest.json');
	process.exit(1);
}

for (const file of filesToSync) {
	if (!existsSync(file)) {
		console.error(`Error: ${file} not found. Run npm run build first.`);
		process.exit(1);
	}
}

const selector = device ? ['-s', device] : [];
const server = adbServerPort ? ['-P', adbServerPort] : [];
const obsidianPath = posix.join(vaultPath, '.obsidian');
const pluginPath = posix.join(obsidianPath, 'plugins', pluginId);

if (device?.includes(':')) {
	runAdb(['connect', device], 'Could not connect to the Android device over Wi-Fi.', false, false);
}
runAdb(['get-state'], 'Could not connect to the Android device.');
runAdb(['shell', 'test', '-d', obsidianPath], `Obsidian configuration directory not found: ${obsidianPath}`);
runAdb(['shell', 'mkdir', '-p', pluginPath], `Could not create plugin directory: ${pluginPath}`);

for (const file of filesToSync) {
	runAdb(['push', file, `${pluginPath}/${file}`], `Could not sync ${file}.`, true);
}

console.log(`Synced ${pluginId} to ${profile}: ${pluginPath}`);
runAdb(['shell', 'am', 'force-stop', 'md.obsidian'], 'Could not stop Obsidian.');
runAdb(
	['shell', 'monkey', '-p', 'md.obsidian', '-c', 'android.intent.category.LAUNCHER', '1'],
	'Could not reopen Obsidian.',
);
console.log(`${profile[0].toUpperCase()}${profile.slice(1)} sync completed successfully!`);

function runAdb(args, failureMessage, inheritOutput = false, targetDevice = true) {
	const result = spawnSync(adbPath, [...server, ...(targetDevice ? selector : []), ...args], {
		encoding: 'utf8',
		stdio: inheritOutput ? 'inherit' : 'pipe',
	});

	if (result.error) {
		console.error(`Error: ${failureMessage}`);
		console.error(`Error: ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		console.error(`Error: ${failureMessage}`);
		const detail = result.stderr?.trim() || result.stdout?.trim();
		if (detail) console.error(`Error: ${detail}`);
		process.exit(1);
	}
}

function loadOptionalEnvFile() {
	if (typeof process.loadEnvFile === 'function' && existsSync('.env')) {
		process.loadEnvFile();
	}
}

function readPluginId() {
	try {
		const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
		return typeof manifest.id === 'string' ? manifest.id : null;
	} catch (err) {
		console.warn(`Warning: Could not read manifest.json: ${err.message}`);
		return null;
	}
}
