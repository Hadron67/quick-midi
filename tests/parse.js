var main = require('../');
var s = "{12{34}_}-";
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
    for (var msg of main.dumpNoteList(ret)){
        console.log(msg);
    }
}