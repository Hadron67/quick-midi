/*
    \c{1} {5.12}_ 233 123255 56771'1' {2321}' 7
    \c{2} 
*/
import { Note, MidiEventType, MidiEvent, createNoteOnEvent, createNoteOffEvent, createTempoChangeEvent, MidiFile, Track, NoteOnEvent } from "./Sequence";
import { ITokenSource, TokenType, Token, Range } from "./Token";
import { MacroExpander } from "./MacroExpaner";
import { ErrorReporter } from "./ErrorReporter";
import { List, ListNode } from "./List";

export interface Parser {
    parse(tkSource: ITokenSource): MidiFile;
};

enum ModifierNodeType {
    VIA, DASH, UNDERLINE, SHARP, FLAT, DOT, POS_OCTAVE, NEG_OCTAVE
};

const modifierToType = {
    '_': ModifierNodeType.UNDERLINE,
    '-': ModifierNodeType.DASH,
    '#': ModifierNodeType.SHARP,
    'b': ModifierNodeType.FLAT,
    '.': ModifierNodeType.NEG_OCTAVE,
    '\'': ModifierNodeType.POS_OCTAVE,
    '*': ModifierNodeType.DOT
};

const modifierWithVal = {
    '-': ModifierNodeType.DASH,
    '*': ModifierNodeType.DOT
};

const modifierNodeTypeToLiteral = ['', '-', '_', '#', 'b', '*', '\'', '.'];

interface ModifierNode {
    pos: Range;
    parent: ModifierNode;
    type: ModifierNodeType;
    val?: number;
};

enum EventNodeType {
    NOTE, REST, TEMPO_CHANGE
};

interface EventNodeBase {
    type: EventNodeType;
    next: EventNode;
    sibling: EventNode;
    parent: ModifierNode;
    pos: Range;
    refCount: number;
    channel: number;
}

interface NoteEventNode extends EventNodeBase {
    type: EventNodeType.NOTE;
    note: number;
    velocity: number;
}

interface TempoChangeEventNode extends EventNodeBase {
    type: EventNodeType.TEMPO_CHANGE;
    tempo: number;
}

interface RestEventNode extends EventNodeBase {
    type: EventNodeType.REST;
};

type EventNode = NoteEventNode | TempoChangeEventNode | RestEventNode;

function createNoteNode(note: number, velocity: number, pos: Range): NoteEventNode{
    return { type: EventNodeType.NOTE, next: null, sibling: null, parent: null, note, pos, velocity, channel: 0, refCount: 1 };
}
function createModifierNode(type: ModifierNodeType, pos: Range = null): ModifierNode{
    return { parent: null, type, pos };
}
function createModifierNodeWithVal(type: ModifierNodeType, pos: Range, val: number): ModifierNode{
    return { type, parent: null, pos, val };
}
function createRestEventNode(pos: Range): RestEventNode{
    return { type: EventNodeType.REST, next: null, sibling: null, parent: null, pos, refCount: 1, channel: 0 };
}

interface INodeSlot {
    insertNode(node: ModifierNode): any;
};

const dummyNodeSlot: INodeSlot = { insertNode(node){} };

type VoiceMap = {[name: string]: EventNodeList};

interface NodeTrack {
    name: string;
    instrument: number;
    voices: VoiceMap;
};

type TrackMap = {[name: string]: NodeTrack};

class EventNodeList {
    head: EventNode = null;
    tail: EventNode = null;
    sibling: EventNode = null;
    topNode: ModifierNode = null;

