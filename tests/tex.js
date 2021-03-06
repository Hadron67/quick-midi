'use strict';

var assert = require('assert');
var main = require("../").debug;

function createContext(){
    var s = '';
    var i = 0;
    var scanner = new main.Scanner({
        next: () => i >= s.length ? null : s.charAt(i++),
        peek: () => i >= s.length ? null : s.charAt(i)
    });
    var reporter = new main.ErrorReporter();
    var expander = new main.MacroExpander(reporter, scanner);
    expander.macros.defineInternalMacros();

    return { run };

    function run(input){
        s = input;
        i = 0;
        reporter.reset();
        scanner.reset();
        expander.init(scanner);
        var out = [];
        var t = expander.nextToken();
        var expanded = '';
        while (!t.isEOF()){
            expanded += t.getText();
            t = expander.nextToken();
        }
        expanded += t.getText();
        if (reporter.msgs.length){
            reporter.forEach(msg => out.push(msg.msg + ` (${msg.range.start.line}, ${msg.range.start.column})-(${msg.range.end.line}, ${msg.range.end.column})`));
        }
        else {
            out = [expanded];
        }

        return out;
    }
}

var ctx = createContext();
function testExpand(desc, input, expect){
    it(desc, function(){
        assert.deepStrictEqual(ctx.run(input), expect);
    });
}
describe("Expanding macros", function(){
    testExpand('Defining and expanding macros that has no parameter', 
        "\\def\\hkm{soor} \\hkm", 
        [" soor"]
    );
    testExpand('Nested macro expansion', 
        "\\def\\A{\\B, soor} \\def\\B{hkm} \\A", 
        [" hkm, soor"]
    );
    testExpand('Endless nested macro', "\\def\\hkm{\\hkm}\\hkm", ["Maximum nested macro expansion (100) exceeded (1, 10)-(1, 14)"]);
    testExpand('Scoped macro definition (1)', 
        "\\def\\A{1} { \\def\\A{2} \\A } \\A", 
        [" { 2 } 1"]
    );
    testExpand('Scoped macro definition (2)', 
        "{\\def\\A{123}} \\A", 
        ["Undefined control sequence \\A (1, 15)-(1, 17)"]
    );
    testExpand('Defining macros with format (1)', 
        "\\def\\plus#1+#2{ #1 plus #2 } \\plus 5 + 6", 
        [" 5 plus 6"]
    );
    testExpand('Defining macros with format (2)', 
        "\\def\\formattest.#1.{ Input is #1 } \\formattest .anything but.",
        [" Input is anything but"]
    );
    testExpand('Defining macros with format (3)',
        "\\def\\hkm#1.#2{} \\hkm.{456}",
        ["Use of macro \\hkm that doesn't match its definition (1, 21)-(1, 22)"]    
    );
    testExpand('Removing comments', "hkm % this will not apear in the output", ["hkm "]);
    testExpand('A problem', '\\def\\repeat#1#2{#1#2#1#1} \\repeat{1}{2}', [' {1}{2}{1}{1}']);
    testExpand('Expanding groups', '\\def\\h{{123}} \\h', [' {123}']);
    testExpand('Whitespaces', '\\def\\hkm#1#2{#1, soor #1, unsoor #2}\\hkm 1 2', ['1, soor 1, unsoor 2']);
});