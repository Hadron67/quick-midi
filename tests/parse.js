var main = require('../').debug;
var assert = require('assert');
var Note = main.Note;

function createContext(){
    var s;
    var i = 0;
    var reporter = new main.ErrorReporter();
    var scanner = new main.Scanner({
        next: () => i >= s.length ? null : s.charAt(i++),
        peek: () => i >= s.length ? null : s.charAt(i)
    });
    scanner.macroParamChar = '$';

    var parser = main.createParser(reporter);

    return { run };

    function run(input){
        s = input;
        i = 0;
        reporter.reset();
        var ret = parser.parse(scanner);
        var out;
        if (reporter.msgs.length){
            out = [];
            reporter.forEach(msg => out.push(msg.msg));
        }
        else {
            out = ret.dump(true);
        }
        return out;
    }
}

var ctx = createContext();
class Tester {
    constructor(){
        this.channel = 0;
        this.velocity = 80;
        this.div = 96;
        this.out = [];

        this._indents = 0;
        this._posts = [];
    }
    _indent(){
        return ' '.repeat(this._indents << 2);
    }
    beginFile(keysig, division, tempo){
        this.out.push(`${this._indent()}MidiFile(keysig = ${keysig}, division = ${division}, tempo = ${tempo}){`);
        this._indents++;
    }
    beginTrack(name, instrument){
        this.out.push(`${this._indent()}Track(name = "${name}", instrument = ${instrument}){`);
        this._indents++;
    }
    end(){
        this._indents--;
        this.out.push(`${this._indent()}}`);
    }
    noteOn(noteText, delta){
        delta = (delta * this.div) | 0;
        this.out.push(`${this._indent()}NoteOn(channel = ${this.channel}, delta = ${delta}, note = ${noteText}, velocity = ${this.velocity})`);
    }
    noteOff(noteText, delta){
        delta = (delta * this.div) | 0;
        this.out.push(`${this._indent()}NoteOff(channel = ${this.channel}, delta = ${delta}, note = ${noteText}, velocity = ${this.velocity})`);
    }
    tempo(tempo, delta){
        delta = (delta * this.div) | 0;
        this.out.push(`${this._indent()}TempoChange(delta = ${delta}, tempo = ${tempo})`);
    }
    keySignatureChange(shift, minor, delta){
        delta = (delta * this.div) | 0;
        this.out.push(`${this._indent()}KeySignatureChange(delta = ${delta}, shift = ${shift}, minor = ${minor})`);
    }
    timeSignatureChange(n, d, delta){
        delta = (delta * this.div) | 0;
        this.out.push(`${this._indent()}TimeSignatureChange(delta = ${delta}, sig = ${n} / ${d})`);
    }
    raw(text){
        this.out.push(this._indent() + text);
    }
    check(out){
        assert.deepStrictEqual(out, this.out);
    }
    post(cb){
        this._posts.push(cb);
    }
};
function test(dest, input, expectFunc){
    it(dest, function(){
        var t = new Tester();
        expectFunc(t);
        t.check(ctx.run(input));
    });
}

