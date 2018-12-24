var main = require('../');
var assert = require('assert');

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
function test(dest, input, expect){
    it(dest, function(){
        assert.deepStrictEqual(ctx.run(input), expect);
    });
}

describe('Sequencing with numbered musical notation', function(){
    test('Empty input', '  {} {{}{}} {}*# {}__ {}---', []);
    test('Basic one-voice sequence', 
        '1231 {5654}_31',
        [
            '< 1 4, 0, 32 >',
            '< 2 4, 32, 32 >',
            '< 3 4, 64, 32 >',
            '< 1 4, 96, 32 >',

            '< 5 4, 128, 16 >',
            '< 6 4, 144, 16 >',
            '< 5 4, 160, 16 >',
            '< 4 4, 176, 16 >',
            '< 3 4, 192, 32 >',
            '< 1 4, 224, 32 >'
        ]    
    );
    test('Note modifiers (dot, sharp)',
        '1*5._ 4#*5_',
        [
            '< 1 4, 0, 48 >',
            '< 5 3, 48, 16 >',
            '< 4# 4, 64, 48 >',
            '< 5 4, 112, 16 >'
        ]
    );
    test('Merge notes that have overlap on the timeline',
        '{1-35|01--}',
        [
            '< 1 4, 0, 128 >',
            '< 3 4, 64, 32 >',
            '< 5 4, 96, 32 >'
        ]
    );
});