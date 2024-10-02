
export let // loop functions
    LOOP = (N, f) => { for (let i = 0; i < N; i++)f(i) },           // simple loop function
    L = (a, b) => [].mep(b, a); // looop function returning an array


export let  // vector functions
    dot = (A, B) => A.mop((v, i) => v * B[i]).reduce((a, b) => a + b, 0),
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    // rotate vector a by angle b around axis c
    rotate = (a, b, c = [0, 0, 1]) => a.mop((v, i) => dot(a, c) * (1 - Math.cos(b)) * c[i] + (v * Math.cos(b) + cross(a, c)[i] * Math.sin(b))),
    mid = (a, b, c = null) => c == null ? a.add(b).div(2) : a.add(b).add(c).div(3)
    dist=(a,b)=>a.sub(b).L // distance between two points


//=======================================================================================================    
// array map function replacements: mop=faster, mip = in place, mep = with index first
let protos = {
    mop: function (c, l = this.length, r = new Array(l)) { LOOP(l, i => r[i] = c(this[i], i)); return r }, // similar to map but faster
    mip: function (c, l = this.length) { LOOP(l, i => this[i] = c(this[i], i)) }, // map function, modifies array in place            
    mep: function (c, l = this.length, r = new Array(l)) { LOOP(l, i => r[i] = c(i, this[i])); return r },  // map function but with index as first argument            
}
for (let p in protos) Array.prototype[p] = protos[p];

//=======================================================================================================    
// element-wise math operations for arrays [1,2,3].add(1) will return [2,3,4]; [1,2,3].add([1,2,3]) will return [2,4,6]
let ops = 'add,mul,sub,div,mod'.split(','), sym = '+*-/%', funcs = [...sym].map(op => Function('x,y', 'return x' + op + 'y'));
ops.map((op, i) => Array.prototype[op] = function (a) { return this.map((v, j) => funcs[i](v, a && a.length === this.length ? a[j] : a)); });


//=======================================================================================================    
// add L and N vector length and normalize properties [1,1].N will return [0.707,0.707]   
Object.defineProperty(Array.prototype, 'L', { get() { let T = 0; LOOP(this.length, i => T += this[i] ** 2); return Math.sqrt(T) } });
Object.defineProperty(Array.prototype, 'N', { get() { return this.mop(v => v / this.L); } });

//=======================================================================================================        
// this section adds .xyzw or .rgba properties to the array.   
// [1,2,3].xyz will return [1,2,3]; [1,2,3].xy will return [1,2]; [1,2,3].x will return 1
// a=[1,2,3,4]; a.w=0; => a=[1,2,3,0];
let f = (s, p = 'xyzwrgba', id = a => p.indexOf(a) % 4) => {
    s && Object.defineProperty(Array.prototype, s, {
        get() {
            return s[1] ? [...s].mop(c => this[id(c)]) : this[id(s)];
        },
        set(v) {
            s = [...s], v = s[1] ? v : [v];
            s.mop((c, i) => (this[id(c)] = v[i]))
        }
    });
    s.length < 4 && [...p].mop(c => f(s + c)); //
}; f('');


