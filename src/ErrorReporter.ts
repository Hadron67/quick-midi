import {Position, Range} from './Token';

export interface DiagnosisMsg {
    msg: string;
    range: Range;
}

class ErrorReporter {
    msgs: DiagnosisMsg[] = [];
    constructor(){
    }
    reset(){
        this.msgs.length = 0;
    }
    complationError(msg: string, range: Range){
        this.msgs.push({msg, range});
    }
    forEach(cb: (msg: DiagnosisMsg) => any){
        for (let msg of this.msgs){
            cb(msg);
        }
    }
}

export { ErrorReporter }