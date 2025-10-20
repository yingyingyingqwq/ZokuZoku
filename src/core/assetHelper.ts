import SQLite from "../sqlite";
import path from "path";
import fs from "fs/promises";
import downloader from "./downloader";
import config from "../config";
import { loadBundle as loadBundleViaBridge } from '../pythonBridge';
import { resolve as resolvePath } from 'path';
import { whenReady } from '../extensionContext';

async function getAssetHash(name: string) {
    await whenReady;
    let sqlite = SQLite.instance;
    let query = `SELECT h FROM a WHERE n = '${name.replace("'", "")}'`;
    let queryRes = await sqlite.queryMeta(query);
    return queryRes.at(0)?.rows.at(0)?.at(0);
}

function getAssetPath(hash: string) {
    let gameDataDir = config().get<string>("gameDataDir");
    if (!gameDataDir) {
        throw new Error("Attempted to load an asset file, but the game data directory is not set");
    }

    let assetDir = path.join(gameDataDir, "dat", hash.slice(0, 2));
    return {
        assetDir,
        assetPath: path.join(assetDir, hash)
    };
}

const META_PLATFORM_QUERY = `SELECT n FROM c WHERE n = '//Android' OR n = '//Windows'`;
async function getMetaPlatform(): Promise<string | undefined> {
    let sqlite = SQLite.instance;
    let queryRes = await sqlite.queryMeta(META_PLATFORM_QUERY);
    return queryRes.at(0)?.rows.at(0)?.at(0)?.slice(2);
}

function getBundleDownloadUrl(platform: string, hash: string) {
    return `https://prd-storage-app-umamusume.akamaized.net/dl/resources/${platform}/assetbundles/${hash.slice(0, 2)}/${hash}`;
}

async function loadGenericAsset(name: string): Promise<string> {
    let hash = await getAssetHash(name);
    if (hash) {
        return loadGenericAssetByHash(hash);
    }
    else {
        throw new Error("Failed to resolve generic asset with name: " + name);
    }
}

function getGenericDownloadUrl(hash: string) {
    return `https://prd-storage-app-umamusume.akamaized.net/dl/resources/Generic/${hash.slice(0, 2)}/${hash}`;
}

async function ensureAssetDownloaded(hash: string, isGeneric: boolean): Promise<string> {
    const { assetDir, assetPath } = getAssetPath(hash);

    try {
        await fs.stat(assetPath);
        return assetPath;
    } catch {
    }

    const autoDownloadBundles = config().get<boolean>("autoDownloadBundles");
    if (!autoDownloadBundles) {
        throw new Error(`Asset not found and auto-download is disabled: ${hash}`);
    }

    let downloadUrl: string;
    let assetType: string;

    if (isGeneric) {
        downloadUrl = getGenericDownloadUrl(hash);
        assetType = "generic asset";
    } else {
        const platform = await getMetaPlatform();
        if (!platform) {
            throw new Error("Could not determine platform from meta DB to download asset bundle.");
        }
        downloadUrl = getBundleDownloadUrl(platform, hash);
        assetType = "asset bundle";
    }

    await fs.mkdir(assetDir, { recursive: true });
    await downloader.downloadToFile(downloadUrl, `Downloading ${assetType}: ${hash}`, assetPath, true);

    return assetPath;
}

export default {
    getAssetHash,
    getAssetPath,
    ensureAssetDownloaded
};