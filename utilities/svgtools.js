/* 
collection of tools for creating and modifying SVGS
*/

let
    parser = new DOMParser(), serializer = new XMLSerializer(),


    // Function to get the float value of an attribute, with a default value if not present
    attrFloat = (el, attr, defaultVal = 0) => parseFloat(el.getAttribute(attr)) || defaultVal,
    attrGet = (el, attr) => el.getAttribute(attr) || ''

import { dist } from "./arraytools.js";
import { distanceToLineSegment } from "./pathtools.js";

let{ sin, cos, pow, asin, acos, atan, atan2, tan, PI,max,min,sqrt } =Math


export let
    // convert SVG strings to DOM element and back
    SVG2Doc = (svgData) => parser.parseFromString(svgData, 'image/svg+xml').documentElement,
    Doc2SVG = (svgDoc) => serializer.serializeToString(svgDoc),
    // create Element
    CreateSVGElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag),
    CopyObject = (obj) => JSON.parse(JSON.stringify(obj)),
    listAttributes = (element) => {
        let result = `Element: ${element.tagName}, Attributes:`;
        Array.from(element.attributes).forEach(attr => result += `${attr.name} = ${attr.value} ; `)
        return result
    },
    getAttributes = (element) => {
        let result = {}
        Array.from(element.attributes).forEach(attr => result[attr.name] = attr.value)
        return result
    },


    copySVGAttributes = (sourceElement, targetElement, allowlist = null) => {
        Array.from(sourceElement.attributes).forEach(attr => {
            // Check if the attribute is in the allowlist or if allowlist is null (copy all)
            if ((!allowlist || allowlist.includes(attr.name)) && !targetElement.hasAttribute(attr.name)) {
                targetElement.setAttribute(attr.name, attr.value);
            }
        });
    },
    //========================================================================================================
    // recursively flatten all group elements. 
    // copies the group attributes (e.g., stroke, fill) to individual elements unless they override it
    flattenGroups = (element) => {
        let flattened = [];
        element.childNodes.forEach(child => {
            if (child.nodeType === 1) { // Element nodes only
                if (child.tagName === 'g') {
                    flattened = flattened.concat(flattenGroups(child)); // Recurse for nested groups
                } else {
                    if (element.tagName !== 'svg') copySVGAttributes(element, child)
                    flattened.push(child); // Non-group elements are added directly
                }
            }
        });
        return flattened;
    },
    //==================================================================================
    // convert an SVG element to a path element
    // copies the attributes if they are in the allowlist.
    elementToPathObject = el => {
        let str = "";
        switch (el.tagName) {
            case 'path':
                str = el.getAttribute('d');  // For path, just return the existing 'd' attribute
                break;
            case 'rect':
                str = `M${attrFloat(el, 'x')},${attrFloat(el, 'y')} 
                   L${attrFloat(el, 'x') + attrFloat(el, 'width')},${attrFloat(el, 'y')} 
                   L${attrFloat(el, 'x') + attrFloat(el, 'width')},${attrFloat(el, 'y') + attrFloat(el, 'height')} 
                   L${attrFloat(el, 'x')},${attrFloat(el, 'y') + attrFloat(el, 'height')} Z`;
                break;
            case 'circle':
                const cx = attrFloat(el, 'cx'), cy = attrFloat(el, 'cy'), r = attrFloat(el, 'r');
                str = `M${cx - r},${cy} 
                       A${r},${r} 0 1,1 ${cx + r},${cy} 
                       A${r},${r} 0 1,1 ${cx - r},${cy} Z`;  // Corrected large arc flag
                break;
            case 'ellipse':
                const ex = attrFloat(el, 'cx'), ey = attrFloat(el, 'cy'), rx = attrFloat(el, 'rx'), ry = attrFloat(el, 'ry');
                str = `M${ex - rx},${ey} 
                       A${rx},${ry} 0 1,1 ${ex + rx},${ey} 
                       A${rx},${ry} 0 1,1 ${ex - rx},${ey} Z`;  // Corrected large arc flag
                break;
            case 'line':
                str = `M${attrFloat(el, 'x1')},${attrFloat(el, 'y1')} 
                   L${attrFloat(el, 'x2')},${attrFloat(el, 'y2')}`;
                break;
            case 'polygon':
            case 'polyline':
                const points = el.getAttribute('points').trim().split(/\s+|,/);
                let pathData = `M${points[0]},${points[1]}`;
                for (let i = 2; i < points.length; i += 2) {
                    pathData += ` L${points[i]},${points[i + 1]}`;
                }
                str = el.tagName === 'polygon' ? pathData + ' Z' : pathData;
                break;
            default:
                return null; // Unsupported element
        }
        console.log("Converting Element " + el.tagName + " -> " + str)
        // Create a new path element

        const path = getAttributes(el)
        // Copy other relevant attributes (e.g., fill, stroke, etc.)
        // copySVGAttributes(el, path, "stroke,stroke-width,fill,style,stroke-linejoin,stroke-linecap,transform".split(","));  
        // path.setAttribute('d', str);
        path.d = str;

        return path;
    },
    //------------------------------------------------------------------------------------------------
    // Breaks down the d attribute into individual commands and their parameters
    // multiple combined elements will get split  (l 10,3,5,5)=> l 10,3  l 5,5 
    // returns an array with all commands and their values.
    parsePath = d => {
        const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g).map(cmd => cmd.trim());
        let results = []
        commands.map(cmd => {
            const type = cmd[0];
            const values = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            // Split the values array into individual commands
            let chunkSize = 0, cmdlength = { mlt: 2, qsc: 4, c: 6, hv: 1, a: 7 };
            for (let c in cmdlength) if (c.includes(type.toLowerCase())) chunkSize = cmdlength[c];
            for (let i = 0; i < values.length; i += chunkSize) {
                results.push({ type, values: values.slice(i, i + chunkSize) });
                if (chunkSize == 0) break;
            }
        });
        return results;
    },
    mid = (a, b) => a.add(b).mul(0.5),


    //------------------------------------------------------------------------------------------------
    approxCubicBezier = (P1, P2, P3, P4, maxDist) => {
        // Calculate distances from control points P2 and P3 to the line P1-P4
        const distP2 = distanceToLineSegment(P2, P1, P4);
        const distP3 = distanceToLineSegment(P3, P1, P4);
        // Check the maximum deviation
        const maxDeviation = max(distP2, distP3);
        // If the maximum deviation is greater than the threshold, subdivide the curve
        if (maxDeviation > maxDist) {
            const PA = mid(P1, P2); // Midpoint of P1 and P2
            const PB = mid(P2, P3); // Midpoint of P2 and P3
            const PC = mid(P3, P4); // Midpoint of P3 and P4
            // Recursively subdivide the curve into two halves
            return [
                ...approxCubicBezier(P1, PA, mid(PA, PB), mid(mid(PA, PB), mid(PB, PC)), maxDist), // First half
                ...approxCubicBezier(mid(mid(PA, PB), mid(PB, PC)), mid(PB, PC), PC, P4, maxDist)  // Second half
            ];
        }
        return [P1, P4];
    },
    //------------------------------------------------------------------------------------------------
    approxQuadBezier = (P1, P2, P3, maxDist) => {
        const P1P2 = mid(P1, P2); // Midpoint between P1 and P2
        const P2P3 = mid(P2, P3); // Midpoint between P2 and P3
        const curveMid = mid(P1P2, P2P3); // Midpoint on the curve

        // Check the deviation of the control point (P2) from the straight line P1 to P3
        if (distanceToLineSegment(P2, P1, P3) > maxDist) {
            // Subdivide the curve if the deviation exceeds the maxDist threshold
            return [
                ...approxQuadBezier(P1, P1P2, curveMid, maxDist), // First half of the curve
                ...approxQuadBezier(curveMid, P2P3, P3, maxDist)  // Second half of the curve
            ];
        }

        return [P3]; // If the deviation is acceptable, return the final point P3
    },
    //------------------------------------------------------------------------------------------------
     approxArc = (P1, P2, R, xAxisRotation, largeArcFlag, sweepFlag, maxDistance) => {
        const rad = (deg) => (deg * Math.PI) / 180;
        const [cosRot, sinRot] = [Math.cos(rad(xAxisRotation)), Math.sin(rad(xAxisRotation))];
    
        // Step 1: Calculate transformed P1' and P2'
        const P1Prime = [
            cosRot * (P1[0] - P2[0]) / 2 + sinRot * (P1[1] - P2[1]) / 2,
            -sinRot * (P1[0] - P2[0]) / 2 + cosRot * (P1[1] - P2[1]) / 2
        ];
    
        // Step 2: Ensure radii satisfy the geometric constraint
        let radiiScale = Math.pow(P1Prime[0], 2) / Math.pow(R[0], 2) + Math.pow(P1Prime[1], 2) / Math.pow(R[1], 2);
        if (radiiScale > 1) R = [R[0] * Math.sqrt(radiiScale), R[1] * Math.sqrt(radiiScale)];
    
        // Step 3: Calculate center of the ellipse
        const signFactor = (largeArcFlag !== sweepFlag) ? 1 : -1;
        const factor = signFactor * Math.sqrt(
            (Math.pow(R[0], 2) * Math.pow(R[1], 2) - Math.pow(R[0], 2) * Math.pow(P1Prime[1], 2) - Math.pow(R[1], 2) * Math.pow(P1Prime[0], 2)) /
            (Math.pow(R[0], 2) * Math.pow(P1Prime[1], 2) + Math.pow(R[1], 2) * Math.pow(P1Prime[0], 2))
        );
    
        const centerPrime = [(factor * R[0] * P1Prime[1]) / R[1], -(factor * R[1] * P1Prime[0]) / R[0]];
        const center = [
            cosRot * centerPrime[0] - sinRot * centerPrime[1] + (P1[0] + P2[0]) / 2,
            sinRot * centerPrime[0] + cosRot * centerPrime[1] + (P1[1] + P2[1]) / 2
        ];
    
        // Step 4: Calculate start and end angles
        const startAngle = Math.atan2((P1[1] - center[1]) / R[1], (P1[0] - center[0]) / R[0]);
        const endAngle = Math.atan2((P2[1] - center[1]) / R[1], (P2[0] - center[0]) / R[0]);
    
        // Step 5: Adjust the sweep angle based on flags
        let sweepAngle = endAngle - startAngle;
        if (sweepFlag) {
            if (sweepAngle < 0) sweepAngle += 2 * Math.PI; // Sweep clockwise
        } else {
            if (sweepAngle > 0) sweepAngle -= 2 * Math.PI; // Sweep counterclockwise
        }
    
        // Adjust for largeArcFlag
        if (largeArcFlag && Math.abs(sweepAngle) < Math.PI) {
            sweepAngle = (sweepAngle > 0 ? 1 : -1) * (2 * Math.PI - Math.abs(sweepAngle));
        } else if (!largeArcFlag && Math.abs(sweepAngle) > Math.PI) {
            sweepAngle = (sweepAngle > 0 ? 1 : -1) * (2 * Math.PI - Math.abs(sweepAngle));
        }
    
        // Helper function to calculate the point on the arc for a given angle
        const pointOnArc = (angle) => [
            center[0] + Math.cos(angle) * R[0],
            center[1] + Math.sin(angle) * R[1]
        ];
    
        // Helper function to recursively refine the arc approximation
        const refineArc = (startAngle, endAngle, maxDistance) => {
            const midAngle = (startAngle + endAngle) / 2;
            const start = pointOnArc(startAngle);
            const mid1 = pointOnArc(midAngle);
            const end = pointOnArc(endAngle);
    
            // Midpoint of the straight line and the actual arc midpoint
            const midLine = mid(start, end);
            const deviation = dist(mid1, midLine);
    
            if (deviation > maxDistance) {
                // If the deviation exceeds maxDistance, subdivide the arc further
                return [
                    ...refineArc(startAngle, midAngle, maxDistance),
                    ...refineArc(midAngle, endAngle, maxDistance)
                ];
            } else {
                return [start, end]; // Return the start and end points if within tolerance
            }
        };
    
        // Start approximation
        return refineArc(startAngle, startAngle + sweepAngle, maxDistance);
    },
    
    
    
    
    //=====================================================================================================
    // converts a  path ("the 'd' string) into an array of points.
    // iterate over all teh commands in the path and return the points
    pathtoPointArray = (d, maxDistance) => {
        const commands = parsePath(d);
        let points = [];
        let prevPoint = [0, 0];  // previous point
        let firstPoint = [0, 0]  // first point, for z commands. 

        commands.forEach(cmd => {
            let offset = (cmd.type == cmd.type.toLowerCase()) ? prevPoint : [0, 0]
            let addPoint = P => { points.push(P); prevPoint = P; }
            let endPoint, cp1, cp2, cp3;
            switch (cmd.type.toLowerCase()) {
                case 'm': //  Move to
                    points.push(null);
                    addPoint(cmd.values.xy.add(offset))
                    firstPoint = prevPoint;
                    break;
                case 'l':  // line to
                    addPoint(cmd.values.xy.add(offset))
                    break;
                case 'v': // Vertical line to                                        
                    addPoint([0, cmd.values[0]].add(offset))
                    break;
                case 'h': //Horizontal line to
                    addPoint([cmd.values[0], 0].add(offset));
                    break;
                case 'q': // Handle multiple quadratic Bézier points
                    const controlPoint = cmd.values.xy.add(offset);  //element 0,1 in array
                    endPoint = cmd.values.zw.add(offset);    // element 2,3
                    points.push(...approxQuadBezier(prevPoint, controlPoint, endPoint, maxDistance));
                    prevPoint = endPoint;
                    break;
                case 'c': // cubic bezier
                    cp1 = cmd.values.slice(0, 2).add(offset);  // elements 0,1 in array
                    cp2 = cmd.values.slice(2, 4).add(offset);  // elements 2,3
                    endPoint = cmd.values.slice(4, 6).add(offset);  // elements 4,5
                    points.push(...approxCubicBezier(prevPoint, cp1, cp2, endPoint, maxDistance));
                    prevPoint = endPoint;
                    break;
                case 's': // Smooth cubic Bézier
                    console.error('smooth cubic bezier is still untested');
                    const prevControlPoint = points[points.length - 2] || prevPoint; // Fallback to prevPoint if no previous control point
                    const reflection = prevPoint.mul(2).sub(prevControlPoint); // Reflect the previous control point
                    cp2 = cmd.values.slice(0, 2).add(prevPoint);  // elements 0,1 in array
                    cp3 = cmd.values.slice(2, 4).add(prevPoint);  // elements 2,3
                    points.push(...approxCubicBezier(prevPoint, reflection, cp2, cp3, maxDistance));
                    prevPoint = cp3;
                    break;
                case 'a': // Arc command
                  console.error ("Arc command is not without bugs yet! - sometimes upside down")
                    const radius = cmd.values.xy
                    const xAxisRotation = cmd.values.z
                    const largeArcFlag = cmd.values.w
                    const sweepFlag = cmd.values[4]
                    endPoint = cmd.values.slice(5, 7).add(offset)
                    points.push(...approxArc(prevPoint, endPoint, radius, xAxisRotation, largeArcFlag, sweepFlag, maxDistance));
                    prevPoint = endPoint
                    break;
                case 'z': // Close path
                    points.push(firstPoint)
                    break;
                default:
                    throw cmd.type + " IS NOT YET IMPLEMENTED"
                    break;
            }
        });
        return points;
    }

