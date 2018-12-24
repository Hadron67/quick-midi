/*
    \c{1} {5.12}_ 233 123255 56771'1' {2321}' 7
    \c{2} 
*/
import { Note, NoteEvent } from "./Sequence";
import { ITokenSource, TokenType, Token, Range } from "./Token";
import { MacroExpander } from "./MacroExpaner";
import { ErrorReporter } from "./ErrorReporter";
import { List, ListNode } from "./List";

export interface Parser {
    parse(tkSource: ITokenSource): NoteNodeList;
    parseAndConvert(tkSource: ITokenSource): NoteEvent[];
};

enum NodeType {
    VIA, DASH, UNDERLINE, SHARP, FLAT, DOT, POS_OCTAVE, NEG_OCTAVE
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

const modifierWithVal = {
    '-': NodeType.DASH,
    '*': NodeType.DOT
};

const nodeTypeToLiteral = ['', '-', '_', '#', 'b', '*', '\'', '.'];

interface Node {
    pos: Range;
    parent: Node;
    type: NodeType;
    val?: number;
};

interface NoteNode {
    next: NoteNode;
    sibling: NoteNode;
    parent: Node;
    pos: Range;

    note: number;
    channel: number;
    refCount: number;
}

interface INodeSlot {
    insertNode(node: Node): any;
};

const dummyNodeSlot: INodeSlot = { insertNode(node){} };

function createNoteNode(note: number, pos: Range): NoteNode{
    return { next: null, sibling: null, parent: null, note, pos, channel: 0, refCount: 1 };
}
function createNode(type: NodeType, pos: Range = null): Node{
    return { parent: null, type, pos };
}
function createNodeWithVal(type: NodeType, pos: Range, val: number): Node{
    return { type, parent: null, pos, val };
}

class NoteNodeList {
    head: NoteNode = null;
    tail: NoteNode = null;
    sibling: NoteNode = null;
    topNode: Node = null;

    private _freeChildren: NoteNode[] = [];
    private _copyFrom(list: NoteNodeList){
        this.head = list.head;
        this.tail = list.tail;
        this.sibling = list.sibling;
        this.topNode = list.topNode;
        this._freeChildren = list._freeChildren;
    }
    private _connectTailTo(node: NoteNode){
        this.tail.next = node;
        for (let n of this._freeChildren){
            n.next = node;
        }
        node.refCount = this._freeChildren.length + 1;
        this._freeChildren.length = 0;
    }
    append(node: NoteNode): INodeSlot{
        if (this.head) {
            // this.tail.next = node;
            this._connectTailTo(node);
            this.tail = node;
        }
        else {
            this.sibling = this.head = this.tail = node;
            this.topNode = createNode(NodeType.VIA);
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

                this._freeChildren.push(list.tail);
            }
            else 
                throw 'unreachable';
        }
    }
    concat(list: NoteNodeList): INodeSlot{
        if (list.head){
            if (this.head){
                // this.tail.next = list.head;
                this._connectTailTo(list.head);
                this.tail = list.tail;
                list.topNode.parent = this.topNode;
            }
            else {
                this._copyFrom(list);
                this.topNode = list.topNode.parent = createNode(NodeType.VIA);
            }
            let top = this.topNode;
            let cur = list.topNode;
            return {
                insertNode(node: Node){
                    node.parent = top;
                    cur.parent = node;
                    cur = node;
                }
            };
        }
        else 
            return dummyNodeSlot;
    }
};

const regNum = /[0-9]/;

export function createParser(eReporter: ErrorReporter): Parser{
    let macroExpander: MacroExpander = new MacroExpander(eReporter);
    let defaultOctave = 4;

    macroExpander.macros
    .defineInternalMacros()
    .defineMeta('\\tri');
    
    return { 
        parse,
        parseAndConvert
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

    function parseAndConvert(tkSource: ITokenSource): NoteEvent[]{
        return mergeOverlapedEvents(createNoteQueue(parse(tkSource)));
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
     * ( '_' | '-'+ | '#' | 'b' | '.' | '\'' | '\*'+ )*
     */
    function parseNoteModifiers(slot: INodeSlot){
        let tk = peek();
        while (tk.type === TokenType.OTHER && tk.text !== '|' && modifierToType.hasOwnProperty(tk.text)){
            let type = modifierToType[tk.text];
            if (modifierWithVal.hasOwnProperty(tk.text)){
                let s = tk.text;
                let start = tk, end = tk;
                let num = 1;
                next();
                tk = peek();
                while (tk.text === s){
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

interface ISortedNoteEventQueue {
    pollNote(): NoteEvent;
};

interface NoteWithTime {
    time: number;
    note: Note;
    node: NoteNode;
};

export function createNoteQueue(list: NoteNodeList): ISortedNoteEventQueue{
    let queue: List<NoteWithTime> = new List();

    pushNote(list.head, 0);

    return {
        pollNote
    };

    function getNoteFromNode(node: NoteNode): Note{
        let ret = new Note(node.note);
        for (let n = node.parent; n; n = n.parent){
            switch (n.type){
                case NodeType.DASH:
                    ret.duration *= n.val + 1;
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
                    let factor = 1 << n.val;
                    ret.duration = ret.duration * (2 * factor - 1) / factor;
                    break;
                // VIA has no effect on notes.
            }
        }
        return ret.normalize();
    }
    function pushNote(node: NoteNode, delta: number){
        for (; node; node = node.sibling){
            queue.add({ note: getNoteFromNode(node), time: delta, node });
        }
    }
    
    function pollNote(): NoteEvent {
        do {
            let first: ListNode<NoteWithTime> = queue.head;
            if (first){
                for (let n = first.next; n; n = n.next){
                    if (n.data.time < first.data.time){
                        first = n;
                    }
                }
                let ret = first.data;
                queue.remove(first);
                if (ret.node.next && --ret.node.next.refCount === 0){
                    pushNote(ret.node.next, ret.time + ret.note.duration);
                }
                if (!ret.note.isRest())
                    return ret.note.toEvent(ret.time, ret.node.channel);
            }
            else
                return null;
        } while(true);
    }
}

interface RunningEvent {
    endTime: number;
    event: NoteEvent;
};

function mergeOverlapedEvents(queue: ISortedNoteEventQueue): NoteEvent[]{
    let events: NoteEvent[] = [];
    let running: List<RunningEvent> = new List();
    function emitNote(note: NoteEvent){
        let time = note.time;
        for (let n = running.head; n; n = n.next){
            let n2 = n.data;
            if (time >= n2.endTime)
                running.remove(n);
            else if (n2.event.note === note.note && n2.event.channel === note.channel){
                let l = note.duration - (n2.endTime - time);
                if (l > 0){
                    n2.endTime += l;
                    n2.event.duration += l;
                }
                return;
            }
        }
        running.add({ event: note, endTime: time + note.duration });
        events.push(note);
    }

    let e = queue.pollNote();
    while (e){
        emitNote(e);
        e = queue.pollNote();
    }

    return events;
}