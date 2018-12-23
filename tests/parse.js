var main = require('../');
var s = "{1--|1.5.-----{2|4|6}-}7.";
var i = 0;
var reporter = new main.ErrorReporter();
var scanner = new main.Scanner({
    next: () => i >= s.length ? null : s.charAt(i++),
    peek: () => i >= s.length ? null : s.charAt(i)
});
scanner.macroParamChar = '$';

var parser = main.createParser(reporter);
var ret = parser.parse(scanner);

if (reporter.msgs.length){
    for (let msg of reporter.msgs){
        console.log(msg.msg);
    }
}
else {
    var queue = main.createNoteQueue(ret);
    var note;
    while ((note = queue.pollNote()) !== null){
        console.log(main.eventToString(note, true));
    }
}