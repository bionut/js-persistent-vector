


var Test = (function () {
    var SIZE = 100000;

    function getRandomInt() {
        return Math.floor(Math.random() * (100)) + 0;
    }

    function getRandomIndex(size) {
        size = size || SIZE;
        return Math.floor(Math.random() * (size)) + 0;
    }
    function check(pv, ar, size) {
        size = size || SIZE;
        for (var i = 0; i < size; i++) {
            if (pv.get(i) != ar[i]) {
                throw new Error('Failed at index ' + i);
            }
        }
    }

    function Test() {
        this.push = function (pv) {
            var ar = [];
            for (var i = 0; i < SIZE; i++) {
                var x = i;
                pv = pv.push(x);
                ar.push(x);
                
                // for (var index = 0; index <= i; index++) {
                //  if( pv.get(index) != ar[index]){
                //     console.log(pv);
                //     throw new Error('Push/get failed index ' + i + 'checking ' + index);
                // }
                // }
            }
            check(pv, ar);


            console.log(pv);
            console.info('Push verified');
            return pv;
        }

        this.set = function (pv) {
            var ar = [];
            for (var i = 0; i < SIZE; i++) {
                pv = pv.push(0);
                ar.push(0);
            }

            for (var i = 0; i < SIZE; i++) {
                var x = getRandomInt();
                pv = pv.set(i, x);
                ar[i] = x;
            }
            check(pv, ar);

            console.log(pv);
            console.info('Set verified');
            return pv;
        }

        this.pop = function (pv) {
            var ar = [];
            for (var i = 0; i < SIZE; i++) {
                var x = getRandomInt();
                pv = pv.push(i);
                ar.push(i);
            }
            for (var i = 0; i < SIZE / 2; i++) {
                pv = pv.pop();
                ar.pop();
            }

            check(pv, ar, ar.length);

            console.log(pv);
            console.info('Pop verified');
            return pv;
        }

        this.transience = function (pv) {
            var ar = [];
            
            // push some stuff
            for (var i = 0; i < SIZE / 2; i++) {
                var x = getRandomInt();
                pv = pv.push(x);
                ar.push(x);
            }
            
            //make transient
            var tv = pv.asTransient();
            
            // push moar
            
            for (var i = 0; i < SIZE / 2; i++) {
                var x = getRandomInt();
                tv = tv.push(x);
                ar.push(x);
            }
            
            //set some random
            for (var i = 0; i < SIZE; i++) {
                var x = getRandomInt();
                var index = getRandomIndex();
                tv.set(index, x);
                ar[index] = x;
            }
            
            for (var i = 0; i < SIZE / 3; i++) {
                tv = tv.pop();
                ar.pop();
            }
            
            check(tv, ar, ar.length);
            pv = tv.asPersistent();
            check(pv, ar, ar.length);
            console.info('Transience interop verified');
        }

    }

    return Test;
})();

var test = new Test();

console.info('Persistent vector tests:');
test.push(new PVec());
test.set(new PVec());
test.pop(new PVec());

console.info('Transient vector tests:')
test.push(new TVec());
test.set(new TVec());
test.pop(new TVec());

console.info('Interop tests: ')
test.transience(new PVec());