import SQLite from "../sqlite";
import { UnityPyEnv } from "../unityPy/environment";
import path from "path";
import fs from "fs/promises";
import downloader from "./downloader";
import UnityPy from "../unityPy";
import config from "../config";

async function getAssetHash(name: string) {
    let sqlite = SQLite.instance;
    let query = `SELECT h FROM a WHERE n = '${name.replace("'", "")}'`;
    let queryRes = await sqlite.queryMeta(query);
    return queryRes.at(0)?.rows.at(0)?.at(0);
}

async function loadBundle(name: string): Promise<UnityPyEnv> {
    let hash = await getAssetHash(name);
    if (hash) {
        return loadBundleByHash(hash);
    }
    else {
        throw new Error("Failed to resolve asset bundle with name: " + name);
    }
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

async function loadBundleByHash(hash: string): Promise<UnityPyEnv> {
    let { assetDir, assetPath } = getAssetPath(hash);
    let exists: boolean;
    try {
        await fs.stat(assetPath);
        exists = true;
    }
    catch {
        exists = false;
    }

    if (!exists) {
        let autoDownloadBundles = config().get<boolean>("autoDownloadBundles");
        if (!autoDownloadBundles) {
            throw new Error("Asset bundle not found: " + hash);
        }

        let platform = await getMetaPlatform();
        if (!platform) {
            throw new Error("Failed to detect platform of meta database");
        }

        let downloadUrl = getBundleDownloadUrl(platform, hash);
        await fs.mkdir(assetDir, { recursive: true });
        await downloader.downloadToFile(downloadUrl, "Downloading asset bundle: " + hash, assetPath, true);
    }

    return UnityPy.load(assetPath);
}

const META_PLATFORM_QUERY = `SELECT n FROM c WHERE n = '//Android' OR n = '//Windows'`;
async function getMetaPlatform(): Promise<string | undefined> {
    let sqlite = SQLite.instance;
    let queryRes = await sqlite.queryMeta(META_PLATFORM_QUERY);
    return queryRes.at(0)?.rows.at(0)?.at(0)?.slice(2);
}

function getBundleDownloadUrl(platform: string, hash: string) {
    return `https://prd-storage-game-umamusume.akamaized.net/dl/resources/${platform}/assetbundles/${hash.slice(0, 2)}/${hash}`;
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

async function loadGenericAssetByHash(hash: string): Promise<string> {
    let { assetDir, assetPath } = getAssetPath(hash);
    try {
        await fs.stat(assetPath);
        return assetPath;
    }
    catch {
    }

    let autoDownloadBundles = config().get<boolean>("autoDownloadBundles");
    if (!autoDownloadBundles) {
        throw new Error("Asset not found: " + hash);
    }

    let downloadUrl = getGenericDownloadUrl(hash);
    await fs.mkdir(assetDir, { recursive: true });
    await downloader.downloadToFile(downloadUrl, "Downloading generic asset: " + hash, assetPath, true);

    return assetPath;
}

function getGenericDownloadUrl(hash: string) {
    return `https://prd-storage-game-umamusume.akamaized.net/dl/resources/Generic/${hash.slice(0, 2)}/${hash}`;
}

export default {
    getAssetHash,
    loadBundle,
    getAssetPath,
    loadBundleByHash,
    loadGenericAsset,
    loadGenericAssetByHash
};