// utilities to work on paths.  
// definitions:
// a point=  [x,y]  - array containing x,y coordinates  p.x, p.y  etc can be used
// a line=  [points]  - an array of points, first point is start, last point in the array is the end of the line...
// a path: a struct containing a line (a points array) and other stuff such as color, original svg element tag etc.

import { LOOP, dot, dist } from "./arraytools.js";

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
    },

    /**
     * Splits paths into sub-paths based on null points.
     *  the d attribute is unchanged, this means the points array and the d attributes are no longer the same.  
     *
     * @param {Array} pathArray - An array of path objects, each containing a 'points' array.
     * @returns {Array} - An array of path objects, each representing a sub-path.
     */
    splitPaths = pathArray => {
        let result = [];
        pathArray.forEach(path => {
            let points = path.points;
            let currentPoints = []; // To store the current sub-path
            points.forEach(point => {
                if (point === null) {
                    if (currentPoints.length > 0) {
                        result.push({ ...path, points: currentPoints }); // Push the current sub-path
                    }
                    currentPoints = []; // Reset for the next sub-path
                } else {
                    currentPoints.push(point); // Add point to the current sub-path
                }
            });
            if (currentPoints.length > 0) result.push({ ...path, points: currentPoints });

        });
        return result;
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
     * Finds the index in the path array that is closest to the given point.
     * 
     * This function is used in reducing non-moving distance. It finds the index in the path array that is closest to the given point.
     * 
     * @param {Array} pathArray - An array of paths, each path containing `firstpoint` and `lastpoint` properties.
     * @param {Array} point - The point to which the closest path index is to be found. The point is represented as an array [x, y].
     * @param {number} [startindex=0] - The index from which to start searching in the path array.
     * @returns {Object} An object containing:
     *   - `bestIndex` (number): The index of the path that is closest to the point.
     *   - `inverse` (boolean): A boolean indicating if the point is closer to the end (`true`) or the start (`false`) of the path.
     */
    findClosestIndex_to_Point = (pathArray, point, startindex = 0) => {
        let d = 1e10, inverse = false, bestIndex = 0
        for (let i = startindex; i < pathArray.length; i++) {
            let d_end = dist(point, pathArray[i].lastPoint), d_start = dist(point, pathArray[i].firstPoint)
            if (d_end < d) { d = d_end; bestIndex = i; inverse = true }   // endpoint is closer
            if (d_start < d) { d = d_start; bestIndex = i; inverse = false } // startpoint is closer
        }
        return { bestIndex, inverse }
    },

    /**
     * Optimizes the order of paths in the given array to minimize the moving distance. simple version
     *
     * @param {Array} pathArray - An array of paths, where each path is an object containing points.
     * @param {Array} [currentPoint=[0, 0]] - The starting point for the optimization.
     *
     * @returns {Array} - The optimized array of paths.
     *
     */
    minimizeMovingDistanceQuick =  (pathArray, currentPoint = [0, 0], callBack = null) => {
        let getNonMovingLength = _ => {
            let nonMovingLength = 0;
            for (let i = 1; i < pathArray.length; i++) {
                nonMovingLength += dist(pathArray[i].firstPoint, pathArray[i - 1].lastPoint);
            }
            return nonMovingLength;
        }
        // first step, simply find the closest path to the starting point and swap paths or reverse the paths
        let deepCopy = arr => arr.map(path => ({ ...path, points: [...path.points] }));
        let startingLength = getNonMovingLength();
        let _temp = deepCopy(pathArray); // copy the array
        for (let i = 0; i < pathArray.length; i++) {
            let closestPath = findClosestIndex_to_Point(pathArray, currentPoint, i);
            if (closestPath.inverse) pathArray[closestPath.bestIndex].points.reverse();
            [pathArray[i], pathArray[closestPath.bestIndex]] = [pathArray[closestPath.bestIndex], pathArray[i]];  // swap paths
            currentPoint = pathArray[i].lastPoint;
        }
        let newLength = getNonMovingLength();
        if (startingLength < newLength) {
            pathArray = _temp; // revert the changes  
        }
        console.log("minimizeMovingDistanceQuick: ", startingLength,newLength)
        return pathArray
    }


