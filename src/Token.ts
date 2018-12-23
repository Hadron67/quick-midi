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
}

interface ITokenSource {
    nextToken(): Token;
    peekToken(): Token;
}

export { Token, Position, Range, TokenType, ITokenSource }