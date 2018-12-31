import { ISource } from './Scanner';
import { DiagnosisMsg } from './ErrorReporter';
import { ErrorReporter } from './ErrorReporter';
import { createParser } from './Parser';
import { Scanner } from './Scanner';

import * as debug from './debug';
import { MidiFile } from './Sequence';
export { debug };
export { saveMidiFile } from './io';

export interface Context {
    parse(input: ISource | string): MidiFile;
    getErrors(): DiagnosisMsg[];
};

export function createContext(): Context{
    let eReporter = new ErrorReporter();
    let scanner = new Scanner();
    let parser = createParser(eReporter);

    return {
        parse, getErrors
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
        return parser.parse(scanner);
    }
    function getErrors(): DiagnosisMsg[] {
        return eReporter.msgs;
    };
}