// utilities to work on paths.  
// definitions:
// a point=  [x,y]  - array containing x,y coordinates  p.x, p.y  etc can be used
// a line=  [points]  - an array of points, first point is start, last point in the array is the end of the line...
// a path: a struct containing a line (a points array) and other stuff such as color, original svg element tag etc.

import { LOOP, dot } from "./arraytools.js";

export let

    /**
     * Calculates the total length of a series of points.
     *
     * @param {Array} points - An array of points where each point is an object with x and y properties.
     * @returns {number} The total length of the line formed by the series of points.
     */
    lineLength = points => {
        let length = 0;
        if (points.length == 1) return 0;
        LOOP(points.length - 1, i => length += dist(points[i], points[i + 1]));
        return length;
    },


    /**
     * Extracts the first and last points from each path in the provided array of paths.
     *
     * @param {Array} paths - An array of path objects. Each path object should have a 'points' property which is an array of points.
     */
    getFirstLast = paths => {
        LOOP(paths.length, i => {
            paths[i].firstPoint = paths[i].points[0];
            paths[i].lastPoint = paths[i].points[paths[i].points.length - 1];
        });
    },


    /**
     * Calculates the total length of all paths in the provided path array.
     *
     * @param {Array} pathData - An array of path objects. Each path object should have a 'points' property which is an array of points.
     * @returns {Object} An object containing drawLength, moveLength, and points count.
     */
    pathLength = pathData => {
        getFirstLast(pathData);
        let drawLength = 0, moveLength = 0, pointCount = 0;
        for (let i = 0; i < pathData.length; i++) {
            pointCount += pathData[i].points.length;
            drawLength += lineLength(pathData[i].points);
            if (i > 0) moveLength += dist(pathData[i].firstPoint, pathData[i - 1].lastPoint);
        }
        return { drawLength, moveLength, points: pointCount };
    },


    /**
     * Calculates the distance between a point and a line segment.
     *
     * @param {Object} P - The point with x and y properties.
     * @param {Object} a - The start point of the line segment with x and y properties.
     * @param {Object} b - The end point of the line segment with x and y properties.
     * @returns {number} The distance between the point and the line segment.
     */
    distanceToLineSegment = (P, a, b) => {
        const AP = P.sub(a);                            // Vector from A to P
        const AB = b.sub(a);                            // Vector from A to B
        const abLenSq = dot(AB, AB); // Squared length of AB (AB · AB)
        let t = abLenSq ? dot(AP, AB) / abLenSq : 0;     // Projection of AP onto AB (scalar projection t)
        t = Math.max(0, Math.min(1, t));            // Clamp t to the range [0, 1] to ensure projection is within the segment
        const proj = a.add(AB.mul(t));            // Compute the projection point on the line segment
        let dist = P.sub(proj).L;                   // P.sub(proj) gives vector P to proj, and .L gives the length            
        return dist;
    },

    /**
    * Simplifies a path using the Ramer-Douglas-Peucker algorithm.
    *
    * @param {Array} points - An array of points where each point is an object with x and y properties.
    * @param {number} accuracy - The maximum distance between the original path and the simplified path.
    * @returns {Array} The simplified path as an array of points.
    */
    simplifyPath = (points, accuracy) => {
        var simplifySection = (firstIndex, lastIndex) => {
            if (lastIndex - firstIndex < 2) return [points[firstIndex]]; // short line
            var maxDistance = 0, index = -1;
            var firstPoint = points[firstIndex],
                lastPoint = points[lastIndex];
            for (var i = firstIndex + 1; i < lastIndex; i++) {
                var distance = distanceToLineSegment(points[i], firstPoint, lastPoint);
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
        return simplifiedPoints;
    };
