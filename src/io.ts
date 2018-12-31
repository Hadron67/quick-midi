import { MidiFile, Note, Track, MidiEventType } from "./Sequence";

class Chunk {
    data: number[] = [];
    private _lastPos: number;
    writeBytes(bytes: number[]){
        for (let b of bytes){
            this.data.push(b);
        }
        return this;
    }
    writeWord(n: number){
        n &= 0xffff;
        this.data.push(n >> 8);
        this.data.push(n & 0xff);
        return this;
    }
    writeString(s: string, limit: number = -1){
        for (let i = 0; i < s.length && (limit === -1 || i < limit); i++){
            this.data.push(s.charCodeAt(i));
        }
        return this;
    }
    writeUInt32At(n: number, pos?: number){
        if (pos === void 0)
            pos = this.data.length;
        while (this.data.length < pos + 4)
            this.data.push(0);
        this.data[pos + 0] = n >>> 24;
        this.data[pos + 1] = (n >>> 16) & 0xff;
        this.data[pos + 2] = (n >>> 8) & 0xff;
        this.data[pos + 3] = (n) & 0xff;
        return this;
    }
    placeHolder32(){
        let pos = this.data.length;
        this.data.push(0);
        this.data.push(0);
        this.data.push(0);
        this.data.push(0);
        return pos;
    }
    writeVarInt(n: number){
        let bytes: number[] = [];
        bytes.push(n & 0x7f);
        n >>>= 7;
        while (n > 0){
            bytes.push((n & 0x7f) | 0x80);
            n >>>= 7;
        }
        for (let i = bytes.length - 1; i >= 0; i--){
            this.data.push(bytes[i]);
        }
        return this;
    }
    pos(){
        return this.data.length;    
    }
    append(c: Chunk){
        for (let i = 0; i < c.data.length; i++){
            this.data.push(c.data[i]);
        }
        return this;
    }
    beginChunk(type: string){
        this.writeString(type);
        this._lastPos = this.placeHolder32();
    }
    endChunk(){
        this.writeUInt32At(this.data.length - this._lastPos - 4, this._lastPos);
    }
};

function writeHeaderChunk(file: MidiFile, chunk: Chunk){
    chunk.writeString('MThd');
    chunk.writeUInt32At(6);
    chunk.writeWord(1);
    chunk.writeWord(file.tracks.length + 1);
    chunk.writeWord(file.division & 0x7fff);
}

function log2(n: number): number{
    let i = 0;
    while (n > 0) {
        n >>= 1;
        i++;
    }
    return i;
}

function writeMetaEvents(file: MidiFile, chunk: Chunk){
    // Set tempo
    chunk.writeBytes([0x0, 0xFF, 0x51, 0x03, (file.startTempo >>> 16) & 0xff, (file.startTempo >>> 8) & 0xff, (file.startTempo) & 0xff]);
    // Key signature
    chunk.writeBytes([0x0, 0xFF, 0x59, 0x02, Note.shiftToKeySignature(file.keysig, file.minor), file.minor ? 1 : 0]);
    // Time signature
    chunk.writeBytes([0x0, 0xFF, 0x58, 0x04, file.timesig.numerator, log2(file.timesig.denominator), file.metronome.clocks, file.metronome.n32]);
    // EOT
    chunk.writeBytes([0x1, 0xFF, 0x2F, 0x00]);
}

function writeTrackMetaEvents(file: MidiFile, track: Track, channel: number, chunk: Chunk){
    // Program change (instrument)
    if (track.instrument !== -1)
    chunk.writeBytes([0x00, 0xC0 | channel, track.instrument & 0x7f]);
    // Reset all controllers
    chunk.writeBytes([0x00, 0xB0 | channel, 0x79, 0x00]);
    // Volume
    chunk.writeBytes([0x00, 0xB0 | channel, 0x07, track.volume & 0xff]);
    if (track.name !== null){
        chunk.writeBytes([0x00, 0xFF, 0x03, track.name.length & 0xff]).writeString(track.name, 0xff);
    }
}

function writeTrackEvents(file: MidiFile, track: Track, channel: number, chunk: Chunk){
    for (let event of track.events){
        chunk.writeVarInt(event.delta);
        switch (event.type){
            case MidiEventType.NOTEON:
                chunk.writeBytes([0x90 | channel, event.note, event.velocity]);
                break;
            case MidiEventType.NOTEOFF:
                chunk.writeBytes([0x80 | channel, event.note, 0]);
                break;
            case MidiEventType.TEMPO_CHANGE:
                chunk.writeBytes([0xFF, 0x51, 0x03, (file.startTempo >>> 16) & 0xff, (file.startTempo >>> 8) & 0xff, (file.startTempo) & 0xff]);
                break;
            default:
                throw new Error(`Unimplemented event ${MidiEventType[(event as any).type]}`);
        }
    }
    // EOT
    chunk.writeBytes([0x1, 0xFF, 0x2F, 0x00]);
}

function saveFormat1MidiFile(file: MidiFile){
    let ret: Chunk = new Chunk();

    writeHeaderChunk(file, ret);

    ret.beginChunk('MTrk');
    writeMetaEvents(file, ret);
    ret.endChunk();

    for (let i = 0, _a = file.tracks; i < _a.length; i++){
        ret.beginChunk('MTrk');
        writeTrackMetaEvents(file, _a[i], i, ret);
        writeTrackEvents(file, _a[i], i, ret);
        ret.endChunk();
    }

    return ret.data;
}

export function saveMidiFile(file: MidiFile): number[] /* Uint8Array */{
    switch (file.format){
        case 1: return saveFormat1MidiFile(file);
        default: throw new Error(`Format ${file.format} is not currently supported`);
    }
}