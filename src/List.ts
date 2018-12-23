export interface ListNode<T> {
    data: T;
    prev: ListNode<T>;
    next: ListNode<T>;
};
export class List<T> {
    head: ListNode<T> = null;
    tail: ListNode<T> = null;
    remove(node: ListNode<T>){
        if (node.prev)
            node.prev.next = node.next;
        if (node.next)
            node.next.prev = node.prev;
        if (node === this.head)
            this.head = node.next;
        if (node === this.tail)
            this.tail = node.prev;
    }
    add(data: T){
        let node: ListNode<T> = { data, prev: this.tail, next: null };
        if (!this.head)
            this.head = node;
        if (this.tail)
            this.tail.next = node;
        this.tail = node;
    }
    forEach(cb: (data: T, node: ListNode<T>) => any){
        for (let n = this.head; n; n = n.next){
            cb(n.data, n);
        }
    }
}