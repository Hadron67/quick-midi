(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.qmidi = {})));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var Position = (function () {
        function Position(line, column) {
            this.line = line;
            this.column = column;
        }
        Position.prototype.reset = function () {
            this.line = this.column = 1;
        };
        Position.prototype.forward = function () {
            this.column++;
        };
        Position.prototype.newline = function () {
            this.line++;
            this.column = 1;
        };
        Position.prototype.clone = function () {
            return new Position(this.line, this.column);
        };
        return Position;
    }());
    var Range = (function () {
        function Range(start, end) {
            this.start = start;
            this.end = end;
        }
        Range.prototype.reset = function () {
            this.start.reset();
            this.end.reset();
        };
        Range.here = function (h) {
            return new Range(h, new Position(h.line, h.column + 1));
        };
        return Range;
    }());
    var TokenType;
    (function (TokenType) {
        TokenType[TokenType["EOF"] = 1] = "EOF";
        TokenType[TokenType["SPACE"] = 2] = "SPACE";
        TokenType[TokenType["MACRO"] = 3] = "MACRO";
        TokenType[TokenType["MACRO_PARAM"] = 4] = "MACRO_PARAM";
        TokenType[TokenType["BGROUP"] = 5] = "BGROUP";
        TokenType[TokenType["EGROUP"] = 6] = "EGROUP";
        TokenType[TokenType["OTHER"] = 7] = "OTHER";
    })(TokenType || (TokenType = {}));
    var Token = (function (_super) {
        __extends(Token, _super);
        function Token(type, text, start, end, hasWhiteSpace, val) {
            if (val === void 0) { val = null; }
            var _this = _super.call(this, start, end) || this;
            _this.type = type;
            _this.text = text;
            _this.hasWhiteSpace = hasWhiteSpace;
            _this.val = val;
            return _this;
        }
        Token.prototype.getText = function () {
            var t = this.text === null ? '' : this.text;
            return this.hasWhiteSpace ? ' ' + t : t;
        };
        return Token;
    }(Range));

    var TeXMacro = (function () {
        function TeXMacro(nameToken) {
            this.nameToken = nameToken;
            this.fmt = [];
            this.content = null;
            this.argCount = 0;
            this.name = nameToken.text;
        }
        TeXMacro.prototype.run = function (e) {
            var ret = [], param = new Array(this.argCount);
            for (var i = 0, _a = this.fmt; i < _a.length; i++) {
                var f = _a[i], t = e.nextToken(false);
                if (f.type === TokenType.MACRO_PARAM) {
                    param[f.val] = t.type === TokenType.BGROUP ? e.readGroup(t, false) : [t];
                }
                else if (f.text !== t.text) {
                    e.eReporter.complationError("Use of macro " + this.name + " that doesn't match its definition", t);
                }
            }
            for (var _i = 0, _b = this.content; _i < _b.length; _i++) {
                var tk = _b[_i];
                if (tk.type === TokenType.MACRO_PARAM) {
                    for (var _c = 0, _d = param[tk.val]; _c < _d.length; _c++) {
                        var ptk = _d[_c];
                        ret.push(ptk);
                    }
                }
                else
                    ret.push(tk);
            }
            return new TokenArray(ret);
        };
        return TeXMacro;
    }());
    var MacroSet = (function () {
        function MacroSet() {
            this.macroStack = [{}];
        }
        MacroSet.prototype.getMacro = function (name) {
            for (var _a = this.macroStack, i = _a.length - 1; i >= 0; i--) {
                if (_a[i][name] !== undefined)
                    return _a[i][name];
            }
            return null;
        };
        MacroSet.prototype.defineMacro = function (m, global) {
            if (global === void 0) { global = false; }
            this.macroStack[global ? 0 : (this.macroStack.length - 1)][m.name] = m;
        };
        MacroSet.prototype.define = function (name, run, global) {
            if (global === void 0) { global = false; }
            this.defineMacro({ name: name, run: run }, global);
        };
        MacroSet.prototype.enterScope = function () {
            this.macroStack.push({});
        };
        MacroSet.prototype.leaveScope = function () {
            this.macroStack.pop();
        };
        MacroSet.prototype.isGlobal = function () {
            return this.macroStack.length === 0;
        };
        MacroSet.prototype.defineInternalMacros = function () {
            var cela = this;
            function def(e, global) {
                var t = e.nextToken(false);
                if (t.type !== TokenType.MACRO) {
                    e.eReporter.complationError('Macro name expected', t);
                    return null;
                }
                var macro = new TeXMacro(t);
                t = e.nextToken(false);
                while (t.type !== TokenType.BGROUP && t.type !== TokenType.EOF) {
                    if (t.type === TokenType.MACRO_PARAM) {
                        if (t.val !== ++macro.argCount) {
                            e.eReporter.complationError('Macro parameter number must be consecutive', t);
                        }
                        macro.fmt.push(t);
                    }
                    else
                        macro.fmt.push(t);
                    t = e.nextToken(false);
                }
                if (t.type !== TokenType.BGROUP) {
                    e.eReporter.complationError('"{" expected', t);
                    return null;
                }
                macro.content = e.readGroup(t, false);
                cela.defineMacro(macro, global);
                return null;
            }
            this.define('\\def', function (e) { return def(e, false); });
            this.define('\\gdef', function (e) { return def(e, true); });
        };
        return MacroSet;
    }());
    var TokenArray = (function () {
        function TokenArray(ta) {
            this.ta = ta;
            this.i = 0;
        }
        TokenArray.prototype.nextToken = function () { return this.i >= this.ta.length ? null : this.ta[this.i++]; };
        return TokenArray;
    }());
    var MacroExpander = (function () {
        function MacroExpander(reporter, tSource, macroSet) {
            this.maxNestedMacro = 100;
            this.processStack = [];
            this.eReporter = reporter;
            this.macros = macroSet === undefined ? new MacroSet() : macroSet;
            this.processStack = [tSource];
        }
        MacroExpander.prototype.init = function () {
            this.processStack.length = 1;
        };
        MacroExpander.prototype._expand = function (tk) {
            var macro = this.macros.getMacro(tk.text);
            if (macro === null) {
                this.eReporter.complationError("Undefined control sequence " + tk.text, tk);
                return;
            }
            var ts = macro.run(this);
            if (ts !== null) {
                if (this.processStack.length >= this.maxNestedMacro) {
                    this.eReporter.complationError('Maximum nested macro expansion exceeded', tk);
                    this.processStack.length = 1;
                }
                else {
                    this.processStack.push(ts);
                }
            }
        };
        MacroExpander.prototype._pull = function () {
            var t = this.processStack[this.processStack.length - 1].nextToken();
            while (t === null) {
                this.processStack.pop();
                t = this.processStack[this.processStack.length - 1].nextToken();
            }
            return t;
        };
        MacroExpander.prototype.readGroup = function (bg, expand) {
            var ret = [bg];
            var level = 1;
            while (level > 0) {
                var t = this.nextToken(expand);
                if (t.type === TokenType.EOF) {
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
        };
        MacroExpander.prototype.nextToken = function (expand) {
            if (expand === void 0) { expand = true; }
            do {
                var ret = this._pull();
                if (expand && ret.type === TokenType.MACRO) {
                    this._expand(ret);
                    continue;
                }
                else {
                    if (ret.type === TokenType.BGROUP) {
                        this.macros.enterScope();
                    }
                    else if (ret.type === TokenType.EGROUP) {
                        if (this.macros.isGlobal()) {
                            this.eReporter.complationError('"}" without "{"', ret);
                        }
                        else
                            this.macros.leaveScope();
                    }
                    if (ret.type === TokenType.EOF && this.macros.isGlobal()) {
                        this.eReporter.complationError('missing "}"', ret);
                    }
                    return ret;
                }
            } while (true);
        };
        return MacroExpander;
    }());

    var regWhiteSpace = /[ \t\r\n]/;
    var regName = /[a-zA-Z0-9$_]/;
    var regDigit = /[0-9]/;
    var Scanner = (function () {
        function Scanner(_source) {
            this._source = _source;
            this.pos = new Position(1, 1);
        }
        Scanner.prototype._next = function () {
            var c = this._source.next();
            if (c === '\r') {
                this._source.peek() === '\n' && this._source.next();
                return '\n';
            }
            return c;
        };
        Scanner.prototype._consume = function (c) {
            if (c === '\n')
                this.pos.newline();
            else {
                this.pos.forward();
                c.charCodeAt(0) >= 0x7f && this.pos.forward();
            }
        };
        Scanner.prototype._isLetter = function (c) {
            return regName.test(c);
        };
        Scanner.prototype.nextToken = function () {
            var c = this._next();
            var noWhiteSpace = false, hasWhiteSpace = false;
            do {
                if (regWhiteSpace.test(c)) {
                    hasWhiteSpace = true;
                    while (regWhiteSpace.test(c)) {
                        this._consume(c);
                        c = this._next();
                    }
                }
                else if (c === '%') {
                    this._consume(c);
                    c = this._next();
                    hasWhiteSpace = true;
                    while (c !== null && c !== '\n') {
                        this._consume(c);
                        c = this._next();
                    }
                }
                else
                    noWhiteSpace = true;
            } while (!noWhiteSpace);
            var cur = this.pos.clone();
            if (c === null) {
                return new Token(TokenType.EOF, null, cur, this.pos.clone(), hasWhiteSpace);
            }
            if (c === '\\') {
                this._consume(c);
                if (this._isLetter(this._source.peek())) {
                    var name_1 = '\\' + this._source.next();
                    this._consume(c);
                    while (this._isLetter(c = this._source.peek()) && c !== null) {
                        this._consume(c);
                        name_1 += this._next();
                    }
                    return new Token(TokenType.MACRO, name_1, cur, this.pos.clone(), hasWhiteSpace);
                }
                else {
                    return new Token(TokenType.OTHER, c, cur, this.pos.clone(), hasWhiteSpace);
                }
            }
            else if (c === '#') {
                this._consume(c);
                if (regDigit.test(this._source.peek())) {
                    c = this._source.next();
                    this._consume(c);
                    return new Token(TokenType.MACRO_PARAM, null, cur, this.pos.clone(), hasWhiteSpace, Number(c));
                }
                else
                    return new Token(TokenType.OTHER, c, cur, this.pos.clone(), hasWhiteSpace);
            }
            else {
                this._consume(c);
                var type = void 0;
                switch (c.charAt(0)) {
                    case '{':
                        type = TokenType.BGROUP;
                        break;
                    case '}':
                        type = TokenType.EGROUP;
                        break;
                    default: type = TokenType.OTHER;
                }
                return new Token(type, c, cur, this.pos.clone(), hasWhiteSpace);
            }
        };
        return Scanner;
    }());

    var ErrorReporter = (function () {
        function ErrorReporter() {
            this.msgs = [];
        }
        ErrorReporter.prototype.complationError = function (msg, range) {
            this.msgs.push({ msg: msg, range: range });
        };
        return ErrorReporter;
    }());

    exports.MacroExpander = MacroExpander;
    exports.Scanner = Scanner;
    exports.ErrorReporter = ErrorReporter;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=quick-midi.js.map
