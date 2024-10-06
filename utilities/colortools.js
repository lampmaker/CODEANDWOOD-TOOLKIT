


import { L, dist } from './arraytools.js';
let {min,max,floor} = Math;

export let

    //==================================================================================================
    // conmverts named color to rgb or rgba array
    // eg colorName = 'red' => [255, 0, 0]   
    toHEXcolor = (color) => {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        return ctx.fillStyle;
    },
    //==================================================================================================
    // converts rgb or rgba array to hex color.
    a2h = (...a) => "#" + [...a.flat()].map(e => floor(min(e, 255)).toString(16).padStart(2, 0)).join(""),

    //==================================================================================================
    // converts hex color to rgb or rgba array
    h2a = (n, t = 255) => (n.match(/[a-f0-9]{2}/gi) || []).map(n => parseInt(n, 16) / t),  // hex to array



    //================================================================================================
    //  // creates an array of n colors from objects in an array, using the k-means algorithm. it works by  
    // the colors are returned as an array of rgb values 0..1       
    //================================================================================================    
    getColorQuants = (colorArray, n, getter = i => colorArray[i].stroke) => {
        let colors = "white,red,green,blue,yellow,cyan,magenta".split(",");  // default starting colors
        colors = colors.map(e => h2a(toHEXcolor(e)));              // convert the colors to rgb arrays
        let usedColors = [];
        for (var i = 0; i < colorArray.length; i++) {
            let c = getter(i); // color of the path
            // if the color already exists, add the length to the existing length.
            let index = usedColors.findIndex(e => e.c == c);
            if (index < 0) usedColors.push({ c: h2a(toHEXcolor(c)) });
        }
        // usedColors now contains the colors and the total length of the paths with that color
        // initialize centroids
        let indices = [];  // indices of the colors in the usedColors array
        let centroids = []   // n centroids need to be randomly selected from usedcolors
        for (let i = 0; i < n; i++) {
            let randindex = Math.floor(Math.random() * usedColors.length);
            if (!indices.includes(randindex)) {
                indices.push(randindex);  // random selection of n centroids
                centroids.push(usedColors[randindex].c);
            }
        }
        let maxiterations = 100;
        while (maxiterations-- > 0) {
            // centroids now contain n colors, randomly chosen from the usedColors array
            // now we need to assign each color to the closest centroid
            let clusters = L(n, e => []);
            for (let i = 0; i < usedColors.length; i++) {
                let min = 1e10, index = 0;
                for (let j = 0; j < n; j++) {
                    let d = usedColors[i].c.map((e, i) => (e - centroids[j][i]) ** 2).reduce((a, b) => a + b, 0);
                    if (d < min) {
                        min = d;
                        index = j;
                    }
                }
                clusters[index].push(usedColors[i]);
            }
            // clusters now contains the colors grouped by the closest centroid
            // now we need to calculate the new centroids
            let newCentroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[clusters.indexOf(cluster)]; // avoid division by zero
                return cluster[0].c.map((_, idx) => cluster.reduce((sum, point) => sum + point.c[idx], 0) / cluster.length);
            });
            // centroids now contain the new centroids
            // we need to repeat the process until the centroids do not change anymore
            if (centroids.every((centroid, i) => centroid.every((value, j) => value === newCentroids[i][j]))) break;
            centroids = newCentroids;
        }
        return centroids
    },

    //================================================================================================
    // returns the closest color from an array of colors
    getClosestColor = (color, QuantsArray) => {
        let distances = QuantsArray.map(e => dist(h2a(toHEXcolor(color)), e));                
        let index = distances.indexOf(Math.min(...distances));
        return a2h(QuantsArray[index].mul(255));
    }