    private _freeChildren: EventNode[] = [];
    private _copyFrom(list: EventNodeList){
        this.head = list.head;
        this.tail = list.tail;
        this.sibling = list.sibling;
        this.topNode = list.topNode;
        this._freeChildren = list._freeChildren;
    }
    private _connectTailTo(node: EventNode){
        this.tail.next = node;
        for (let n of this._freeChildren){
            n.next = node;
        }
        node.refCount = this._freeChildren.length + 1;
        this._freeChildren.length = 0;
    }
    append(node: EventNode): INodeSlot{
        if (this.head) {
            // this.tail.next = node;
            this._connectTailTo(node);
            this.tail = node;
        }
        else {
            this.sibling = this.head = this.tail = node;
            this.topNode = createModifierNode(ModifierNodeType.VIA);
        }
        let top = node.parent = this.topNode;
        let cur: ModifierNode = null;
        return {
            insertNode(n: ModifierNode){
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
    appendChild(list: EventNodeList, notDiverse = false){
        if (list.head){
            if (this.head){
                this.sibling.sibling = list.head;
                this.sibling = list.sibling;
                list.topNode.parent = this.topNode;

                notDiverse || this._freeChildren.push(list.tail);
            }
            else {
                this._copyFrom(list);
                this.topNode = list.topNode.parent = createModifierNode(ModifierNodeType.VIA);
            }
        }
    }
    concat(list: EventNodeList): INodeSlot{
        if (list.head){
            if (this.head){
                // this.tail.next = list.head;
                this._connectTailTo(list.head);
                this.tail = list.tail;
                list.topNode.parent = this.topNode;
            }
            else {
                this._copyFrom(list);
                this.topNode = list.topNode.parent = createModifierNode(ModifierNodeType.VIA);
            }
            let top = this.topNode;
            let cur = list.topNode;
            return {
                insertNode(node: ModifierNode){
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

const regDigit = /[0-9]/;
const regNum = /^[0-9]+$/;

interface ParserResult {
    tracks: TrackMap;
    tempo: number;
};

export function createParser(eReporter: ErrorReporter): Parser{
    let macroExpander: MacroExpander = new MacroExpander(eReporter);
    let defaultOctave = 4;
    let velocity = 80;

    macroExpander.macros
    .defineInternalMacros()
    .defineMeta('\\tempo')
    .defineMeta('\\keysig')
    .defineMeta('\\track')
    .defineMeta('\\v')
    .defineMeta('\\instrument');
    
    return { 
        parse
    };

    function next(){
        return macroExpander.nextToken();
    }

    function peek(){
        return macroExpander.peekToken();
    }
    function isMacro(tk: Token, name: string){
        return tk.type === TokenType.MACRO && tk.text === '\\' + name;
    }
    function readArg(){
        let tks = macroExpander.readPossibleGroup(next(), false);
        if (tks[0].type === TokenType.EOF){
            eReporter.complationError('argument expected', tks[0]);
            tks[0].text = '';
            return tks[0];
        }
        else if (tks.length === 1){
            return tks[0];
        }
        else {
            let text = '';
            for (let i = 1; i < tks.length - 1; i++){
                text += tks[i].getText();
            }
            return new Token(TokenType.OTHER, text, tks[1].start, tks[tks.length - 2].end, tks[0].hasWhiteSpace);
        }
    }

    function parse(tkSource: ITokenSource): MidiFile{
        macroExpander.init(tkSource);

        let { tracks, tempo } = parseTop();
        let file = new MidiFile();
        file.startTempo = tempo;

        for (let name in tracks){
            file.tracks.push(convertTrack(tracks[name]));
        }

        return file;
    }

    function convertTrack(track: NodeTrack): Track {
        let list = new EventNodeList();
        for (let l in track.voices){
            list.appendChild(track.voices[l], true);
        }
        return { 
            name: track.name, 
            instrument: track.instrument, 
            events: pollAllEvents(createOverlappedEventMerger(createNoteQueue(list)))
        };
    }

    function parseTop(): ParserResult {
        let ret: ParserResult = { tracks: {}, tempo: 500 };
        let tracks = ret.tracks;

        parseFileOptions(ret);

        let tk = peek();
        if (tk.type !== TokenType.EOF){
            let track: NodeTrack, name: string;
            if (!isMacro(tk, 'track')){
                name = 'Track 1';
                if (!tracks.hasOwnProperty(name)){
                    parseTrackContent(tracks[name] = { name, instrument: -1, voices: {} });
                }
                else
                    parseTrackContent(tracks[name]);
                tk = peek();
            }
            while (isMacro(tk, 'track')){
                next();
                name = readArg().text;
                if (!tracks.hasOwnProperty(name)){
                    parseTrackContent(tracks[name] = { name, instrument: -1, voices: {} });
                }
                else
                    parseTrackContent(tracks[name]);
                tk = peek();
            }
        }

        return ret;
    }

    function parseFileOptions(mf: ParserResult){
        let tk = peek();
        while (true){
            if (isMacro(tk, 'tempo')){
                next();
                let n = readArg();
                if (regNum.test(n.text)) {
                    let tempo = Number(n.text);
                    if (tempo > 0xffffff)
                        eReporter.complationError('Tempo value to large, should be less than 0xffffff', n);
                    else
                        mf.tempo = tempo;
                }
            }
            else
                break;
            tk = peek();
        }
    }

    function isTrackEnd(tk: Token){
        return tk.type === TokenType.EOF ||
        isMacro(tk, 'track');
    }

    function parseTrackContent(track: NodeTrack){
        parseTrackOptions(track);
        let tk = peek();

        if (!isTrackEnd(tk)){
            if (!isMacro(tk, 'v')){
                if (!track.voices['1'])
                    (track.voices['1'] = new EventNodeList()).concat(parseSequence());
                else
                    track.voices['1'].concat(parseSequence());
                tk = peek();
            }
            while (isMacro(tk, 'v')){
                next();
                let name = readArg();
                if (!track.voices[name.text])
                    (track.voices[name.text] = new EventNodeList()).concat(parseSequence());
                else
                    track.voices[name.text].concat(parseSequence());
                tk = peek();
            }
        }
    }

    function parseTrackOptions(track: NodeTrack){
        let tk = peek();
        track.instrument = 0;
        while (true){
            if (isMacro(tk, 'instrument')) {
                next();
                let name = readArg();
                if (regNum.test(name.text))
                    track.instrument = Number(name.text);
                else {
                    eReporter.complationError(`Unknown instrument number ${name.text}`, name);
                    track.instrument = 0;
                }
                tk = peek();
            }
            else
                break;
        }
    }

    /**
     * '{' Sequence ( '|' Sequence )* '}'
     */
    function parseGroup(): EventNodeList {
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

    function isSequenceEnd(tk: Token){
        return tk.type === TokenType.EOF || 
        tk.type === TokenType.EGROUP || 
        tk.type === TokenType.OTHER && tk.text === '|' ||
        isMacro(tk, 'v') ||
        isMacro(tk, 'track');
    }
    /**
     * ( (Note | Group) NoteModifiers )*
     */
    function parseSequence(): EventNodeList{
        let tk = peek();
        let list = new EventNodeList();
        while (!isSequenceEnd(tk)){
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

    function parseNote(tk: Token): EventNode{
        if (regDigit.test(tk.text)){
            next();
            let n = Number(tk.text);
            if (n >= 1 && n <= 7){
                return createNoteNode(Note.numberToNote(n, defaultOctave), velocity,tk);
            }
            else if (n === 0){
                return createRestEventNode(tk);
            }
            else {
                eReporter.complationError(`Unknown note "${n}", valid notes are 0-7`, tk);
                return createNoteNode(-1, 0, tk);
            }
        }
        else {
            next();
            eReporter.complationError('Note expected', tk);
            return createNoteNode(-1, 0, tk);
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
                slot.insertNode(createModifierNodeWithVal(type, Range.between(start, end), num));
            }
            else {
                slot.insertNode(createModifierNode(modifierToType[tk.text], tk));
                next();
                tk = peek();
            }
        }
    }
}

function getModifiers(note: NoteEventNode): string{
    let s = '';
    for (let n = note.parent; n; n = n.parent){
        s += modifierNodeTypeToLiteral[n.type];
    }
    return s;
}
export function dumpNoteList(list: EventNodeList): string[]{
    let s = '';
    for (let node = list.head; node; node = node.next){
        if (node.type === EventNodeType.NOTE){
            s += node.note + getModifiers(node) + ' ';
        }
    }
    return [s];
}

interface ISortedNoteEventQueue {
    pollNote(): MidiEvent;
};

interface NodeWithEvent {
    node: EventNode;
    event: MidiEvent;
};

export function createNoteQueue(list: EventNodeList): ISortedNoteEventQueue{
    let queue: List<NodeWithEvent> = new List();
    let lastDelta = 0;

    pushNote(list.head, 0);

    return {
        pollNote
    };

    function getNoteFromNode(node: NoteEventNode | RestEventNode): Note{
        let ret = new Note(node.type === EventNodeType.NOTE ? node.note : Note.REST);
        for (let n = node.parent; n; n = n.parent){
            switch (n.type){
                case ModifierNodeType.DASH:
                    ret.duration *= n.val + 1;
                    break;
                case ModifierNodeType.UNDERLINE:
                    ret.duration >>= 1;
                    break;
                case ModifierNodeType.POS_OCTAVE:
                    ret.shiftOctave(1);
                    break;
                case ModifierNodeType.NEG_OCTAVE:
                    ret.shiftOctave(-1);
                    break;
                case ModifierNodeType.SHARP:
                    ret.shift(1);
                    break;
                case ModifierNodeType.FLAT:
                    ret.shift(-1);
                    break;
                case ModifierNodeType.DOT:
                    let factor = 1 << n.val;
                    ret.duration = ret.duration * (2 * factor - 1) / factor;
                    break;
                // VIA has no effect on notes.
            }
        }
        return ret.normalize();
    }
    function pushNote(node: EventNode, delta: number){
        if (node && --node.refCount === 0){
            let stack: { node: EventNode, delta: number }[] = [{ node, delta }];
            while (stack.length > 0){
                let top = stack.pop();
                delta = top.delta;
                for (node = top.node; node; node = node.sibling){
                    if (node.type === EventNodeType.NOTE){
                        let note = getNoteFromNode(node);
                        queue.add({ node: null, event: createNoteOnEvent(note.note, delta, node.channel, node.velocity) });
                        queue.add({ node, event: createNoteOffEvent(note.note, delta + note.duration, node.channel, node.velocity) });
                    }
                    else if (node.type === EventNodeType.REST){
                        if (node.next && --node.next.refCount === 0){
                            let note = getNoteFromNode(node);
                            stack.push({ node: node.next, delta: delta + note.duration });
                        }
                    }
                    else if (node.type === EventNodeType.TEMPO_CHANGE){
                        queue.add({ node, event: createTempoChangeEvent(node.tempo, delta, node.channel) });
                    }
                    else
                        throw new Error('unreachable');
                }
            }
        }
    }
    
    function pollNote(): MidiEvent {
        let first: ListNode<NodeWithEvent> = queue.head;
        if (first){
            for (let n = first.next; n; n = n.next){
                if (n.data.event.delta < first.data.event.delta){
                    first = n;
                }
            }
            let ret = first.data;
            queue.remove(first);
            queue.forEach(n => n.event.delta -= ret.event.delta);
            if (ret.node){
                pushNote(ret.node.next, 0);
            }
            return ret.event;
        }
        else
            return null;
    }
}

function createMidiEventFilter(queue: ISortedNoteEventQueue, filter: (event: MidiEvent) => boolean): ISortedNoteEventQueue{
    return {
        pollNote(){
            let event = queue.pollNote();
            let delta = 0;
            while (event && filter(event)){
                delta += event.delta;
                event = queue.pollNote();
            }
            if (event)
                event.delta += delta;
            return event;
        }
    };
}

function createOverlappedEventMerger(queue: ISortedNoteEventQueue): ISortedNoteEventQueue{
    let noteRefCounts: number[] = [];
    for (let i = 0; i < Note.NOTE_COUNT; i++){
        noteRefCounts.push(0);
    }
    return createMidiEventFilter(queue, event => {
        if (event.type === MidiEventType.NOTEON) {
            return noteRefCounts[event.note]++ !== 0;
        }
        else if (event.type === MidiEventType.NOTEOFF){
            return --noteRefCounts[event.note] !== 0;
        }
        else
            return false;
    });
}

function pollAllEvents(queue: ISortedNoteEventQueue): MidiEvent[]{
    let events: MidiEvent[] = [];
    let event = queue.pollNote();
    while (event){
        events.push(event);
        event = queue.pollNote();
    }
    return events;
}
