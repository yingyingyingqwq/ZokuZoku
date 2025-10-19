import SQLite from "../sqlite";
import path from "path";
import fs from "fs/promises";
import downloader from "./downloader";
import config from "../config";
import { loadBundle as loadBundleViaBridge } from '../pythonBridge';
import { resolve as resolvePath } from 'path';

async function getAssetHash(name: string) {
    let sqlite = SQLite.instance;
    let query = `SELECT h FROM a WHERE n = '${name.replace("'", "")}'`;
    let queryRes = await sqlite.queryMeta(query);
    return queryRes.at(0)?.rows.at(0)?.at(0);
}

async function loadBundle(assetBundleName: string) {
    const hash = await getAssetHash(assetBundleName);
    if (!hash) {
        throw new Error(`Could not find hash for asset bundle: ${assetBundleName}`);
    }
    return loadBundleByHash(hash);
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

async function loadBundleByHash(hash: string) {
    const { assetPath } = getAssetPath(hash);
    const useDecryption = config().get<boolean>("decryption.enabled");
    const metaPath = SQLite.instance.getMetaPath();
    const metaKey = config().get<string>("decryption.metaKey");

    if (useDecryption && !metaPath) {
        throw new Error("Decryption is enabled, but the meta path is not set.");
    }

    const absoluteAssetPath = resolvePath(assetPath);
    const absoluteMetaPath = metaPath ? resolvePath(metaPath) : '';

    return await loadBundleViaBridge({
        assetPath: absoluteAssetPath,
        assetName: '',
        useDecryption: useDecryption,
        metaPath: absoluteMetaPath,
        bundleHash: hash,
        metaKey: metaKey
    });
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