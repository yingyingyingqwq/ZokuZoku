import fs from "fs/promises";
import path from "path";
import { pathExists } from "./utils";
import hca from "./hca";
import afs2 from "./afs2";
import utf from "./utf";

async function parse(acbPath: string) {
    const pathInfo = path.parse(acbPath);
    const buffer = await fs.readFile(acbPath);
    const utfs = utf.parse(buffer);
    if (!utfs) {
        throw new Error("Not an ACB file");
    }
    if (utfs.length !== 1) {
        throw new Error("More than one UTF entry in ACB");
    }
    const acb = utfs[0];
    acb.buffer = buffer;
    acb.memoryHcas = await afs2.parse(acb.AwbFile);
    acb.streamHcas = [];
    for (let i = 0; i < acb.StreamAwbHash.length; i++) {
        const StreamAwb = acb.StreamAwbHash[i];
        const awbPath = path.join(pathInfo.dir, StreamAwb.Name + '.awb');
        if (await pathExists(awbPath)) {
            const obj = await afs2.parse(awbPath);
            acb.streamHcas.push(obj);
        }
    }
    for (let i = 0; i < acb.WaveformTable.length; i++) {
        const Waveform = acb.WaveformTable[i];
        const isMemory = Waveform.Streaming === 0;
        if (!isMemory) {
            if (!acb.streamHcas[Waveform.StreamAwbPortNo]) {
                throw new Error(`MISSING ${acb.StreamAwbHash[i].Name}.awb`);
            }
        }
    }
    return acb;
}

async function decodeToWavFiles(acbPath: string, key: number, wavDir: string) {
    const acb = await parse(acbPath);
    await fs.mkdir(wavDir, { recursive: true });
    let memory = 0, stream = 0;
    for (let i = 0; i < acb.WaveformTable.length; i++) {
        const Waveform = acb.WaveformTable[i];
        const isMemory = Waveform.Streaming === 0;
        const hcaBuffer = isMemory ? acb.memoryHcas[Waveform.MemoryAwbId] : acb.streamHcas[Waveform.StreamAwbPortNo][Waveform.StreamAwbId];
        const awbKey = isMemory ? acb.memoryHcas.config.key : acb.streamHcas[Waveform.StreamAwbPortNo].config.key;
        const name = isMemory ? `memory_${++memory}.wav` : `stream_${++stream}.wav`;
        const wavPath = path.join(wavDir, name);
        const wavBuffer = await hca.decode(hcaBuffer, key, awbKey);
        await fs.writeFile(wavPath, wavBuffer);
    }
}

export default {
    parse,
    decodeToWavFiles
};