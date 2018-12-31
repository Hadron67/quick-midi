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
    duration: number = Note.DEFLEN;
    velocity: number = 0; // not used at present
    constructor(public note: number){}
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
    NOTEON, NOTEOFF, TEMPO_CHANGE
};

export interface MidiEventBase {
    type: MidiEventType;
    delta: number;
    channel: number;
};

export interface NoteOnEvent extends MidiEventBase {
    type: MidiEventType.NOTEON;
    note: number;
    velocity: number;
};

export interface NoteOffEvent extends MidiEventBase {
    type: MidiEventType.NOTEOFF;
    note: number;
    velocity: number;
};

export interface TempoChangeEvent extends MidiEventBase {
    type: MidiEventType.TEMPO_CHANGE;
    tempo: number;
};

export type MidiEvent = NoteOnEvent | NoteOffEvent | TempoChangeEvent;

export function createNoteOnEvent(note: number, delta: number, channel: number, velocity: number): NoteOnEvent{
    return { type: MidiEventType.NOTEON, delta, note, channel, velocity };
}

export function createNoteOffEvent(note: number, delta: number, channel: number, velocity: number): NoteOffEvent{
    return { type: MidiEventType.NOTEOFF, delta, note, channel, velocity };
}

export function createTempoChangeEvent(tempo: number, delta: number, channel: number): TempoChangeEvent{
    return { type: MidiEventType.TEMPO_CHANGE, tempo, delta, channel };
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
            return `TempoChange(channel = ${e.channel}, delta = ${e.delta}, tempo = ${e.tempo})`;
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

interface TimeSignature {
    numerator: number;
    denominator: number;
};

interface Metronome {
    clocks: number; // number of MIDI clocks between two metronome click, 
    n32: number; // while there are `n32' number of 32th notes in 24 MIDI clocks.
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
};