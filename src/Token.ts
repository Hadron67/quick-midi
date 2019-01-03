class Position {
    constructor(public line: number, public column: number){}
    reset(){
        this.line = this.column = 1;
    }
    forward(){
        this.column++;
    }
    newline(){
        this.line++;
        this.column = 1;
    }
    clone(){
        return new Position(this.line, this.column);
    }
}

class Range {
    constructor(public start: Position, public end: Position){}
    reset(){
        this.start.reset();
        this.end.reset();
    }
    static here(h: Position): Range{
        return new Range(h, new Position(h.line, h.column + 1));
    }
    static between(p1: Range, p2: Range){
        return new Range(p1.start, p2.end);
    }
}

enum TokenType {
    EOF = 1,
    SPACE,
    MACRO,
    MACRO_PARAM,
    BGROUP,
    EGROUP,
    OTHER
}

class Token extends Range {
    constructor(
        public type: TokenType,
        public text: string, 
        start: Position,
        end: Position,
        public hasWhiteSpace: boolean,
        public val: number = null
    ){
        super(start, end);
    }
    getText(){
        let t = this.text === null ? '' : this.text;
        return this.hasWhiteSpace ? ' ' + t : t;
    }
    isEOF(){
        return this.type === TokenType.EOF;
    }
}

interface ITokenSource {
    nextToken(): Token;
    peekToken(): Token;
}

export interface SourceLines {
    getLine(line: number): string;
};

/*
         
         1|
    ---> 2|
         3|
         
*/

function repeat(s: string, t: number){
    let r = '';
    while (t --> 0) r += s;
    return r;
}

export function markLines(lines: SourceLines, range: Range, marker: string = '^', space: string = ' '): string[]{
    let ret: string[] = [];
    if (range.start.line === range.end.line){
        ret.push(lines.getLine(range.start.line));
        let s = repeat(space, range.start.column - 1) + repeat(marker, range.end.column - range.start.column);
        ret.push(s);
    }
    else {
        let l = lines.getLine(range.start.line);
        ret.push(l);
        ret.push(repeat(space, range.start.column - 1) + repeat(marker, l.length - range.start.column));
        for (let i = range.start.line + 1; i < range.end.line - 1; i++){
            ret.push(l = lines.getLine(i));
            ret.push(repeat(marker, l.length));
        }
        l = lines.getLine(range.end.line);
        ret.push(l);
        ret.push(repeat(marker, range.end.column));
    }
    return ret;
}


export { Token, Position, Range, TokenType, ITokenSource }