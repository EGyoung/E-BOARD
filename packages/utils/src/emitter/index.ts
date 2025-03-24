export interface IDisposable {
    dispose(): void;
  }
  
  export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: any): IDisposable;
  }
  
  export type SheEvent<T = any> = Event<T>;
  
  export type Listener<T> = [(e: T) => void, any] | ((e: T) => void);
  
  export interface EmitterOptions {
    leakWarningThreshold?: number;
    emitType?: string;
  }
  
  class Node<E> {
    static readonly Undefined = new Node<any>(undefined);
  
    element: E;
    next: Node<E>;
    prev: Node<E>;
  
    constructor(element: E) {
      this.element = element;
      this.next = Node.Undefined;
      this.prev = Node.Undefined;
    }
  }
  
  class LinkedList<E> {
    private _first: Node<E> = Node.Undefined;
    private _last: Node<E> = Node.Undefined;
    private _size = 0;
  
    get size(): number {
      return this._size;
    }
  
    isEmpty(): boolean {
      return this._first === Node.Undefined;
    }
  
    clear(): void {
      let node = this._first;
      while (node !== Node.Undefined) {
        const next = node.next;
        node.prev = Node.Undefined;
        node.next = Node.Undefined;
        node = next;
      }
  
      this._first = Node.Undefined;
      this._last = Node.Undefined;
      this._size = 0;
    }
  
    unshift(element: E): () => void {
      return this._insert(element, false);
    }
  
    push(element: E): () => void {
      return this._insert(element, true);
    }
  
    private _insert(element: E, atTheEnd: boolean): () => void {
      const newNode = new Node(element);
      if (this._first === Node.Undefined) {
        this._first = newNode;
        this._last = newNode;
      } else if (atTheEnd) {
        // push
        const oldLast = this._last!;
        this._last = newNode;
        newNode.prev = oldLast;
        oldLast.next = newNode;
      } else {
        // unshift
        const oldFirst = this._first;
        this._first = newNode;
        newNode.next = oldFirst;
        oldFirst.prev = newNode;
      }
      this._size += 1;
  
      let didRemove = false;
      return () => {
        if (!didRemove) {
          didRemove = true;
          this._remove(newNode);
        }
      };
    }
  
    shift(): E | undefined {
      if (this._first === Node.Undefined) {
        return undefined;
      } else {
        const res = this._first.element;
        this._remove(this._first);
        return res;
      }
    }
  
    pop(): E | undefined {
      if (this._last === Node.Undefined) {
        return undefined;
      } else {
        const res = this._last.element;
        this._remove(this._last);
        return res;
      }
    }
  
    private _remove(node: Node<E>): void {
      if (node.prev !== Node.Undefined && node.next !== Node.Undefined) {
        // middle
        const anchor = node.prev;
        anchor.next = node.next;
        node.next.prev = anchor;
      } else if (node.prev === Node.Undefined && node.next === Node.Undefined) {
        // only node
        this._first = Node.Undefined;
        this._last = Node.Undefined;
      } else if (node.next === Node.Undefined) {
        // last
        this._last = this._last!.prev!;
        this._last.next = Node.Undefined;
      } else if (node.prev === Node.Undefined) {
        // first
        this._first = this._first!.next!;
        this._first.prev = Node.Undefined;
      }
  
      // done
      this._size -= 1;
    }
  
    *[Symbol.iterator](): Iterator<E> {
      let node = this._first;
      while (node !== Node.Undefined) {
        yield node.element;
        node = node.next;
      }
    }
  }
  
  export class Emitter<T> {
    private readonly _options?: EmitterOptions;
    private _event?: Event<T>;
    protected _listeners?: LinkedList<Listener<T>>;
    private _deliveryQueue?: LinkedList<[Listener<T>, T]>;
  
    constructor(options?: EmitterOptions) {
      this._options = options;
    }
    get event(): Event<T> {
      if (!this._event) {
        this._event = (
          listener: (e: T) => any,
          thisArgs?: any,
          disposables?: any,
        ) => {
          if (!this._listeners) {
            this._listeners = new LinkedList();
          }
          const remove = this._listeners.push(
            !thisArgs ? listener : [listener, thisArgs],
          );
  
          const result = {
            dispose: () => {
              remove();
            },
          };
          return result;
        };
      }
      return this._event;
    }
    fire(event: T): void {
      if (this._listeners) {
        if (!this._deliveryQueue) {
          this._deliveryQueue = new LinkedList();
        }
        for (const listener of this._listeners) {
          this._deliveryQueue.push([listener, event]);
        }
  
        while (this._deliveryQueue.size > 0) {
          const [listener, event] = this._deliveryQueue.shift()!;
          try {
            if (typeof listener === 'function') {
              listener.call(undefined, event);
            } else {
              listener[0].call(listener[1], event);
            }
          } catch (e: any) {
            console.error('catch error: ', e);
          }
        }
      }
    }
  
    dispose() {
      this._listeners?.clear();
      this._deliveryQueue?.clear();
    }
  }
  