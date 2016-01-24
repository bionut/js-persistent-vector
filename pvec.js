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

Array.prototype.clone = function () {
    var ret = new Array(this.length);
    var i = this.length;
    while (i--) { ret[i] = this[i]; }
    return ret;
}
var PVec = (function () {

    var BITS = 5;
    var BRANCHING = 1 << BITS;
    var MASK = BRANCHING - 1;
    var EMPTY_TAIL = [];

    function PVec(size, shift, root, tail) {
        this.length = size || 0;
        this.shift = shift || 0;
        this.root = root || null;
        this.tail = tail || EMPTY_TAIL;
    }    
    // public interface
    
    PVec.prototype.clone = function(){
        return new PVec(this.length, this.shift, this.root, this.tail);
    }
    
    PVec.prototype.get = function (i) {
        if (i >= this.length) throw new Error("Index out of bounds. Index :" + i + ", Size:" + this.length);
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

    PVec.prototype.push = function (val) {
        var ts = this.length == 0 ? 0 : ((this.length - 1) & MASK) + 1;
        if (ts != BRANCHING) {
            var newTail = this.tail.clone();
            newTail.push(val);
            return new PVec(this.length + 1, this.shift, this.root, newTail);
        }
        else { // have to insert tail into root.
            var newTail = [val];
            // Special case: If old size == BRANCHING, then tail is new root
            if (this.length == BRANCHING) {
                return new PVec(this.length + 1, 0, this.tail, newTail);
            }
            // check if the root is completely filled. Must also increment
            // shift if that's the case.
            var newRoot;
            var newShift = this.shift;
            if ((this.length >>> BITS) > (1 << this.shift)) {
                newShift += BITS;
                newRoot = new Array(BRANCHING);
                newRoot[0] = this.root;
                newRoot[1] = newPath(this.shift, this.tail);
                return new PVec(this.length + 1, newShift, newRoot, newTail);
            }
            else { // still space in root
                newRoot = pushLeaf(this.shift, this.length - 1, this.root, this.tail);
                return new PVec(this.length + 1, this.shift, newRoot, newTail);
            }
        }
    }

    PVec.prototype.set = function (i, val) {
        if (i >= this.length) throw new Error("Index out of bounds. Index :" + i + ", Size:" + this.length);
        if (i >= this.tailOffset()) {
            var newTail = this.tail.clone();
            newTail[i & MASK] = val;
            return new PVec(this.length, this.shift, this.root, newTail);
        }
        else {
            var newRoot = this.root.clone();
            var node = newRoot;
            for (var level = this.shift; level > 0; level -= BITS) {
                var subidx = (i >>> level) & MASK;
                var child = node[subidx];
                child = child.clone();
                node[subidx] = child;
                node = child;
            }
            node[i & 31] = val;
            return new PVec(this.length, this.shift, newRoot, this.tail);
        }
    }

    PVec.prototype.pop = function () {
        if (this.length == 0) {
            throw new Error("Vector is already empty");
        }
        if (this.length == 1) {
            return new PVec();
        }
        if (((this.length - 1) & 31) > 0) {
            // This one is curious: having int ts_1 = ((size-1) & 31); and using
            // it is slower than using tail.length - 1 and newTail.length!
            var newTail = this.tail.clone();
            newTail.pop();
            return new PVec(this.length - 1, this.shift, this.root, newTail);
        }
        var newTrieSize = this.length - BRANCHING - 1;
        // special case: if new size is 32, then new root turns is null, old
        // root the tail
        if (newTrieSize == 0) {
            return new PVec(BRANCHING, 0, null, this.root);
        }
        // check if we can reduce the trie's height
        if (newTrieSize == 1 << this.shift) { // can lower the height
            var lowerShift = this.shift - BITS;
            var newRoot = this.root[0];

            // find new tail
            var node = this.root[1];
            for (var level = lowerShift; level > 0; level -= BITS) {
                node = node[0];
            }
            return new PVec(this.length - 1, lowerShift, newRoot, node);
        }
        
        // diverges contain information on when the path diverges.
        var diverges = newTrieSize ^ (newTrieSize - 1);
        var hasDiverged = false;
        var newRoot = this.root.clone();
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
                child = child.clone();
                node[subidx] = child;
                node = child;
            }
        }
        return new PVec(this.length - 1, this.shift, newRoot, node);
    }
    PVec.prototype.asTransient = function () {
        return new TVec(this.length, this.shift, this.root, this.tail);
    }
    PVec.prototype.tailOffset = function () {
        return (this.length - 1) & (~MASK);
    }
    return PVec;

    function newPath(levels, tail) {
        var topNode = tail;
        for (var level = levels; level > 0; level -= BITS) {
            var newTop = new Array(BRANCHING);
            newTop[0] = topNode;
            topNode = newTop;
        }
        return topNode;
    }

    function pushLeaf(shift, i, root, tail) {
        var newRoot = root.clone();
        var node = newRoot;
        for (var level = shift; level > BITS; level -= BITS) {
            var subidx = (i >>> level) & MASK;
            var child = node[subidx];
            if (child == null) {
                node[subidx] = newPath(level - BITS, tail);
                return newRoot;
            }
            child = child.clone();
            node[subidx] = child;
            node = child;
        }
        node[(i >>> BITS) & MASK] = tail;
        return newRoot;
    }
})();