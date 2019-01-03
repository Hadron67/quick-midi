'use strict';
const qmidi = require('../');
const pkg = require('../package.json');
const fs = require('fs');

const usage = 
`Usage: ${pkg.name} <input> [options]
    Or  ${pkg.name} -f <input file> [options]

Options:
    -o <output file>      Specify output file, default is a.mid;
    -d                    Dump MIDI file (events) to terminal;
    -h, --help            Display this help message and quit.
`;

function readFile(fname, encoding){
    return new Promise((acc, rej) => {
        fs.readFile(fname, (err, data) => {
            err ? rej(err) : acc(data.toString(encoding));
        });
    });
}

function writeFile(fname, data){
    return new Promise((acc, rej) => {
        fs.writeFile(fname, data, err => {
            err ? rej() : acc();
        });
    });
}

function parseArgs(args){
    var opts = { input: null, isFile: false, outFile: 'a.mid', needHelp: false, errMsg: null, dump: false };
    var outFileSet = false;
    
    if (args.length < 1){
        opts.errMsg = 'Missing input.';
        return opts;
    }
    if (args[0] === '-f'){
        args.shift();
        if (args.length < 1){
            opts.errMsg = 'Missing input file.';
            return opts;
        }
        opts.input = args.shift();
        opts.isFile = true;
    }
    else 
        opts.input = args.shift();

    while (args.length){
        switch (args[0]){
            case '-h':
            case '--help':
                args.shift();
                opts.needHelp = true;
                break;
            case '-o':
                args.shift();
                if (args.length < 1){
                    opts.errMsg = '-o option requires one argument.';
                    return opts;
                }
                else if (outFileSet){
                    opts.errMsg = 'Multiple -o options.';
                    return opts;
                }
                else {
                    opts.outFile = args.shift();
                }
                break;
            case '-d':
                args.shift();
                opts.dump = true;
        }
    }
    return opts;
}

function printErrMsg(lines, msg){
    console.log(msg.msg);

}

async function main(args){
    var opt = parseArgs(args);
    if (opt.errMsg){
        console.log(opt.errMsg);
        console.log(`Try ${pkg.name} --help for help.`);
        return -1;
    }
    if (opt.needHelp) {
        console.log(usage);
        return 0;
    }
    var ctx = qmidi.createContext();
    var input = opt.isFile ? await readFile(opt.input, 'utf-8') : opt.input;
    var lines = input.split(/\n|\r\n|\r/);
    var midiFile = ctx.parse(input);
    var errors = ctx.getErrors();
    if (ctx.hasError()){
        for (var e of ctx.getPrintedErrors({ getLine: i => lines[i - 1] })){
            console.log(e);
        }
        return -1;
    }
    else {
        if (opt.dump){
            for (var line of midiFile.dump(true)){
                console.log(line);
            }
        }
        if (midiFile.isEmpty()){
            console.log('Warning: creating empty MIDI file.');
        }
        var midiData = qmidi.saveMidiFile(midiFile);
        await writeFile(opt.outFile, Buffer.from(midiData));
        return 0;
    }
}

module.exports = function(args){
    main(args)
    .then(e => process.exit(e))
    .catch(e => {
        console.error(e);
        process.exit(-1);
    });
}