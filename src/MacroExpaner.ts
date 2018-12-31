import { Token, ITokenSource, TokenType } from './Token';
import { ErrorReporter } from './ErrorReporter';

interface Macro {
    name: string;
    isMeta: boolean;
    run(e: MacroExpander, token: Token): ITokenSource;
}

class TeXMacro implements Macro {
    name: string;
    fmt: Token[] = [];
    content: Token[] = null;
    isMeta = false;
    argCount: number = 0;
    constructor(public nameToken: Token){
        this.name = nameToken.text;
    }
    run(e: MacroExpander, macroToken: Token){
        let ret: Token[] = [], param: Token[][] = new Array(this.argCount);
        let t: Token;
        for (let i = 0, _a = this.fmt; i < _a.length; i++){
            let f = _a[i];
            if (f.type === TokenType.MACRO_PARAM){
                let selectedParam: Token[];
                if (i === _a.length - 1 || _a[i + 1].type === TokenType.MACRO_PARAM){
                    selectedParam = param[f.val] = e.readPossibleGroup(e.nextToken(false), false);
                }
                else {
                    let next = _a[i + 1];
                    selectedParam = param[f.val] = [];
                    t = e.peekToken(false);
                    if (t.type !== TokenType.EOF && t.text !== next.text) {
                        while(t.type !== TokenType.EOF && t.text !== next.text){
                            e.readPossibleGroup(e.nextToken(false), false, selectedParam);
                            t = e.peekToken(false);
                        }
                    }
                    else {
                        e.eReporter.complationError(`Use of macro ${this.name} that doesn't match its definition`, t);
                        e.nextToken(false);
                        return null;
                    }
                }
            }
            else {
                t = e.nextToken(false);
                if (t.type === TokenType.EOF){
                    e.eReporter.complationError(`Unexpected end of file: use of macro ${this.name} that doesn't match its definition`, t);
                    return null;
                }
                else if (f.text !== t.text){
                    e.eReporter.complationError(`Use of macro ${this.name} that doesn't match its definition`, t);
                    return null;
                }
            }
        }
        for (let tk of this.content){
            if (tk.type === TokenType.MACRO_PARAM){
                let selected = param[tk.val];
                if (selected.length >= 1)
                    selected[0].hasWhiteSpace = tk.hasWhiteSpace;
                for (let ptk of selected){
                    ret.push(ptk);
                }
            }
            else
                ret.push(tk);
        }
        if (ret.length >= 1){
            ret[0].hasWhiteSpace = ret[0].hasWhiteSpace || macroToken.hasWhiteSpace;
        }
        return new TokenArray(ret);
    }
}

type MacroMap = {[name: string]: Macro};

enum MacroType {
    SCOPE, GLOBAL, INTERNAL
};

class MacroSet {
    macroStack: MacroMap[] = [{}];
    internalMacros: MacroMap = {};
    getMacro(name: string): Macro{
        for (let _a = this.macroStack, i = _a.length - 1; i >= 0; i--){
            if (_a[i].hasOwnProperty(name))
                return _a[i][name];
        }
        if (this.internalMacros.hasOwnProperty(name))
            return this.internalMacros[name];
        return null;
    }
    reset(){
        this.macroStack = [{}];
    }
    defineMacro(m: Macro, type: MacroType){
        if (type === MacroType.SCOPE){
            this.macroStack[this.macroStack.length - 1][m.name] = m;
        }
        else if (type === MacroType.GLOBAL){
            this.macroStack[0][m.name] = m;
        }
        else if (type === MacroType.INTERNAL){
            this.internalMacros[m.name] = m;
        }
        return this;
    }
    define(name: string, run: (e: MacroExpander) => ITokenSource, type: MacroType){
        this.defineMacro({name, run, isMeta: false}, type);
        return this;
    }
    defineMeta(name: string){
        this.defineMacro({name, run: null, isMeta: true}, MacroType.INTERNAL);
        return this;
    }
    enterScope(){
        this.macroStack.push({});
        return this;
    }
    leaveScope(){
        this.macroStack.pop();
        return this;
    }
    isGlobal(){
        return this.macroStack.length === 0;
    }
    defineInternalMacros(){
        let cela = this;
        function def(e: MacroExpander, global: boolean): ITokenSource{
            let t = e.nextToken(false);
            if (t.type !== TokenType.MACRO){
                e.eReporter.complationError('Macro name expected', t);
                return null;
            }
            let macro = new TeXMacro(t);
            t = e.nextToken(false);
            while (t.type !== TokenType.BGROUP && t.type !== TokenType.EOF){
                if (t.type === TokenType.MACRO_PARAM){
                    if (t.val !== ++macro.argCount){
                        e.eReporter.complationError('Macro parameter number must be consecutive', t);
                    }
                    macro.fmt.push(t);
                }
                else
                    macro.fmt.push(t);
                t = e.nextToken(false);
            }
            if (t.type !== TokenType.BGROUP){
                e.eReporter.complationError('"{" expected', t);
                return null;
            }
            macro.content = e.readPossibleGroup(t, false);
            cela.defineMacro(macro, global ? MacroType.GLOBAL : MacroType.SCOPE);
            return null;
        }
        this.define('\\def', e => def(e, false), MacroType.INTERNAL);
        this.define('\\gdef', e => def(e, true), MacroType.INTERNAL);
        return this;
    }
}

