import * as vscode from 'vscode';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import tar from 'tar';
import { spawn } from "child_process";

import downloader from './core/downloader';
import { getGameInstallPath } from './core/utils';
import SQLite from './sqlite';
import config, { CONFIG_SECTION } from './config';
import { ZOKUZOKU_DIR, PYMPORT_DIR, PYMPORT_INSTALLED_FILE, PYMPORT_VER, UNITYPY_VER } from "./defines";

const YES = vscode.l10n.t('Yes');
const NO = vscode.l10n.t('No');
const OK = vscode.l10n.t('OK');
const CANCEL = vscode.l10n.t('Cancel');

// Any other module from this package must be imported dynamically,
// after pymport bindings have been downloaded.

async function checkPymport(): Promise<boolean> {
    try {
        const installedVer = await fs.readFile(PYMPORT_INSTALLED_FILE, { encoding: "utf8" });
        return installedVer === PYMPORT_VER;
    }
    catch {
        return false;
    }
}

async function installPymport() {
    await fs.rm(PYMPORT_DIR, { recursive: true, force: true });
    await fs.mkdir(PYMPORT_DIR, { recursive: true });
    const downloadUrl = `https://github.com/mmomtchev/pymport/releases/download/${PYMPORT_VER}/${os.platform()}-x64.tar.gz`;
    const downloadPath = path.join(ZOKUZOKU_DIR, "tmp.tar.gz");
    await downloader.downloadToFile(
        downloadUrl,
        vscode.l10n.t('Downloading pymport {0}', {0: PYMPORT_VER}
        ),
        downloadPath,
        true
    );

    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t('Installing pymport...')
    };
    await vscode.window.withProgress(progressOptions, async () => {
        await tar.x({
            file: downloadPath,
            strip: 1,
            cwd: PYMPORT_DIR
        });
        await fs.unlink(downloadPath);
        await fs.writeFile(PYMPORT_INSTALLED_FILE, PYMPORT_VER, { encoding: "utf8" });
    });
}

async function checkUnityPy(): Promise<boolean> {
    try {
        const { UnityPy } = await import("./unityPy/index.js");
        return UnityPy.__version__.toJS() === UNITYPY_VER;
    }
    catch (e) {
        return false;
    }
}

async function installUnityPy() {
    const exe = os.platform() === 'win32' ? 'python.exe' : path.join('bin', 'python3');
    const python = path.join(PYMPORT_DIR, exe);

    try {
        await fs.stat(python);
    }
    catch {
        throw new Error(vscode.l10n.t('Python binary not found in pymport install dir'));
    }

    const pip = spawn(python, ['-m', 'pip', 'install', 'UnityPy==' + UNITYPY_VER, '--force-reinstall'], {
        stdio: 'inherit',
        env: {
            ...process.env,
            PYTHONHOME: PYMPORT_DIR
        }
    });

    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t('Installing UnityPy...')
    };
    await vscode.window.withProgress(progressOptions, () => {
        return new Promise<void>((resolve, reject) => {
            pip.on("error", e => {
                reject(e);
            })
            .on("exit", code => {
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error(vscode.l10n.t('Python pip process exited with code {0}', {0: code})));
            });
        });
    });

    if (await checkUnityPy() === false) {
        throw new Error(vscode.l10n.t('Failed to verify UnityPy installation.'));
    }
}

const USER_GAME_DATA_DIR = path.join(os.homedir(), "AppData", "LocalLow", "Cygames", "umamusume");
const GAME_DATA_FILES = [ "meta", path.join("master", "master.mdb") ];
async function checkGameDataDir() {
    if (config().get("gameDataDir")) { return; }

    let found = true;
    for (const file of GAME_DATA_FILES) {
        try {
            await fs.stat(path.join(USER_GAME_DATA_DIR, file));
        }
        catch {
            found = false;
            break;
        }
    }

    if (found) {
        let res = await vscode.window.showWarningMessage(
            vscode.l10n.t('The game data directory has not been set. Would you like to set it to "{0}"?', {0: USER_GAME_DATA_DIR}),
            YES, NO
        );
        if (res === YES) {
            await config().update("gameDataDir", USER_GAME_DATA_DIR, true);
        }
    }
    else {
        vscode.window.showWarningMessage(
            vscode.l10n.t('The game data directory has not been set and was not automatically detected. Please set it manually in Settings.')
        );
    }
}

async function checkLocalizeDictDump() {
    if (config().get("localizeDictDump")) { return; }

    let dumpPath: string | undefined;
    const installPath = await getGameInstallPath();
    if (installPath) {
        try {
            let tmp = path.join(installPath, "hachimi", "localize_dump.json");
            await fs.stat(tmp);
            dumpPath = tmp;
        }
        catch {
        }
    }

    if (dumpPath) {
        let res = await vscode.window.showWarningMessage(
            vscode.l10n.t('The localize dict dump path has not been set. Would you like to set it to "{0}"?', {0: dumpPath}),
            YES, NO
        );
        if (res === YES) {
            await config().update("localizeDictDump", dumpPath, true);
        }
    }
    else {
        vscode.window.showWarningMessage(
            vscode.l10n.t('The localize dict dump path has not been set and was not automatically detected. Please set it manually in Settings.')
        );
        return;
    }
}

async function registerDisposables(context: vscode.ExtensionContext): Promise<vscode.Disposable[]> {
    const { registerCommands } = await import("./commands.js");
    const { registerEditors } = await import("./editors/index.js");
    const { registerViews } = await import("./views/index.js");
    return [
        ...registerCommands(context),
        ...registerEditors(context),
        ...registerViews(context)
    ];
}

async function checkEnabled() {
    const { setActive } = await import("./core/index.js");
    let enabled = config().inspect<boolean>("enabled")?.workspaceValue;
    if (typeof enabled === "boolean") {
        setActive(enabled);
    }
    else {
        setActive(false);
        vscode.window.showInformationMessage(
            vscode.l10n.t('Would you like to enable ZokuZoku for this workspace?'),
            YES, NO
        )
        .then(res => {
            if (res === YES) {
                config().update("enabled", true, false);
                setActive(true);
            }
        });
    }
}

// note: vscode won't wait for this promise
export async function activate(context: vscode.ExtensionContext) {
    SQLite.init(context.extensionPath);
    const pyInstalled = await checkPymport();
    const unityPyInstalled = pyInstalled ? await checkUnityPy() : false;
    if (!pyInstalled || !unityPyInstalled) {
        const res = await vscode.window.showInformationMessage(
            vscode.l10n.t('ZokuZoku needs to install some dependencies before it can be used.'),
            OK, CANCEL
        );
        if (res === CANCEL) {
            return;
        }

        try {
            if (!pyInstalled) { await installPymport(); }
            if (!unityPyInstalled) { await installUnityPy(); }
            vscode.window.showInformationMessage(
                vscode.l10n.t('ZokuZoku\'s dependencies have been installed to "{0}"', {0: ZOKUZOKU_DIR})
            );
        }
        catch (e) {
            vscode.window.showErrorMessage("" + e);
            // try to clean up, ignore errors
            fs.rm(PYMPORT_DIR, { recursive: true, force: true }).catch(() => {});
            return;
        }
    }

    await checkGameDataDir();
    await checkLocalizeDictDump();

    context.subscriptions.push(...await registerDisposables(context));

    await checkEnabled();

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
            checkEnabled();
            SQLite.init(context.extensionPath);
        }
    });
}

export function deactivate() {}
