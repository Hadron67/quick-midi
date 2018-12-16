/*
    Number representation of notes:

  octave|note C  C#  D  D#  E  F  F#  G  G#  A  A#  B
     -1 |     1
      0 |
      1 |     
      2 |     
      3 |     
      4 |     
      5 |     
      6 |     
      7 |     
      8 |     
      9 |                                           132
    and 0 for stop

    Number representation of durations:

    128: ----
    64 : --
    32 : -
    16 :
    8  : _
    4  : _ _
    2  : _ _ _
    1  : _ _ _ _
*/
const toneName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const toneNum =  ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];

class Note {
    notes: number[] = [];
    duration: number = 16;
    toString(useNum: boolean = false){
        let note = '';
        const n: string[] = useNum ? toneNum : toneName;
        if (this.notes.length === 1){
        }
    }
    static getTone(note: number){ return note % 12; }
    static getOctave(note: number){  }
}

function Sequence(){

}