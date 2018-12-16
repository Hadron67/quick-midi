import {Position, Range} from './Token';

interface DiagnosisMsg {
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
}

export { ErrorReporter }