describe('Sequencing with numbered musical notation', function(){
    this.timeout(200);
    var deftempo = 500000;
    function note(t, n, delta){
        t.noteOn (n, 0);
        t.noteOff(n, delta);
    }
    test('Empty input', '{}  {}#---- {{}{}-}__', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.end();
    });
    test('Basic one-voice sequence', '1231', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1);
        t.noteOn ('2-4', 0);
        t.noteOff('2-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);
        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1);

        t.end();
        t.end();
    });
    test('Simple chorus', '{1,3,5-}23', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.noteOn ('1-4', 0);
        t.noteOn ('3-4', 0);
        t.noteOn ('5-4', 0);
        t.noteOff('1-4', 1);
        t.noteOff('3-4', 0);
        t.noteOff('5-4', 1);

        t.noteOn ('2-4', 0);
        t.noteOff('2-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);

        t.end();
        t.end();
    });
    test('Note modifiers', '1*5._ 1*3_ 5*6_ 5--- 4#*2_', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1.5);
        t.noteOn ('5-3', 0);
        t.noteOff('5-3', 0.5);

        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1.5);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 0.5);

        t.noteOn ('5-4', 0);
        t.noteOff('5-4', 1.5);
        t.noteOn ('6-4', 0);
        t.noteOff('6-4', 0.5);

        t.noteOn ('5-4', 0);
        t.noteOff('5-4', 4);

        t.noteOn ('4#-4', 0);
        t.noteOff('4#-4', 1.5);
        t.noteOn ('2-4', 0);
        t.noteOff('2-4', 0.5);

        t.end();
        t.end();
    });
    test('Rest notes', '{05.13,005-}', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);
        
        t.noteOn ('5-3', 1);
        t.noteOn ('5-4', 1);
        t.noteOff('5-3', 0);
        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('5-4', 1);
        t.noteOff('3-4', 0);
        
        t.end();
        t.end();
    });
    test('Merge overlapped notes', '333 {1---,0100} {3-,03--}', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);
        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 4);

        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 4);

        t.end();
        t.end();
    });
    test('Voices', `
    \\v{1} 123
    \\v{2} 1.5.3.
    `, t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.noteOn ('1-4', 0);
        t.noteOn ('1-3', 0);
        t.noteOff('1-4', 1);
        t.noteOff('1-3', 0);
        t.noteOn ('2-4', 0);
        t.noteOn ('5-3', 0);
        t.noteOff('2-4', 1);
        t.noteOff('5-3', 0);
        t.noteOn ('3-4', 0);
        t.noteOn ('3-3', 0);
        t.noteOff('3-4', 1);
        t.noteOff('3-3', 0);

        t.end();
        t.end();
    });
    test('Tracks', `
        \\tempo{1000}
        \\track{Piano1}\\instrument{2} 1'7654321
        \\track{Piano2}\\instrument{2} 0 01'7654321
        \\track{Piano3}\\instrument{2} 0 00 01'7654321
    `, t => {
        function note(n){
            t.noteOn (n, 0);
            t.noteOff(n, 1);
        }
        function oneTrack(delay){
            t.noteOn ('1-5', delay);
            t.noteOff('1-5', 1);
            note('7-4');
            note('6-4');
            note('5-4');
            note('4-4');
            note('3-4');
            note('2-4');
            note('1-4');
        }
        t.beginFile(0, Note.DEFLEN, 1000);

        t.beginTrack('Piano1', 2);
        t.channel = 0;
        oneTrack(0);
        t.end();

        t.beginTrack('Piano2', 2);
        t.channel = 1;
        oneTrack(2);
        t.end();

        t.beginTrack('Piano3', 2);
        t.channel = 2;
        oneTrack(4);
        t.end();

        t.end();
    });

    test('Key signature changes', '\\major{F} 12315', t =>{
        t.beginFile(5, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        note(t, '4-4', 1);
        note(t, '5-4', 1);
        note(t, '6-4', 1);
        note(t, '4-4', 1);
        note(t, '1-5', 1);
        
        t.end();
        t.end();
    });
    test('Key signature scoped changes', '\\major{G} {\\major{C} 123}1', t => {
        t.beginFile(7, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        t.keySignatureChange(0, false, 0);
        note(t, '1-4', 1);
        note(t, '2-4', 1);
        note(t, '3-4', 1);
        note(t, '5-4', 1);
        
        t.end();
        t.end();
    });
    test('Change tempo', '123 \\tempo{240} 45', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        note(t, '1-4', 1);
        note(t, '2-4', 1);
        note(t, '3-4', 1);
        t.tempo(240, 0);
        note(t, '4-4', 1);
        note(t, '5-4', 1);
        
        t.end();
        t.end();
    });
    test('Change velocity', '1 \\vel{100} 2 \\vel{120} 3 {\\vel{80} 4 } 5', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        note(t, '1-4', 1);
        t.velocity = 100;
        note(t, '2-4', 1);
        t.velocity = 120;
        note(t, '3-4', 1);
        t.velocity = 80;
        note(t, '4-4', 1);
        t.velocity = 120;
        note(t, '5-4', 1);
        
        t.end();
        t.end();
    });
    test('Change time signature', '\\times34 1231 \\times68 {1231 3453}_', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        note(t, '1-4', 1);
        note(t, '2-4', 1);
        note(t, '3-4', 1);
        note(t, '1-4', 1);
        t.timeSignatureChange(6, 8, 0);
        note(t, '1-4', 0.5);
        note(t, '2-4', 0.5);
        note(t, '3-4', 0.5);
        note(t, '1-4', 0.5);
        note(t, '3-4', 0.5);
        note(t, '4-4', 0.5);
        note(t, '5-4', 0.5);
        note(t, '3-4', 0.5);
        
        t.end();
        t.end();
    });
    test('Change division', '\\div{192} 1231', t => {
        t.beginFile(0, 192, deftempo);
        t.beginTrack('Track 1', 0);

        t.div = 192;
        note(t, '1-4', 1);
        note(t, '2-4', 1);
        note(t, '3-4', 1);
        note(t, '1-4', 1);
        
        t.end();
        t.end();
    });
    test('3-tuples', '{666}.//', t => {
        t.beginFile(0, Note.DEFLEN, deftempo);
        t.beginTrack('Track 1', 0);

        note(t, '6-3', 1 / 3);
        note(t, '6-3', 1 / 3);
        note(t, '6-3', 1 / 3);
        
        t.end();
        t.end();
    });
});