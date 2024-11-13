import ffi from "./ffi";

function readHeaderSize(buffer: Buffer) {
    return buffer.readUint16BE(6);
}

function decode(buffer: Buffer, keycode: number, subkey: number) {
    return ffi.HcaDecode(buffer, readHeaderSize(buffer), keycode, subkey);
}

export default {
    readHeaderSize,
    decode
};