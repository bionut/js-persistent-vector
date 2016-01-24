/*
 * The MIT License
 * 
 *  Copyright (c) 2016 Ionut Balcau
 * 
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 * 
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 * 
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

var TVec = (function () {

    var BITS = 5;
    var BRANCHING = 1 << BITS;
    var MASK = BRANCHING - 1;
    var EMPTY_TAIL = [];

    function TVec(size, shift, root, tail) {
        this.id = newId();
        this.size = size || 0;
        this.shift = shift || 0;
        this.root = root || null;
        this.tail = tail ? expandNode(tail, this.id) : newNode();
    }    
    // public interface
    
    TVec.prototype.set = function (i, val) {
        if (i >= this.size) throw new Error("Index out of bounds. Index :" + i + ", Size:" + this.size);
        if (i >= this.tailOffset()) {
            this.tail[i & MASK] = val;
            return this;
        }
        else {
            this.root = ensureEditable(this.root, this.id);
            var node = this.root;
            for (var level = this.shift; level > 0; level -= BITS) {
                var subidx = (i >>> level) & MASK;
                var child = node[subidx];
                child = ensureEditable(child, this.id);
                node[subidx] = child;
                node = child;
            }
            node[i & MASK] = val;
            return this;
        }
    }



    TVec.prototype.get = function (i) {
        if (i >= this.size) throw new Error("Index out of bounds. Index :" + i + ", Size:" + this.size);
        if (i >= this.tailOffset()) {
            return this.tail[i & MASK];
        }
        else {
            var node = this.root;
            for (var level = this.shift; level > 0; level -= BITS) {
                node = node[(i >>> level) & MASK];
            }
            return node[i & MASK];
        }
    }

    TVec.prototype.pop = function () {
        if (this.size == 0) {
            throw new Error("Vector is already empty");
        }
        if (this.size == 1) {
            this.size = 0;
            return this;
        }
        if (((this.size - 1) & 31) > 0) {
            this.size--;
            return this;
        }
        else { // has to find new tail
            var newTrieSize = this.size - BRANCHING - 1;
            // special case: if new size is 32, then new root turns is null, old
            // root the tail
            if (newTrieSize == 0) {
                this.shift = 0;
                this.size = BRANCHING;
                this.tail = this.root;
                this.root = null;
                return this;
            }
            // check if we can reduce the trie's height
            if (newTrieSize == 1 << this.shift) { // can lower the height
                this.shift -= BITS;
                var newRoot = this.root[0];

                // find new tail
                var node = this.root[1];
                for (var level = this.shift; level > 0; level -= BITS) {
                    node = node[0];
                }
                this.size--;
                this.root = newRoot;
                this.tail = node;
                return this;
            } else { // height is same
                // diverges contain information on when the path diverges.
                var diverges = newTrieSize ^ (newTrieSize - 1);
                var hasDiverged = false;
                var newRoot = ensureEditable(this.root, this.id);
                var node = newRoot;
                for (var level = this.shift; level > 0; level -= BITS) {
                    var subidx = (newTrieSize >>> level) & MASK;
                    var child = node[subidx];
                    if (hasDiverged) {
                        node = child;
                    } else if ((diverges >>> level) != 0) {
                        hasDiverged = true;
                        node[subidx] = null;
                        node = child;
                    } else {
                        child = ensureEditable(child, this.id);
                        node[subidx] = child;
                        node = child;
                    }
                }
                this.root = newRoot;
                this.tail = node;
                this.size--;
                return this;
            }
        }
    }

    TVec.prototype.push = function (val) {
        var ts = this.tailSize();
        if (ts != BRANCHING) {
            this.tail[ts] = val;
            this.size++;
            return this;
        }
        else { // have to insert tail into root.
            var newTail = newNode(this.id);
            newTail[0] = val;
            // Special case: If old size == BRANCHING, then tail is new root
            if (this.size == BRANCHING) {
                this.size++;
                this.root = this.tail;
                this.tail = newTail;
                return this;
            }
            // check if the root is completely filled. Must also increment
            // shift if that's the case.
            if ((this.size >>> BITS) > (1 << this.shift)) {
                var newRoot = newNode(this.id);
                newRoot[0] = this.root;
                newRoot[1] = newPath(this.shift, this.tail, this.id);
                this.shift += BITS;
                this.size++;
                this.root = newRoot;
                this.tail = newTail;
                return this;
            }
            else { // still space in root
                this.root = pushLeaf(this.shift, this.size - 1, this.root, this.tail, this.id);
                this.tail = newTail;
                this.size++;
                return this;
            }
        }
    }

    TVec.prototype.asPersistent = function (){
        this.id = null;
        return new PVec(this.size, this.shift, this.root, this.compressedTail());
    }
    
    TVec.prototype.compressedTail = function () {
        var ts = this.tailSize();
        var compressed = new Array(ts);
        var i = ts;
        while(i--) {
            compressed[i] = this.tail[i];
        }
        return compressed;
    }
    
    TVec.prototype.tailSize = function () {
        return this.size == 0 ? 0 : ((this.size - 1) & MASK) + 1;
    }


    TVec.prototype.tailOffset = function () {
        return (this.size - 1) & (~MASK);
    }
    return TVec;

    function newPath(levels, tail, id) {
        var topNode = tail;
        for (var level = levels; level > 0; level -= BITS) {
            var newTop = newNode(id);
            newTop[0] = topNode;
            topNode = newTop;
        }
        return topNode;
    }

    function pushLeaf(shift, i, root, tail, id) {
        var newRoot = ensureEditable(root, id);
        var node = newRoot;
        for (var level = shift; level > BITS; level -= BITS) {
            var subidx = (i >>> level) & MASK;
            var child = node[subidx];
            if (child == null) {
                node[subidx] = newPath(level - BITS, tail, id);
                return newRoot;
            }
            child = ensureEditable(child, id);
            node[subidx] = child;
            node = child;
        }
        node[(i >>> BITS) & MASK] = tail;
        return newRoot;
    }

    function newNode(id) {
        var node = new Array(BRANCHING + 1);
        node[BRANCHING] = id;
        return node;
    }

    function expandNode(node, id) {
        var expanded = node.clone();
        expanded[BRANCHING] = id;
        return expanded;
    }

    function ensureEditable(node, id) {
        if (node[BRANCHING] == id) {
            return node;
        }
        else {
            return expandNode(node, id);
        }
    }

    function newId() {
        return new Object();
    }
})();