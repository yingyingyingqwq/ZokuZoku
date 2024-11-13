import os from "os";
const ffi: {
    HcaDecode(buffer: Buffer, headerSize: number, keycode: number, subkey: number): Promise<Buffer>
} = require(`../../bin/criCodecs-${os.platform()}-${os.arch()}`);

export default ffi;