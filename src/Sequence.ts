import { List } from "./List";
import { throws } from "assert";

/*
    Number representation of notes:

  octave|note C  C#  D  D#  E  F  F#  G  G#  A  A#  B
     -1 |     0
      0 |
      1 |     
      2 |     
      3 |     
      4 |     
      5 |     
      6 |     
      7 |     
      8 |     
      9 |                                           131
    and 132 for stop

    Number representation of durations:

    768: ----
    384: --
    192: -
    96 :
    48 : _
    24 : _ _
    12 : _ _ _
    6  : _ _ _ _
    that is, 1 = length of 64th note
*/
const toneName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const toneNum =  ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];
const numToNote = [0, 2, 4, 5, 7, 9, 11];
const majorKeyToSignature = [
    0, // C 
    7, // C# 
    2, // D
    -3,// Eb
    4, // E
    -1,// F
    6, // F#
    1, // G
    -4,// Ab
    3, // A
    -2,// Bb
    5, // B
];

export class Note {
    velocity: number = 0; // not used at present
    constructor(public note: number, public duration: number){}
    toString(useNum: boolean = false){
        let note = '';
        const n: string[] = useNum ? toneNum : toneName;
        return `< ${n[Note.getTone(this.note)]} ${Note.getOctave(this.note)}, ${this.duration} >`;
    }
    normalize(){
        if (this.note < 0){
            this.note = 0;
        }
        if (this.note > 132){
            this.note = 131;
        }
        this.duration = Math.round(this.duration) | 0;
        if (this.duration === 0){
            this.duration = 1;
        }
        return this;
    }
    shiftOctave(n: number){
        if (!this.isRest())
            this.note += n * 12;
    }
    shift(n: number){
        if (!this.isRest())
            this.note += n;
    }
    isRest(){
        return this.note === Note.REST;
    }
    static getTone(note: number){ return note % 12; }
    static getOctave(note: number){ return (note / 12 | 0) - 1; }
    static numberToNote(n: number, octave: number){ return n === 0 ? 132 : numToNote[n - 1] + 12 * (octave + 1); }
    static REST = 132;
    static NOTE_COUNT = 132;
    static DEFLEN = 96;
    static shiftToKeySignature(shift: number, minor: boolean = false){
        if (minor)
            shift -= 3;
        while (shift < 0)
            shift += 12;
        while (shift >= 12)
            shift -= 12;
        return majorKeyToSignature[shift];
    }
}

export enum MidiEventType {
    NOTEON, NOTEOFF, TEMPO_CHANGE, KEY_SIGNATURE_CHANGE, TIME_SIGNATURE_CHANGE
};

export interface MidiEventBase {
    type: MidiEventType;
    delta: number;
};

export interface NoteOnEvent extends MidiEventBase {
    type: MidiEventType.NOTEON;
    note: number;
    velocity: number;
    channel: number;
};

export interface NoteOffEvent extends MidiEventBase {
    type: MidiEventType.NOTEOFF;
    note: number;
    velocity: number;
    channel: number;
};

export interface TempoChangeEvent extends MidiEventBase {
    type: MidiEventType.TEMPO_CHANGE;
    tempo: number;
};

export interface KeySignatureChangeEvent extends MidiEventBase {
    type: MidiEventType.KEY_SIGNATURE_CHANGE;
    shift: number;
    minor: boolean;
};

export interface TimeSignatureChangeEvent extends MidiEventBase {
    type: MidiEventType.TIME_SIGNATURE_CHANGE;
    sig: TimeSignature;
};

export type MidiEvent = NoteOnEvent | NoteOffEvent | TempoChangeEvent | KeySignatureChangeEvent | TimeSignatureChangeEvent;

export function createNoteOnEvent(note: number, delta: number, channel: number, velocity: number): NoteOnEvent{
    return { type: MidiEventType.NOTEON, delta, note, channel, velocity };
}

export function createNoteOffEvent(note: number, delta: number, channel: number, velocity: number): NoteOffEvent{
    return { type: MidiEventType.NOTEOFF, delta, note, channel, velocity };
}

export function createTempoChangeEvent(tempo: number, delta: number): TempoChangeEvent{
    return { type: MidiEventType.TEMPO_CHANGE, tempo, delta };
}

export function createKeySignatureChangeEvent(shift: number, minor: boolean, delta: number): KeySignatureChangeEvent{
    return { type: MidiEventType.KEY_SIGNATURE_CHANGE, shift, minor, delta };
}

export function createTimeSignatureChangeEvent(sig: TimeSignature, delta: number): TimeSignatureChangeEvent{
    return { type: MidiEventType.TIME_SIGNATURE_CHANGE, delta, sig };
}

export function eventToString(e: MidiEvent, useNum: boolean = false){
    let note = '';
    const n: string[] = useNum ? toneNum : toneName;
    switch (e.type){
        case MidiEventType.NOTEON: 
            return `NoteOn(channel = ${e.channel}, delta = ${e.delta}, note = ${n[Note.getTone(e.note)]}-${Note.getOctave(e.note)}, velocity = ${e.velocity})`;
        case MidiEventType.NOTEOFF:
            return `NoteOff(channel = ${e.channel}, delta = ${e.delta}, note = ${n[Note.getTone(e.note)]}-${Note.getOctave(e.note)}, velocity = ${e.velocity})`;
        case MidiEventType.TEMPO_CHANGE:
            return `TempoChange(delta = ${e.delta}, tempo = ${e.tempo})`;
        case MidiEventType.KEY_SIGNATURE_CHANGE:
            return `KeySignatureChange(delta = ${e.delta}, shift = ${e.shift}, minor = ${e.minor})`;
        case MidiEventType.TIME_SIGNATURE_CHANGE:
            return `TimeSignatureChange(delta = ${e.delta}, sig = ${e.sig.numerator} / ${e.sig.denominator})`;
        default:
            throw new Error('unreachable');
    }
}

