import { Token, ITokenSource, TokenType } from './Token';
import { ErrorReporter } from './ErrorReporter';

interface Macro {
    name: string;
    run(e: MacroExpander): ITokenSource;
}

class TeXMacro implements Macro {
    name: string;
    fmt: Token[] = [];
    content: Token[] = null;
    argCount: number = 0;
    constructor(public nameToken: Token){
        this.name = nameToken.text;
    }
    run(e: MacroExpander){
        let ret: Token[] = [], param: Token[][] = new Array(this.argCount);
        for (let i = 0, _a = this.fmt; i < _a.length; i++){
            let f = _a[i], t = e.nextToken(false);
            if (f.type === TokenType.MACRO_PARAM){
                param[f.val] = t.type === TokenType.BGROUP ? e.readGroup(t, false) : [t];
            }
            else if (f.text !== t.text){
                e.eReporter.complationError(`Use of macro ${this.name} that doesn't match its definition`, t);
            }
        }
        for (let tk of this.content){
            if (tk.type === TokenType.MACRO_PARAM){
                for (let ptk of param[tk.val]){
                    ret.push(ptk);
                }
            }
            else
                ret.push(tk);
        }
        return new TokenArray(ret);
    }
}

class MacroSet {
    macroStack: {[name: string]: Macro}[] = [{}];
    getMacro(name: string): Macro{
        for (let _a = this.macroStack, i = _a.length - 1; i >= 0; i--){
            if (_a[i][name] !== undefined)
                return _a[i][name];
        }
        return null;
    }
    defineMacro(m: Macro, global: boolean = false){
        this.macroStack[global ? 0 : (this.macroStack.length - 1)][m.name] = m;
    }
    define(name: string, run: (e: MacroExpander) => ITokenSource, global: boolean = false){
        this.defineMacro({name, run}, global);
    }
    enterScope(){
        this.macroStack.push({});
    }
    leaveScope(){
        this.macroStack.pop();
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
            macro.content = e.readGroup(t, false);
            cela.defineMacro(macro, global);
            return null;
        }
        this.define('\\def', e => def(e, false));
        this.define('\\gdef', e => def(e, true));
    }
}

class TokenArray implements ITokenSource {
    i = 0;
    constructor(public ta: Token[]){}
    nextToken(){ return this.i >= this.ta.length ? null : this.ta[this.i++]; }
}

/**
 * This should better be called a TeX preprocessor,
 * it expands all the macros in the input, removes comments.
 * */
class MacroExpander implements ITokenSource {
    macros: MacroSet;
    eReporter: ErrorReporter;
    maxNestedMacro: number = 100;

    processStack: ITokenSource[] = [];

    constructor(reporter: ErrorReporter, tSource: ITokenSource, macroSet?: MacroSet){
        this.eReporter = reporter;
        this.macros = macroSet === undefined ? new MacroSet() : macroSet;
        this.processStack = [tSource];
    }
    init(){
        this.processStack.length = 1;
    }
    // token must be cosumed first
    private _expand(tk: Token){
        let macro = this.macros.getMacro(tk.text);
        if (macro === null){
            this.eReporter.complationError(`Undefined control sequence ${tk.text}`, tk);
            return;
        }
        let ts = macro.run(this);
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
    readGroup(bg: Token, expand: boolean): Token[]{
        let ret: Token[] = [bg];
        let level = 1;
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
        return ret;
    }
    nextToken(expand: boolean = true): Token{
        do {
            let ret = this._pull();
            if (expand && ret.type === TokenType.MACRO){
                this._expand(ret);
                continue;
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
}

export { MacroExpander };