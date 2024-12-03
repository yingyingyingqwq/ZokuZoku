import os from "os";

// workaround for esbuild to ignore the module
declare const __BUNDLED__: boolean | undefined;
function bajonk() {
    if (typeof __BUNDLED__ === "boolean" && __BUNDLED__) {
        return `../bin/criCodecs-${os.platform()}-${os.arch()}`;
    }
    else {
        return `../../bin/criCodecs-${os.platform()}-${os.arch()}`;
    }
}

const ffi: {
    HcaDecode(buffer: Buffer, headerSize: number, keycode: number, subkey: number): Promise<Buffer>
} = require(bajonk());

export default ffi;