// utilities to work on paths.  
// definitions:
// a point=  [x,y]  - array containing x,y coordinates  p.x, p.y  etc can be ysed
// a line=  [points]  - an array of points, first point is start, last point in the array is the end of the line...
// a path: a struct containing a line ( a points array) and other stuff such as color, original svg element tag etc.

import { LOOP ,dot} from "./arraytools.js";
export let
    //=======================================================================================================
    // length of a single line, point-to-point
    lineLength = points => {
        let length = 0;
        if (points.length == 1) return 0;
        LOOP(points.length - 1, i => length += dist(points[i], points[i + 1]));
        return length;
    },
    //=======================================================================================================
    // assign the first and last point of each path for easier lookup later
    getFirstLast = paths => {
        LOOP(paths.length, i => {
            paths[i].firstPoint = paths[i].points[0];
            paths[i].lastPoint = paths[i].points[paths[i].points.length - 1]
        })
    },
    //=======================================================================================================
    // get the length of all paths in a path array. 
    // drawLength is the length of all lines in the path.  assumed these will be drawn
    // moveLength is the length of all the moves in the path.  assumed these will not be drawn.  
    // points is the total number of points in the path
    pathLength = pathData => {
        getFirstLast(pathData);
        let drawLength = 0, moveLength = 0, pointCount = 0
        for (let i = 0; i < pathData.length; i++) {
            pointCount += pathData[i].points.length;
            drawLength += lineLength(pathData[i].points);
            if (i > 0) moveLength += dist(pathData[i].firstPoint, pathData[i - 1].lastPoint);
        }
        return { drawLength, moveLength, points: pointCount }
    },
    //------------------------------------------------------------------------------------------------
    // distance between a point P and a line segment AB 
    distanceToLineSegment = (P, a, b) => {
        const AP = P.sub(a);                            // Vector from A to P
        const AB = b.sub(a);                            // Vector from A to B
        const abLenSq = dot(AB, AB); // Squared length of AB (AB · AB)
        let t = abLenSq ? dot(AP, AB) / abLenSq : 0;     // Projection of AP onto AB (scalar projection t)
        t = Math.max(0, Math.min(1, t));            // Clamp t to the range [0, 1] to ensure projection is within the segment
        const proj = a.add(AB.mul(t));            // Compute the projection point on the line segment
        let dist = P.sub(proj).L;                   // P.sub(proj) gives vector P to proj, and .L gives the length            
        return dist
    },
    //===================================================================================================================
    // Algorithm to simplify the path based on the Ramer-Douglas-Peucker algorithm, where the accuracy 
    //                 is the maximum distance between the original path and the simplified path.
    // d is the path data, and accuracy is the maximum distance between the original path and the simplified path.
    // The function returns the simplified path data.
    //===================================================================================================================
    simplifyPath = (points, accuracy) => {
        var simplifySection =  (firstIndex, lastIndex)=> {
            if (lastIndex - firstIndex < 2) return [points[firstIndex]]; // short line
            var maxDistance = 0, index = -1
            var firstPoint = points[firstIndex],
                lastPoint = points[lastIndex];
            for (var i = firstIndex + 1; i < lastIndex; i++) {
                var distance = distanceToLineSegment(points[i], firstPoint, lastPoint)
                if (distance > maxDistance) {
                    index = i;
                    maxDistance = distance;
                }
            }
            if (maxDistance <= accuracy) return [firstPoint];
            var left = simplifySection(firstIndex, index), right = simplifySection(index, lastIndex);
            return left.concat(right);
        };
        var simplifiedPoints = simplifySection(0, points.length - 1);
        simplifiedPoints.push(points[points.length - 1]); // Adding the last point
        return simplifiedPoints
    }

