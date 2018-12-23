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
        Range.between = function (p1, p2) {
            return new Range(p1.start, p2.end);
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
            this.isMeta = false;
            this.argCount = 0;
            this.name = nameToken.text;
        }
        TeXMacro.prototype.run = function (e) {
            var ret = [], param = new Array(this.argCount);
            var t;
            for (var i = 0, _a = this.fmt; i < _a.length; i++) {
                var f = _a[i];
                if (f.type === TokenType.MACRO_PARAM) {
                    var selectedParam = void 0;
                    if (i === _a.length - 1) {
                        selectedParam = param[f.val] = e.readPossibleGroup(e.nextToken(false), false);
                    }
                    else {
                        var next = _a[i + 1];
                        selectedParam = param[f.val] = [];
                        t = e.peekToken(false);
                        while (t.type !== TokenType.EOF && t.text !== next.text) {
                            e.readPossibleGroup(e.nextToken(false), false, selectedParam);
                            t = e.peekToken(false);
                        }
                    }
                }
                else {
                    t = e.nextToken(false);
                    if (t.type === TokenType.EOF)
                        e.eReporter.complationError("Unexpected end of file: use of macro " + this.name + " that doesn't match its definition", t);
                    else if (f.text !== t.text) {
                        e.eReporter.complationError("Use of macro " + this.name + " that doesn't match its definition", t);
                    }
                }
            }
            for (var _i = 0, _b = this.content; _i < _b.length; _i++) {
                var tk = _b[_i];
                if (tk.type === TokenType.MACRO_PARAM) {
                    var selected = param[tk.val];
                    if (selected.length >= 1)
                        selected[0].hasWhiteSpace = tk.hasWhiteSpace;
                    for (var _c = 0, selected_1 = selected; _c < selected_1.length; _c++) {
                        var ptk = selected_1[_c];
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
            return this;
        };
        MacroSet.prototype.define = function (name, run, global) {
            if (global === void 0) { global = false; }
            this.defineMacro({ name: name, run: run, isMeta: false }, global);
            return this;
        };
        MacroSet.prototype.defineMeta = function (name, global) {
            if (global === void 0) { global = false; }
            this.defineMacro({ name: name, run: null, isMeta: true }, global);
            return this;
        };
        MacroSet.prototype.enterScope = function () {
            this.macroStack.push({});
            return this;
        };
        MacroSet.prototype.leaveScope = function () {
            this.macroStack.pop();
            return this;
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
                macro.content = e.readPossibleGroup(t, false);
                cela.defineMacro(macro, global);
                return null;
            }
            this.define('\\def', function (e) { return def(e, false); });
            this.define('\\gdef', function (e) { return def(e, true); });
            return this;
        };
        return MacroSet;
    }());
    var TokenArray = (function () {
        function TokenArray(ta) {
            this.ta = ta;
            this.i = 0;
        }
        TokenArray.prototype.nextToken = function () { return this.i >= this.ta.length ? null : this.ta[this.i++]; };
        TokenArray.prototype.peekToken = function () { return this.i >= this.ta.length ? null : this.ta[this.i]; };
        return TokenArray;
    }());
    var MacroExpander = (function () {
        function MacroExpander(reporter, tSource, macroSet) {
            this.maxNestedMacro = 100;
            this._tk = null;
            this.processStack = [];
            this.eReporter = reporter;
            this.macros = macroSet === void 0 ? new MacroSet() : macroSet;
            this.processStack = tSource ? [tSource] : [];
        }
        MacroExpander.prototype.init = function (ts) {
            this.processStack.length = 0;
            this._tk = null;
            this.processStack.push(ts);
        };
        MacroExpander.prototype._expand = function (tk, macro) {
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
        MacroExpander.prototype.readPossibleGroup = function (bg, expand, array) {
            var ret;
            if (array === void 0)
                ret = [bg];
            else {
                ret = array;
                ret.push(bg);
            }
            var level = 1;
            if (bg.type === TokenType.BGROUP) {
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
            }
            return ret;
        };
        MacroExpander.prototype._readToken = function (expand) {
            if (expand === void 0) { expand = true; }
            do {
                var ret = this._pull();
                if (expand && ret.type === TokenType.MACRO) {
                    var macro = this.macros.getMacro(ret.text);
                    if (macro === null || !macro.isMeta) {
                        this._expand(ret, macro);
                        continue;
                    }
                    else
                        return ret;
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
        MacroExpander.prototype.nextToken = function (expand) {
            if (expand === void 0) { expand = true; }
            if (this._tk === null) {
                return this._readToken(expand);
            }
            else {
                var tk = this._tk;
                this._tk = null;
                return tk;
            }
        };
        MacroExpander.prototype.peekToken = function (expand) {
            if (expand === void 0) { expand = true; }
            return this._tk === null ? this._tk = this._readToken(expand) : this._tk;
        };
        return MacroExpander;
    }());

    var regWhiteSpace = /[ \t\r\n]/;
    var regName = /[a-zA-Z0-9$]/;
    var regDigit = /[0-9]/;
    var Scanner = (function () {
        function Scanner(_source) {
            this._source = _source;
            this.pos = new Position(1, 1);
            this._tk = null;
            this.macroChar = '\\';
            this.macroParamChar = '#';
            this.bgroupChar = '{';
            this.egroupChar = '}';
            this.commentChar = '%';
        }
        Scanner.prototype.reset = function (s) {
            if (s === void 0) { s = null; }
            this.pos.reset();
            this._tk = null;
            if (s !== null) {
                this._source = s;
            }
        };
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
            if (this._tk === null) {
                return this._scanToken();
            }
            else {
                var tk = this._tk;
                this._tk = null;
                return tk;
            }
        };
        Scanner.prototype.peekToken = function () {
            return this._tk === null ? this._tk = this._scanToken() : this._tk;
        };
        Scanner.prototype._scanToken = function () {
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
                else if (c === this.commentChar) {
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
            if (c === this.macroChar) {
                this._consume(c);
                if (this._isLetter(this._source.peek())) {
                    var name_1 = this.macroChar + this._source.next();
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
            else if (c === this.macroParamChar) {
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
                var ch = c.charAt(0);
                if (c === this.bgroupChar) {
                    type = TokenType.BGROUP;
                }
                else if (c === this.egroupChar) {
                    type = TokenType.EGROUP;
                }
                else {
                    type = TokenType.OTHER;
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
        ErrorReporter.prototype.reset = function () {
            this.msgs.length = 0;
        };
        ErrorReporter.prototype.complationError = function (msg, range) {
            this.msgs.push({ msg: msg, range: range });
        };
        return ErrorReporter;
    }());

    var toneName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var toneNum = ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];
    var numToNote = [0, 2, 4, 5, 7, 9, 11];
    var Note = (function () {
        function Note(note) {
            this.note = note;
            this.duration = 32;
            this.velocity = 0;
        }
        Note.prototype.toString = function (useNum) {
            if (useNum === void 0) { useNum = false; }
            var n = useNum ? toneNum : toneName;
            return "< " + n[Note.getTone(this.note)] + " " + Note.getOctave(this.note) + ", " + this.duration + " >";
        };
        Note.prototype.normalize = function () {
            if (this.note < 0) {
                this.note = 0;
            }
            if (this.note > 132) {
                this.note = 131;
            }
            this.duration = Math.round(this.duration) | 0;
            if (this.duration === 0) {
                this.duration = 1;
            }
            return this;
        };
        Note.prototype.shiftOctave = function (n) {
            if (!this.isRest())
                this.note += n * 12;
        };
        Note.prototype.shift = function (n) {
            if (!this.isRest())
                this.note += n;
        };
        Note.prototype.isRest = function () {
            return this.note === 132;
        };
        Note.prototype.toEvent = function (delta, channel) {
            return { delta: delta, channel: channel, velocity: this.velocity, note: this.note, duration: this.duration };
        };
        Note.getTone = function (note) { return note % 12; };
        Note.getOctave = function (note) { return (note / 12 | 0) - 1; };
        Note.numberToNote = function (n, octave) { return n === 0 ? 132 : numToNote[n - 1] + 12 * (octave + 1); };
        return Note;
    }());
    function eventToString(e, useNum) {
        if (useNum === void 0) { useNum = false; }
        var n = useNum ? toneNum : toneName;
        return "< " + n[Note.getTone(e.note)] + " " + Note.getOctave(e.note) + ", " + e.delta + ", " + e.duration + " >";
    }

    var List = (function () {
        function List() {
            this.head = null;
            this.tail = null;
        }
        List.prototype.remove = function (node) {
            if (node.prev)
                node.prev.next = node.next;
            if (node.next)
                node.next.prev = node.prev;
            if (node === this.head)
                this.head = node.next;
            if (node === this.tail)
                this.tail = node.prev;
        };
        List.prototype.add = function (data) {
            var node = { data: data, prev: this.tail, next: null };
            if (!this.head)
                this.head = node;
            if (this.tail)
                this.tail.next = node;
            this.tail = node;
        };
        List.prototype.forEach = function (cb) {
            for (var n = this.head; n; n = n.next) {
                cb(n.data, n);
            }
        };
        return List;
    }());

    var NodeType;
    (function (NodeType) {
        NodeType[NodeType["VIA"] = 0] = "VIA";
        NodeType[NodeType["DASH"] = 1] = "DASH";
        NodeType[NodeType["UNDERLINE"] = 2] = "UNDERLINE";
        NodeType[NodeType["SHARP"] = 3] = "SHARP";
        NodeType[NodeType["FLAT"] = 4] = "FLAT";
        NodeType[NodeType["DOT"] = 5] = "DOT";
        NodeType[NodeType["POS_OCTAVE"] = 6] = "POS_OCTAVE";
        NodeType[NodeType["NEG_OCTAVE"] = 7] = "NEG_OCTAVE";
    })(NodeType || (NodeType = {}));
    var modifierToType = {
        '_': NodeType.UNDERLINE,
        '-': NodeType.DASH,
        '#': NodeType.SHARP,
        'b': NodeType.FLAT,
        '.': NodeType.NEG_OCTAVE,
        '\'': NodeType.POS_OCTAVE,
        '*': NodeType.DOT
    };
    var modifierWithVal = {
        '-': NodeType.DASH,
        '*': NodeType.DOT
    };
    var nodeTypeToLiteral = ['', '-', '_', '#', 'b', '*', '\'', '.'];
    function createNoteNode(note, pos) {
        return { next: null, sibling: null, parent: null, note: note, pos: pos, channel: 0, refCount: 1 };
    }
    function createNode(type, pos) {
        if (pos === void 0) { pos = null; }
        return { parent: null, type: type, pos: pos };
    }
    function createNodeWithVal(type, pos, val) {
        return { type: type, parent: null, pos: pos, val: val };
    }
    var NoteNodeList = (function () {
        function NoteNodeList() {
            this.head = null;
            this.tail = null;
            this.sibling = null;
            this.topNode = null;
            this._freeChildren = [];
        }
        NoteNodeList.prototype._copyFrom = function (list) {
            this.head = list.head;
            this.tail = list.tail;
            this.sibling = list.sibling;
            this.topNode = list.topNode;
            this._freeChildren = list._freeChildren;
        };
        NoteNodeList.prototype._connectTailTo = function (node) {
            this.tail.next = node;
            for (var _i = 0, _a = this._freeChildren; _i < _a.length; _i++) {
                var n = _a[_i];
                n.next = node;
            }
            node.refCount = this._freeChildren.length + 1;
            this._freeChildren.length = 0;
        };
        NoteNodeList.prototype.append = function (node) {
            if (this.head) {
                this._connectTailTo(node);
                this.tail = node;
            }
            else {
                this.sibling = this.head = this.tail = node;
                this.topNode = createNode(NodeType.VIA);
            }
            var top = node.parent = this.topNode;
            var cur = null;
            return {
                insertNode: function (n) {
                    n.parent = top;
                    if (cur) {
                        cur.parent = n;
                    }
                    else {
                        node.parent = n;
                    }
                    cur = n;
                }
            };
        };
        NoteNodeList.prototype.appendChild = function (list) {
            if (list.head) {
                if (this.head) {
                    this.sibling.sibling = list.head;
                    this.sibling = list.sibling;
                    list.topNode.parent = this.topNode;
                    this._freeChildren.push(list.tail);
                }
                else
                    throw 'unreachable';
            }
        };
        NoteNodeList.prototype.concat = function (list) {
            if (list.head) {
                if (this.head) {
                    this._connectTailTo(list.head);
                    this.tail = list.tail;
                    list.topNode.parent = this.topNode;
                }
                else {
                    this._copyFrom(list);
                    this.topNode = list.topNode.parent = createNode(NodeType.VIA);
                }
                var top_1 = this.topNode;
                var cur_1 = list.topNode;
                return {
                    insertNode: function (node) {
                        node.parent = top_1;
                        cur_1.parent = node;
                        cur_1 = node;
                    }
                };
            }
            else
                return null;
        };
        return NoteNodeList;
    }());
    var regNum = /[0-9]/;
    function createParser(eReporter) {
        var macroExpander = new MacroExpander(eReporter);
        var defaultOctave = 4;
        macroExpander.macros
            .defineInternalMacros()
            .defineMeta('\\tri');
        return {
            parse: parse
        };
        function next() {
            return macroExpander.nextToken();
        }
        function peek() {
            return macroExpander.peekToken();
        }
        function parse(tkSource) {
            macroExpander.init(tkSource);
            return parseSequence();
        }
        function parseGroup() {
            next();
            var list = parseSequence();
            var tk = peek();
            while (tk.type !== TokenType.EOF && tk.text === '|') {
                next();
                list.appendChild(parseSequence());
                tk = peek();
            }
            if (next().type !== TokenType.EGROUP) {
                eReporter.complationError("'}' expected", tk);
            }
            return list;
        }
        function parseSequence() {
            var tk = peek();
            var list = new NoteNodeList();
            while (tk.type !== TokenType.EOF && tk.type !== TokenType.EGROUP && tk.text !== '|') {
                var slot = null;
                if (tk.type === TokenType.BGROUP) {
                    var group = parseGroup();
                    slot = list.concat(group);
                }
                else {
                    slot = list.append(parseNote(tk));
                }
                parseNoteModifiers(slot);
                tk = peek();
            }
            return list;
        }
        function parseNote(tk) {
            if (regNum.test(tk.text)) {
                next();
                var n = Number(tk.text);
                if (n >= 0 && n <= 7) {
                    return createNoteNode(Note.numberToNote(n, defaultOctave), tk);
                }
                else {
                    eReporter.complationError("Unknown note \"" + n + "\", valid notes are 0-7", tk);
                    return createNoteNode(-1, tk);
                }
            }
            else {
                next();
                eReporter.complationError('Note expected', tk);
                return createNoteNode(-1, tk);
            }
        }
        function parseNoteModifiers(slot) {
            var tk = peek();
            while (tk.type === TokenType.OTHER && tk.text !== '|' && modifierToType.hasOwnProperty(tk.text)) {
                var type = modifierToType[tk.text];
                if (modifierWithVal.hasOwnProperty(tk.text)) {
                    var s = tk.text;
                    var start = tk, end = tk;
                    var num = 1;
                    next();
                    tk = peek();
                    while (tk.text === s) {
                        num++;
                        end = tk;
                        next();
                        tk = peek();
                    }
                    slot.insertNode(createNodeWithVal(type, Range.between(start, end), num));
                }
                else {
                    slot.insertNode(createNode(modifierToType[tk.text], tk));
                    next();
                    tk = peek();
                }
            }
        }
    }
    function getModifiers(note) {
        var s = '';
        for (var n = note.parent; n; n = n.parent) {
            s += nodeTypeToLiteral[n.type];
        }
        return s;
    }
    function dumpNoteList(list) {
        var s = '';
        for (var node = list.head; node; node = node.next) {
            s += node.note + getModifiers(node) + ' ';
        }
        return [s];
    }
    function createNoteQueue(list) {
        var queue = new List();
        pushNote(list.head, 0);
        return {
            pollNote: pollNote
        };
        function getNoteFromNode(node) {
            var ret = new Note(node.note);
            for (var n = node.parent; n; n = n.parent) {
                switch (n.type) {
                    case NodeType.DASH:
                        ret.duration *= n.val;
                        break;
                    case NodeType.UNDERLINE:
                        ret.duration >>= 1;
                        break;
                    case NodeType.POS_OCTAVE:
                        ret.shiftOctave(1);
                        break;
                    case NodeType.NEG_OCTAVE:
                        ret.shiftOctave(-1);
                        break;
                    case NodeType.SHARP:
                        ret.shift(1);
                        break;
                    case NodeType.FLAT:
                        ret.shift(-1);
                        break;
                    case NodeType.DOT:
                        var factor = 1 << n.val;
                        ret.duration = ret.duration * (2 * factor - 1) / factor;
                        break;
                }
            }
            return ret.normalize();
        }
        function pushNote(node, delta) {
            for (; node; node = node.sibling) {
                queue.add({ note: getNoteFromNode(node), delta: delta, node: node });
            }
        }
        function pollNote() {
            var first = queue.head;
            if (first) {
                for (var n = first.next; n; n = n.next) {
                    if (n.data.delta < first.data.delta) {
                        first = n;
                    }
                }
                var ret_1 = first.data;
                queue.remove(first);
                queue.forEach(function (d, n) { return d.delta -= ret_1.delta; });
                if (ret_1.node.next && --ret_1.node.next.refCount === 0) {
                    pushNote(ret_1.node.next, ret_1.note.duration);
                }
                return ret_1.note.toEvent(0, ret_1.node.channel);
            }
            else
                return null;
        }
    }

    exports.MacroExpander = MacroExpander;
    exports.Scanner = Scanner;
    exports.ErrorReporter = ErrorReporter;
    exports.createParser = createParser;
    exports.dumpNoteList = dumpNoteList;
    exports.createNoteQueue = createNoteQueue;
    exports.eventToString = eventToString;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=quick-midi.js.map
