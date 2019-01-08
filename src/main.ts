import { ISource } from './Scanner';
import { DiagnosisMsg } from './ErrorReporter';
import { ErrorReporter } from './ErrorReporter';
import { createParser } from './Parser';
import { Scanner } from './Scanner';
import { markLines, SourceLines } from './Token';

import * as debug from './debug';
import { MidiFile } from './Sequence';

export { debug };
export { saveMidiFile } from './io';
export { MidiPlayer } from './Sequence';

export interface Context {
    parse(input: ISource | string): MidiFile;
    getErrors(): DiagnosisMsg[];
    hasError(): boolean;
    getPrintedErrors(lines: SourceLines, marker?: string, space?: string): string[];
};

export function createContext(): Context{
    let eReporter = new ErrorReporter();
    let scanner = new Scanner();
    let parser = createParser(eReporter);
    let warns: string[] = [];

    scanner.macroParamChar = '$';

    return {
        parse, 
        getErrors,
        hasError: () => eReporter.msgs.length > 0,
        getPrintedErrors
    };

    function parse(input: ISource | string): MidiFile{
        if (typeof input === 'string'){
            let i = 0;
            scanner.reset({
                peek: () => i >= input.length ? null : input.charAt(i),
                next: () => i >= input.length ? null : input.charAt(i++),
            });
        }
        else {
            scanner.reset(input);
        }
        eReporter.reset();
        warns.length = 0;
        return parser.parse(scanner);
    }
    function getErrors(): DiagnosisMsg[] {
        return eReporter.msgs;
    };
    function getPrintedErrors(lines: SourceLines, marker: string = '^', space: string = ' '): string[] {
        let ret: string[] = [];
        for (let msg of eReporter.msgs){
            ret.push(`Error: ${msg.msg} (line ${msg.range.start.line})`);
            for (let line of markLines(lines, msg.range, marker, space)){
                ret.push(line);
            }
            ret.push('');
        }
        return ret;
    }
}