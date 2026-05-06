import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, join, normalize } from 'path';

process.loadEnvFile?.();

const configuredVaultPath = process.env.OBSIDIAN_VAULT_PATH;
const obsidianCli = 'obsidian';
const reloadMode = resolveReloadMode();
const pluginId = readPluginId();

if (!configuredVaultPath) {
    console.error('Error: OBSIDIAN_VAULT_PATH not found in .env');
    process.exit(1);
}

if (!pluginId) {
    console.error('Error: Could not determine plugin id from manifest.json');
    process.exit(1);
}

const syncTarget = resolveSyncTarget(configuredVaultPath, pluginId);

const filesToSync = ['main.js', 'manifest.json', 'styles.css'];

try {
    if (!existsSync(syncTarget.pluginPath)) {
        mkdirSync(syncTarget.pluginPath, { recursive: true });
    }

    filesToSync.forEach((file) => {
        if (existsSync(file)) {
            copyFileSync(file, join(syncTarget.pluginPath, file));
            console.log(`Synced ${file} to ${syncTarget.pluginPath}`);
        } else {
            console.warn(`Warning: ${file} not found, skipping.`);
        }
    });

    console.log('Sync completed successfully!');
    reloadObsidian();
} catch (err) {
    console.error(`Error during sync: ${err.message}`);
    process.exit(1);
}

function reloadObsidian() {
    if (reloadMode === 'none') {
        return;
    }

    const args = buildReloadArgs();
    if (!args) {
        return;
    }

    console.log(`Reloading Obsidian via CLI from ${syncTarget.vaultPath}: ${obsidianCli} ${args.join(' ')}`);
    const result = spawnSync(obsidianCli, args, {
        cwd: syncTarget.vaultPath,
        stdio: 'inherit',
    });

    if (result.error) {
        handleReloadFailure(
            `Could not run ${obsidianCli}. Enable Obsidian CLI in Obsidian Settings → General, register it, then restart your terminal.`,
            result.error,
        );
        return;
    }

    if (result.status !== 0) {
        handleReloadFailure(`Obsidian CLI exited with code ${result.status}.`);
    }
}

function buildReloadArgs() {
    if (reloadMode === 'plugin') {
        return ['plugin:reload', `id=${pluginId}`];
    }

    if (reloadMode === 'app') {
        return ['reload'];
    }

    handleReloadFailure(`Unsupported OBSIDIAN_SYNC_RELOAD "${reloadMode}". Use "plugin", "app", or "none".`);
    return null;
}

function resolveSyncTarget(vaultPath, pluginId) {
    const normalizedVaultPath = normalize(vaultPath);
    const legacyVaultPath = inferVaultPathFromPluginPath(normalizedVaultPath, pluginId);

    if (legacyVaultPath) {
        console.warn(
            'Warning: OBSIDIAN_VAULT_PATH points to the plugin directory. Update it to the vault root when convenient.',
        );
        return {
            pluginPath: normalizedVaultPath,
            vaultPath: legacyVaultPath,
        };
    }

    return {
        pluginPath: join(normalizedVaultPath, '.obsidian', 'plugins', pluginId),
        vaultPath: normalizedVaultPath,
    };
}

function inferVaultPathFromPluginPath(pluginPath, pluginId) {
    const pluginDir = basename(pluginPath);
    const pluginsDir = basename(dirname(pluginPath));
    const obsidianDir = basename(dirname(dirname(pluginPath)));

    if (!samePathSegment(pluginDir, pluginId) || !samePathSegment(pluginsDir, 'plugins')) {
        return null;
    }

    if (!samePathSegment(obsidianDir, '.obsidian')) {
        return null;
    }

    return dirname(dirname(dirname(pluginPath)));
}

function samePathSegment(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}

function resolveReloadMode() {
    const syncReload = (process.env.OBSIDIAN_SYNC_RELOAD || 'plugin').trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(syncReload)) {
        return 'none';
    }
    if (['1', 'true', 'yes', 'on'].includes(syncReload)) {
        return 'plugin';
    }
    return syncReload;
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

function handleReloadFailure(message, error = null) {
    console.warn(`Warning: ${message}`);
    if (error) {
        console.warn(`Warning: ${error.message}`);
    }
}
