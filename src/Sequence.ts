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
    and 0 for stop

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

class Note {
    duration: number = 16;
    constructor(public note: number){}
    toString(useNum: boolean = false){
        let note = '';
        const n: string[] = useNum ? toneNum : toneName;
        return `< ${n[Note.getTone(this.note)]}, ${this.duration} >`;
    }
    static getTone(note: number){ return note % 12; }
    static getOctave(note: number){ return (note / 12 | 0) - 1; }
}

interface Event {
    notes: Note[];
    gap: number;// time gap to the previous event, in units of 64th note
};

class Channel {

};

export { Note }