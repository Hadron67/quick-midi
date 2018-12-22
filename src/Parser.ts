/*
    \c{1} {5.12}_ 233 123255 56771'1' {2321}' 7
    \c{2} 
*/
import { Midi, Channel, Note } from "./Sequence";
import { ITokenSource, TokenType, Token, Range } from "./Token";
import { MacroExpander } from "./MacroExpaner";
import { ErrorReporter } from "./ErrorReporter";

export interface Parser {
    parse(tkSource: ITokenSource): NoteNodeList;
};

enum NodeType {
    NONE, DASH, UNDERLINE, SHARP, FLAT, DOT, POS_OCTAVE, NEG_OCTAVE
};

const modifierToType = {
    '_': NodeType.UNDERLINE,
    '-': NodeType.DASH,
    '#': NodeType.SHARP,
    'b': NodeType.FLAT,
    '.': NodeType.NEG_OCTAVE,
    '\'': NodeType.POS_OCTAVE,
    '*': NodeType.DOT
};

const nodeTypeToLiteral = ['', '-', '_', '#', 'b', '*', '\'', '.'];

interface Node {
    pos: Range;
    parent: Node;
    type: NodeType;
};

interface NoteNode {
    next: NoteNode;
    sibling: NoteNode;
    parent: Node;
    note: number;
    pos: Range;
}

interface INodeSlot {
    insertNode(node: Node): any;
};

class NodeList {
    top: Node = null;
    bottom: Node = null;
    appendNode(node: Node){
        if (this.bottom){
            this.top.parent = node;
            this.top = node;
        }
        else {
            this.top = this.bottom = node;
        }
    }
};

function createNoteNode(note: number, pos: Range): NoteNode{
    return { next: null, sibling: null, parent: null, note, pos };
}
function createNode(type: NodeType, pos: Range = null): Node{
    return { parent: null, type, pos };
}

class NoteNodeList {
    head: NoteNode = null;
    tail: NoteNode = null;
    sibling: NoteNode = null;
    topNode: Node = null;
    private _copyFrom(list: NoteNodeList){
        this.head = list.head;
        this.tail = list.tail;
        this.sibling = list.sibling;
        this.topNode = list.topNode;
    }
    append(node: NoteNode): INodeSlot{
        if (this.head) {
            this.tail.next = node;
            this.tail = node;
        }
        else {
            this.sibling = this.head = this.tail = node;
            this.topNode = createNode(NodeType.NONE);
        }
        let top = node.parent = this.topNode;
        let cur: Node = null;
        return {
            insertNode(n: Node){
                n.parent = top;
                if (cur){
                    cur.parent = n;
                }
                else {
                    node.parent = n;
                }
                cur = n;
            }
        };
    }
    appendChild(list: NoteNodeList){
        if (list.head){
            if (this.head){
                this.sibling.sibling = list.head;
                this.sibling = list.sibling;
                list.topNode.parent = this.topNode;
            }
            else 
                this._copyFrom(list);
        }
    }
    concat(list: NoteNodeList){
        if (list.head){
            if (this.head){
                this.tail.next = list.head;
                this.tail = list.tail;
                list.topNode.parent = this.topNode;
            }
            else
                this._copyFrom(list);
        }
    }
    getNodeSlot(): INodeSlot{
        let cela = this;
        return {
            insertNode(node: Node){
                if (cela.head){
                    let top = cela.topNode;
                    node.parent = top.parent;
                    top.parent = node;
                    cela.topNode = node;
                }
            }
        };
    }
};

const regNum = /[0-9]/;

export function createParser(eReporter: ErrorReporter): Parser{
    let macroExpander: MacroExpander = new MacroExpander(eReporter);
    let midi: Midi;
    let currentChannel: Channel;
    let defaultOctave = 4;

    macroExpander.macros
    .defineInternalMacros()
    .defineMeta('\\tri');
    
    return { 
        parse
    };

    function next(){
        return macroExpander.nextToken();
    }

    function peek(){
        return macroExpander.peekToken();
    }

    function parse(tkSource: ITokenSource): NoteNodeList{
        macroExpander.init(tkSource);
        return parseSequence();
    }

    /**
     * '{' Sequence ( '|' Sequence )* '}'
     */
    function parseGroup(): NoteNodeList {
        next();
        let list = parseSequence();
        let tk = peek();
        while (tk.type !== TokenType.EOF && tk.text === '|'){
            next();
            list.appendChild(parseSequence());
            tk = peek();
        }
        if (next().type !== TokenType.EGROUP){
            eReporter.complationError("'}' expected", tk);
        }
        return list;
    }

    /**
     * ( (Note | Group) NoteModifiers )*
     */
    function parseSequence(): NoteNodeList{
        let tk = peek();
        let list = new NoteNodeList();
        while (tk.type !== TokenType.EOF && tk.type !== TokenType.EGROUP && tk.text !== '|'){
            let slot: INodeSlot = null;
            if (tk.type === TokenType.BGROUP){
                let group = parseGroup();
                slot = group.getNodeSlot();
                list.concat(group);
            }
            else {
                slot = list.append(parseNote(tk));
            }
            parseNoteModifiers(slot);
            tk = peek();
        }
        return list;
    }

    function parseNote(tk: Token): NoteNode{
        if (regNum.test(tk.text)){
            next();
            let n = Number(tk.text);
            if (n >= 0 && n <= 7){
                return createNoteNode(Note.numberToNote(n, defaultOctave), tk);
            }
            else {
                eReporter.complationError(`Unknown note "${n}", valid notes are 0-7`, tk);
                return createNoteNode(-1, tk);
            }
        }
        else {
            next();
            eReporter.complationError('Note expected', tk);
            return createNoteNode(-1, tk);
        }
    }
    
    /**
     * ( '_' | '-' | '#' | 'b' | '.' | '\'' | '\*' )*
     */
    function parseNoteModifiers(slot: INodeSlot){
        let tk = peek();
        while (tk.type === TokenType.OTHER && tk.text !== '|' && modifierToType.hasOwnProperty(tk.text)){
            slot.insertNode(createNode(modifierToType[tk.text], tk));
            next();
            tk = peek();
        }
    }
}

function getModifiers(note: NoteNode): string{
    let s = '';
    for (let n = note.parent; n; n = n.parent){
        s += nodeTypeToLiteral[n.type];
    }
    return s;
}
export function dumpNoteList(list: NoteNodeList): string[]{
    let s = '';
    for (let node = list.head; node; node = node.next){
        s += node.note + getModifiers(node) + ' ';
    }
    return [s];
}