function getRandomInt() {
    return Math.floor(Math.random() * (100)) + 0;
}

var Test = (function () {
    var SIZE = 100000;

    function Test() {
        this.push = function () {
            var pv = new PVec();
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

            for (var i = 0; i < SIZE; i++) {
                if (pv.get(i) != ar[i]) {
                    throw new Error('Push/get failed index ' + i);
                }
            }

            console.log(pv);
            console.info('Push verified');
        }

        this.set = function () {
            var pv = new PVec();
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
            for (var i = 0; i < SIZE; i++) {
                if (pv.get(i) != ar[i]) {
                    throw new Error('Set failed index ' + i);
                }
            }

            console.log(pv);
            console.info('Set verified');
        }
        
        this.pop = function() {
            var pv = new PVec();
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
            
            for (var i = 0; i < ar.length; i++) {
                if (pv.get(i) != ar[i]) {
                    throw new Error('Pop failed index ' + i);
                }
            }
            
             console.log(pv);
            console.info('Pop verified');
        }

    }

    return Test;
})();

var test = new Test();
test.push();
test.set();
test.pop();