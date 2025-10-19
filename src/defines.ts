import path from "path";
import os from "os";

export const ZOKUZOKU_DIR = path.join(os.homedir(), ".zokuzoku");
export const PYMPORT_DIR = path.join(ZOKUZOKU_DIR, "pymport");
export const PYMPORT_INSTALLED_FILE = path.join(PYMPORT_DIR, ".installed");
export const PYMPORT_VER = "v1.5.1";
export const UNITYPY_VER = "1.10.18";
export const APSW_VER = "3.50.4.0";

export const HCA_KEY = 75923756697503n;
