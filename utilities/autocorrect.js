
/*
LICENSE: MIT

Copyright (c) 2024 Matthijs Keuper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/ 
 

// AUTOCORRECT will automatically try to match any methods or properties to the object you provide.
 // it will find the _closest_ match.First character must match to the function All characters must be in the correct order.
// if it finds a match, it will bind the method to the object so it does not have to search again next time.
// properties are not bound to the original object, they will be matched every time. so that's slow
// this is more for fun than anyting else. it's pretty risky ; changes in javascript may cause your shortened function to match to a different method.




export let AUTOCORRECT=(e,t=Object,l=e=>t.getPrototypeOf(e),n=(e,l,n=(e,l,n,p=99,r=99,o,g,i=e=>e.length)=>(t.getOwnPropertyNames(l).map(t=>t[0]!==e[0]||i(o=[...t].reduce((t,l,n)=>(l===e[i(t)]&&t.push(n),t),[]))!==i(e)||((g=o[i(o)-1]-o[0])<p||g===p&&i(t)<r)&&(p=g,r=i(t),n=t)),n),p=n(e,l))=>(p&&console.log(e+"="+p),n(e,l)))=>new Proxy(e,{get(e,t){let p=e,r,o=t=>t.apply||(t=p[t])?.apply?t.bind(e):t;do t in p?r=p[t]:(r=n(t,p))&&(p[t]=r);while(!r&&(p=l(p)));return o(r)},set(e,t,p){let r=e,o;do o=t in r?t:n(t,r);while(!o&&(r=l(r)));return o&&(e[o]=p),o}});
       

/*

 let AUTOCORRECT=(e,t=Object,l=e=>t.getPrototypeOf(e),n=(e,l,n=(e,l,n,p=99,r=99,o,g,i=e=>e.length)=>(t.getOwnPropertyNames(l).map(t=>t[0]!==e[0]||i(o=[...t].reduce((t,l,n)=>(l===e[i(t)]&&t.push(n),t),[]))!==i(e)||((g=o[i(o)-1]-o[0])<p||g===p&&i(t)<r)&&(p=g,r=i(t),n=t)),n),p=n(e,l))=>(p&&console.log(e+"="+p),n(e,l)))=>new Proxy(e,{get(e,t){let p=e,r,o=t=>t.apply||(t=p[t])?.apply?t.bind(e):t;do t in p?r=p[t]:(r=n(t,p))&&(p[t]=r);while(!r&&(p=l(p)));return o(r)},set(e,t,p){let r=e,o;do o=t in r?t:n(t,r);while(!o&&(r=l(r)));return o&&(e[o]=p),o}});

 // examples:
        //
        let A = AUTOCORRECT,
            w = A(window),
            d = A(document),
            c = A(d.qS("#canvas")),   // qS-> querySelector
            ctx = A(c.g("2d")),       // g-> getContext
            R = w.Mh.random                     // Mh-> Math

        c.w = w.iW                              // w-> width, iw-> innerwidth
        c.h = w.iH / 2;     
        let                    //  h-> height, iw-> innerHeight
        b = d.crl('button'),        
        b1 = A(b)
        b1.iL = 'click me'
        let nt = A(d.qS("#buttons"))
        nt.apC(b)

        let i = 10, loop = _ => {
            ctx.fS = `rgba(${R() * 255},${R() * 255},${R() * 255},1)`   //  fs-> fillStyle            
            ctx.fR(10 * i, 10 * i, 100 * i, 100 * i),                   //  fR-> fillRect
                (i--) && w.rAF(loop)                                    //  requestAnimationFrame
        }
        loop()

*/



