import { Token, Position, TokenType, ITokenSource } from "./Token";

interface ISource {
    next(): string;
    peek(): string;
}

const regWhiteSpace = /[ \t\r\n]/;
const regName = /[a-zA-Z0-9$_]/;
const regDigit = /[0-9]/;

class Scanner implements ITokenSource {
    pos: Position = new Position(1, 1);
    _tk: Token = null;
    constructor(private _source: ISource){}
    reset(s: ISource = null){
        this.pos.reset();
        this._tk = null;
        if (s !== null){
            this._source = s;
        }
    }
    private _next(){
        let c = this._source.next();
        // read '\r', '\n', '\r\n' all as '\n'
        if (c === '\r'){
            this._source.peek() === '\n' && this._source.next();
            return '\n';
        }
        return c;
    }
    private _consume(c: string){
        if (c === '\n')
            this.pos.newline();
        else {
            this.pos.forward();
            c.charCodeAt(0) >= 0x7f && this.pos.forward();
        }
    }
    private _isLetter(c: string){
        return regName.test(c);
    }
    nextToken(): Token{
        if (this._tk === null){
            return this._scanToken();
        }
        else {
            let tk = this._tk;
            this._tk = null;
            return tk;
        }
    }
    peekToken(): Token{
        return this._tk === null ? this._tk = this._scanToken() : this._tk;
    }
    private _scanToken(): Token{
        let c = this._next();
        let noWhiteSpace = false, hasWhiteSpace = false;
        do {
            if (regWhiteSpace.test(c)){
                hasWhiteSpace = true;
                while (regWhiteSpace.test(c)){
                    this._consume(c);
                    c = this._next();
                }
            }
            else if (c === '%'){
                this._consume(c);
                c = this._next();
                hasWhiteSpace = true;
                while (c !== null && c !== '\n'){
                    this._consume(c);
                    c = this._next();
                }
            }
            else
                noWhiteSpace = true;
        } while(!noWhiteSpace);

        let cur = this.pos.clone();
        if (c === null){
            return new Token(TokenType.EOF, null, cur, this.pos.clone(), hasWhiteSpace);
        }
        if (c === '\\'){
            this._consume(c);
            if (this._isLetter(this._source.peek())){
                let name = '\\' + this._source.next();
                this._consume(c);
                while(this._isLetter(c = this._source.peek()) && c !== null){
                    this._consume(c);
                    name += this._next();
                }
                return new Token(TokenType.MACRO, name, cur, this.pos.clone(), hasWhiteSpace);
            }
            else {
                return new Token(TokenType.OTHER, c, cur, this.pos.clone(), hasWhiteSpace);
            }
        }
        else if (c === '#'){
            this._consume(c);
            if (regDigit.test(this._source.peek())){
                c = this._source.next();
                this._consume(c);
                return new Token(TokenType.MACRO_PARAM, null, cur, this.pos.clone(), hasWhiteSpace, Number(c));
            }
            else
                return new Token(TokenType.OTHER, c, cur, this.pos.clone(), hasWhiteSpace);
        }
        else {
            this._consume(c);
            let type: TokenType;
            switch (c.charAt(0)){
                case '{': type = TokenType.BGROUP; break;
                case '}': type = TokenType.EGROUP; break;
                default: type = TokenType.OTHER;
            }
            return new Token(type, c, cur, this.pos.clone(), hasWhiteSpace);
        }
    }
}

export { Scanner, ISource }