export interface Track {
    name: string;
    instrument: number;
    volume: number;
    events: MidiEvent[];
};

export interface TimeSignature {
    numerator: number;
    denominator: number;
};

export interface Metronome {
    clocks: number; // number of MIDI clocks between two metronome click, 
    n32: number; // while there are `n32' number of 32th notes in 24 MIDI clocks.
};

export interface MidiEventQueue {
    poll(): MidiEvent;
};

export function pollAllEvents(queue: MidiEventQueue): MidiEvent[]{
    let events: MidiEvent[] = [];
    let event = queue.poll();
    while (event){
        events.push(event);
        event = queue.poll();
    }
    return events;
}

function copyEvent(e: MidiEvent): MidiEvent {
    let ret: any = {};
    for (let p in e){
        if (p.hasOwnProperty(p)){
            ret[p] = e[p];
        }
    }
    return ret;
}

function mergeTracks(tracks: Track[]): MidiEventQueue {
    interface TrackItem {
        track: Track;
        e: MidiEvent;
        i: number;
    };
    let list: List<TrackItem> = new List();
    let lastDelta = 0;
    for (let track of tracks){
        if (track.events.length){
            list.add({ track, i: 0, e: copyEvent(track.events[0]) });
        }
    }

    function poll(): MidiEvent {
        let first = list.head;
        if (first){
            first.data.e.delta -= lastDelta;
            for (let n = first.next; n; n = n.next){
                n.data.e.delta -= lastDelta;
                if (first.data.e.delta > n.data.e.delta){
                    first = n;
                }
            }
            let d = first.data;
            let ret = d.e;
            if (d.i < d.track.events.length){
                d.e = d.track.events[d.i++];
            }
            else {
                list.remove(first);
            }
            lastDelta = ret.delta;
            return ret;
        }
        else
            return null;
    }

    return { poll };
}

interface IMidiInterface {
    setInstrument(i: number, channel: number): any;
    noteOn(note: number, velocity: number, channel: number): any;
    noteOff(note: number, velocity: number, channel: number): any;
    setTimeout(cb: () => any, ms: number): any;
    clearTimeout(): any;
};

export class MidiFile {
    keysig: number = 0; /* [0, 11] */
    timesig: TimeSignature = { numerator: 4, denominator: 4 };
    metronome: Metronome = { clocks: 24, n32: 8 };
    minor: boolean = false;
    division: number = Note.DEFLEN;
    startTempo: number = 500000;// bpm = 120
    tracks: Track[] = [];
    format: 0 | 1 | 2 = 1;

    dump(useNum: boolean = false): string[] {
        let ret: string[] = [`MidiFile(keysig = ${this.keysig}, division = ${this.division}, tempo = ${this.startTempo}){`];
        for (let track of this.tracks){
            ret.push(`    Track(name = "${track.name}", instrument = ${track.instrument}){`);
            for (let event of track.events){
                ret.push('        ' + eventToString(event, useNum));
            }
            ret.push('    }');
        }
        ret.push('}');
        return ret;
    }
    isEmpty(){
        return this.tracks.length === 0;
    }
};

export class MidiPlayer {
    private _flattenEvents: MidiEvent[];
    private _stopped = false;
    private _ptr = 0;
    private _tickLen: number;
    private _it: IMidiInterface;
    private _donecb: () => any;

    constructor(public file: MidiFile){
        this._flattenEvents = pollAllEvents(mergeTracks(file.tracks));
    }
    private _playOne(e: MidiEvent){
        switch (e.type){
            case MidiEventType.NOTEON:
                this._it.noteOn(e.note, e.velocity, e.channel);
                break;
            case MidiEventType.NOTEOFF:
                this._it.noteOff(e.note, e.velocity, e.channel);
                break;
            case MidiEventType.TEMPO_CHANGE:
                this._tickLen = Math.round(e.tempo / this.file.division);
                break;
        }
    }
    play(it: IMidiInterface, done: () => any = null){
        this._tickLen = Math.round(this.file.startTempo / this.file.division);
        this._ptr = 0;
        this._donecb = done;
        for (let i = 0, _a = this.file.tracks; i < _a.length; i++){
            it.setInstrument(_a[i].instrument, i);
        }
        this.resume();
    }
    resume(){
        this._stopped = false;
        let first = true;
        let cb = () => {
            if (first)
                first = false;
            else
                this._playOne(this._flattenEvents[this._ptr++]);
            while (this._ptr < this._flattenEvents.length && this._flattenEvents[this._ptr].delta === 0){
                this._playOne(this._flattenEvents[this._ptr++]);
            }
            if (this._ptr < this._flattenEvents.length){
                setTimeout(cb, this._tickLen * this._flattenEvents[this._ptr].delta);
            }
            else {
                this._ptr = 0;
                this._donecb && this._donecb();
            }
        };
        cb();
    }
};