class TokenArray implements ITokenSource {
    i = 0;
    constructor(public ta: Token[]){}
    nextToken(){ return this.i >= this.ta.length ? null : this.ta[this.i++]; }
    peekToken(){ return this.i >= this.ta.length ? null : this.ta[this.i]; }
}

/**
 * This should better be called a TeX preprocessor,
 * it expands all the macros in the input, removes comments.
 * */
class MacroExpander implements ITokenSource {
    macros: MacroSet;
    eReporter: ErrorReporter;
    maxNestedMacro: number = 100;
    private _tk: Token = null;

    processStack: ITokenSource[] = [];

    constructor(reporter: ErrorReporter, tSource?: ITokenSource, macroSet?: MacroSet){
        this.eReporter = reporter;
        this.macros = macroSet === void 0 ? new MacroSet() : macroSet;
        this.processStack = tSource ? [tSource] : [];
    }
    init(ts: ITokenSource){
        this.processStack.length = 0;
        this._tk = null;
        this.processStack.push(ts);
        this.macros.reset();
    }
    // token must be cosumed first
    private _expand(tk: Token, macro: Macro){
        if (macro === null){
            this.eReporter.complationError(`Undefined control sequence ${tk.text}`, tk);
            return;
        }
        let ts = macro.run(this, tk);
        if (ts !== null){
            if (this.processStack.length >= this.maxNestedMacro){
                this.eReporter.complationError('Maximum nested macro expansion exceeded', tk);
                // ignore this macro and force restart
                this.processStack.length = 1;
            }
            else {
                this.processStack.push(ts);
            }
        }
    }
    private _pull(){
        let t = this.processStack[this.processStack.length - 1].nextToken();
        while (t === null){
            this.processStack.pop();
            t = this.processStack[this.processStack.length - 1].nextToken();
        }
        return t;
    }
    readPossibleGroup(bg: Token, expand: boolean, array?: Token[]): Token[]{
        let ret: Token[];
        if (array === void 0)
            ret = [bg];
        else {
            ret = array;
            ret.push(bg);
        }
        let level = 1;
        if (bg.type === TokenType.BGROUP){
            while (level > 0){
                let t = this.nextToken(expand);
                if (t.type === TokenType.EOF){
                    this.eReporter.complationError('missing "}"', t);
                    level = 0;
                }
                else {
                    ret.push(t);
                    t.type === TokenType.BGROUP && level++;
                    t.type === TokenType.EGROUP && level--;
                }
            }
        }
        return ret;
    }
    private _readToken(expand: boolean = true): Token{
        do {
            let ret = this._pull();
            if (expand && ret.type === TokenType.MACRO){
                let macro = this.macros.getMacro(ret.text);
                if (macro === null || (macro !== null && !macro.isMeta)){
                    this._expand(ret, macro);
                    continue;
                }
                else
                    return ret;
            }
            else {
                if (ret.type === TokenType.BGROUP){
                    this.macros.enterScope();
                }
                else if (ret.type === TokenType.EGROUP){
                    if (this.macros.isGlobal()){
                        this.eReporter.complationError('"}" without "{"', ret);
                    }
                    else 
                        this.macros.leaveScope();
                }
                if (ret.type === TokenType.EOF && this.macros.isGlobal()){
                    this.eReporter.complationError('missing "}"', ret);
                }
                return ret;
            }
        } while(true);
    }
    nextToken(expand: boolean = true): Token{
        if (this._tk === null){
            return this._readToken(expand);
        }
        else {
            let tk = this._tk;
            this._tk = null;
            return tk;
        }
    }
    peekToken(expand: boolean = true): Token{
        return this._tk === null ? this._tk = this._readToken(expand) : this._tk;
    }
}

export { MacroExpander };