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

    256: ----
    128: --
    64 : -
    32 :
    16 : _
    8  : _ _
    4  : _ _ _
    2  : _ _ _ _
    that is, 1 = length of 64th note
*/
const toneName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const toneNum =  ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];
const numToNote = [0, 2, 4, 5, 7, 9, 11];

export class Note {
    duration: number = 32;
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
        return this.note === 132;
    }
    toEvent(delta: number, channel: number): NoteEvent{
        return { delta, channel, velocity: this.velocity, note: this.note, duration: this.duration };
    }
    static getTone(note: number){ return note % 12; }
    static getOctave(note: number){ return (note / 12 | 0) - 1; }
    static numberToNote(n: number, octave: number){ return n === 0 ? 132 : numToNote[n - 1] + 12 * (octave + 1); }
}

export interface NoteEvent {
    delta: number;
    channel: number;
    note: number;
    duration: number;
    velocity: number;
};

export function eventToString(e: NoteEvent, useNum: boolean = false){
    let note = '';
    const n: string[] = useNum ? toneNum : toneName;
    return `< ${n[Note.getTone(e.note)]} ${Note.getOctave(e.note)}, ${e.delta}, ${e.duration} >`;
}