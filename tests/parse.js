var main = require('../');
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
        var ret = parser.parseAndConvert(scanner);
        var out = [];
        if (reporter.msgs.length){
            reporter.forEach(msg => out.push(msg.msg));
        }
        else {
            for (var note of ret){
                out.push(main.eventToString(note, true));
            }
        }
        return out;
    }
}

var ctx = createContext();
class Tester {
    constructor(){
        this.channel = 0;
        this.velocity = 80;
        this.out = [];
    }
    noteOn(noteText, delta){
        delta = (delta * Note.DEFLEN) | 0;
        this.out.push(`NoteOn(channel = ${this.channel}, delta = ${delta}, note = ${noteText}, velocity = ${this.velocity})`);
    }
    noteOff(noteText, delta){
        delta = (delta * Note.DEFLEN) | 0;
        this.out.push(`NoteOff(channel = ${this.channel}, delta = ${delta}, note = ${noteText}, velocity = ${this.velocity})`);
    }
    tempo(tempo, delta){
        delta = (delta * Note.DEFLEN) | 0;
        this.out.push(`TempoChange(channel = ${this.channel}, delta = ${delta}, tempo = ${this.tempo})`);
    }
    raw(text){
        this.out.push(text);
    }
    end(out){
        assert.deepStrictEqual(out, this.out);
    }
};
function test(dest, input, expectFunc){
    it(dest, function(){
        var t = new Tester();
        expectFunc(t);
        t.end(ctx.run(input));
    });
}

describe('Sequencing with numbered musical notation', function(){
    this.timeout(200);
    test('Empty input', '{}  {}#---- {{}{}-}__', t => {});
    test('Basic one-voice sequence', '1231', t => {
        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1);
        t.noteOn ('2-4', 0);
        t.noteOff('2-4', 1);
        t.noteOn ('3-4', 0);
        t.noteOff('3-4', 1);
        t.noteOn ('1-4', 0);
        t.noteOff('1-4', 1);
    });
    test('Simple chorus', '{1|3|5-}23', t => {
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
    });
    test('Note modifiers', '1*5._ 1*3_ 5*6_ 5-', t => {
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
        t.noteOff('5-4', 2);
    });
});