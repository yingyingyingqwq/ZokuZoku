import fs from "fs/promises";
import path from "path";
import hca from "./hca";

async function parse(pathOrBuffer: string | Buffer) {
    const buffer = typeof pathOrBuffer === 'string' ?
        await fs.readFile(pathOrBuffer) :
        pathOrBuffer;
    
    if (!buffer || buffer.length < 4) {
        return null;
    }
    let pos = 0;
    const config: any = {};
    config.buffer = buffer;
    config.magic = buffer.subarray(pos, 4).toString(); pos += 4;
    if (config.magic !== 'AFS2') { return null; }
    config.unknown1 = buffer.readUInt8(pos); pos += 1;
    config.sizeLen = buffer.readUInt8(pos); pos += 1;
    config.unknown2 = buffer.readUInt8(pos); pos += 1;
    config.unknown3 = buffer.readUInt8(pos); pos += 1;
    config.fileCount = buffer.readUInt32LE(pos); pos += 4;
    config.align = buffer.readUInt16LE(pos); pos += 2;
    config.key = buffer.readUInt16LE(pos); pos += 2;
    config.fileIds = [];
    for (let i = 0; i < config.fileCount; i++) {
        const fileId = buffer.readUInt16LE(pos); pos += 2;
        config.fileIds.push(fileId);
    }
    const files: any = [];
    let start;
    if (config.sizeLen === 2) {
        start = buffer.readUInt16LE(pos); pos += 2;
    } else if (config.sizeLen === 4) {
        start = buffer.readUInt32LE(pos); pos += 4;
    } else {
        throw new Error("Invalid size length");
    }
    let mod = start % config.align;
    if (mod !== 0) {
        start += config.align - mod;
    }
    for (let i = 0; i < config.fileCount; i++) {
        let end;
        if (config.sizeLen === 2) {
            end = buffer.readUInt16LE(pos); pos += 2;
        } else if (config.sizeLen === 4) {
            end = buffer.readUInt32LE(pos); pos += 4;
        } else {
            throw new Error("Invalid size length");
        }
        files.push(buffer.subarray(start, end));
        start = end;
        mod = start % config.align;
        if (mod !== 0) {
            start += config.align - mod;
        }
    }
    files.config = config;
    return files;
}

async function decodeToWavFiles(awbPath: string, key: number, wavDir: string) {
    const list = await parse(awbPath);
    await fs.mkdir(wavDir, { recursive: true });
    for (let i = 0; i < list.length; i++) {
        const hcaBuffer = list[i];
        const wavPath = path.join(wavDir, (i + 1) + ".wav");
        const wavBuffer = await hca.decode(hcaBuffer, key, list.config.key);
        await fs.writeFile(wavPath, wavBuffer);
    }
}

export default {
    parse,
    decodeToWavFiles
};