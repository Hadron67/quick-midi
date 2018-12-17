var main = require("../index");
var s = '\\def\\hkm #1 + #2. { #1 plus #2 \\soor } \\def\\soor{rfnj}\\hkm 9+85.', i = 0;

var scanner = new main.Scanner({
    next: () => i >= s.length ? null : s.charAt(i++),
    peek: () => i >= s.length ? null : s.charAt(i)
});
var reporter = new main.ErrorReporter();
var expander = new main.MacroExpander(reporter, scanner);
expander.macros.defineInternalMacros();
var out = '';
var t = expander.nextToken();
while (t.type !== 1){
    out += t.getText();
    t = expander.nextToken();
}
out += t.getText() + '%';
if (reporter.msgs.length){
    for (let msg of reporter.msgs){
        console.log(msg.msg);
    }
}
console.log(out);