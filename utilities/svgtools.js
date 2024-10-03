/* 
collection of tools for creating and modifying SVGS
*/

let
    parser = new DOMParser(), serializer = new XMLSerializer(),


    // Function to get the float value of an attribute, with a default value if not present
    attrFloat = (el, attr, defaultVal = 0) => parseFloat(el.getAttribute(attr)) || defaultVal,
    attrGet = (el, attr) => el.getAttribute(attr) || ''

    import {LOOP} from "./arraytools.js";
    import { distanceToLineSegment } from "./pathtools.js";




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
                str = `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;
                break;
            case 'ellipse':
                const ex = attrFloat(el, 'cx'), ey = attrFloat(el, 'cy'), rx = attrFloat(el, 'rx'), ry = attrFloat(el, 'ry');
                str = `M${ex - rx},${ey} A${rx},${ry} 0 1,0 ${ex + rx},${ey} A${rx},${ry} 0 1,0 ${ex - rx},${ey} Z`;
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
            let chunkSize = 0, cmdlength = { mlt: 2, qsc: 4, c: 6, hv: 1 }
            for (let c in cmdlength) if (c.includes(type.toLowerCase())) chunkSize = cmdlength[c];
            for (let i = 0; i < values.length; i += chunkSize) {
                results.push({ type, values: values.slice(i, i + chunkSize) });
                if (chunkSize == 0) break;
            }
        });
        return results;
    },
    //------------------------------------------------------------------------------------------------
    approxCubicBezier = (P1, P2, P3, P4, maxDist) => {
        const mid = P1.add(P4).mul(0.5), ctrl1 = P2, ctrl2 = P3;
        // Use de Casteljau's algorithm to approximate the curve
        const ctrlMid = ctrl1.add(ctrl2).mul(0.5); // Midpoint between control points
        // Recursively subdivide the curve if the deviation from the line exceeds maxDist
        return distanceToLineSegment(ctrlMid, P1, P4) > maxDist
            ? [
                ...approxCubicBezier(P1, P1.add(ctrl1).mul(0.5), ctrl1.add(ctrl2).mul(0.5), mid, maxDist),
                ...approxCubicBezier(mid, ctrl2.add(P4).mul(0.5), P3.add(P4).mul(0.5), P4, maxDist)
            ]
            : [P4]; // If deviation is acceptable, return the final endpoint P4
    },
    // Placeholder function for calculating arc length
    arcLength = (rx, ry, startPoint, endPoint, largeArcFlag, sweepFlag) => {
        // Implement arc length calculation here
        return 100; // Placeholder value, you need to calculate the true length
    },

    // Placeholder function for interpolating a point on the arc
    interpolateArcPoint = (startPoint, endPoint, t, rx, ry, xAxisRotation, largeArcFlag, sweepFlag) => {
        // Implement arc point interpolation logic
        return [startPoint[0] * (1 - t) + endPoint[0] * t, startPoint[1] * (1 - t) + endPoint[1] * t]; // Simplified linear interpolation
    },
    approxArc = (startPoint, endPoint, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, maxDistance) => {
        // Implement the math for approximating an elliptical arc here
        // Approximate the arc by dividing it into line segments based on maxDistance
        // You could use an existing arc approximation library or custom math for this.
        let arcPoints = [];

        // Example logic for arc approximation could be placed here.
        // You'd need to calculate the arc parameters and approximate it with line segments.
        // This is a simplified placeholder.
        const numSegments = Math.ceil(arcLength(rx, ry, startPoint, endPoint, largeArcFlag, sweepFlag) / maxDistance);
        for (let i = 0; i <= numSegments; i++) {
            let t = i / numSegments;
            let point = interpolateArcPoint(startPoint, endPoint, t, rx, ry, xAxisRotation, largeArcFlag, sweepFlag);
            arcPoints.push(point);
        }

        return arcPoints;
    },
    approxQuadBezier = (P1, P2, P3, maxDist) => {
        // Midpoints for de Casteljau's algorithm
        let P1P2 = P1.add(P2).mul(0.5); // Midpoint between P1 and P2
        let P2P3 = P2.add(P3).mul(0.5); // Midpoint between P2 and P3
        let curveMid = P1P2.add(P2P3).mul(0.5); // Midpoint on the curve
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
                    const controlPoint = cmd.values.xy.add(prevPoint);  //element 0,1 in array
                    const endPoint = cmd.values.zw.add(prevPoint);    // element 2,3
                    points.push(...approxQuadBezier(prevPoint, controlPoint, endPoint, maxDistance));
                    prevPoint = endPoint;
                    break;
                case 'c': // cubic bezier
                    console.error('cubic bezier is stil untested')
                    const cP1 = cmd.values.slice(0, 2).add(prevPoint);  // elements 0,1 in array
                    const cP2 = cmd.values.slice(2, 4).add(prevPoint);  // elements 2,3
                    const cp3 = cmd.values.slice(4, 6).add(prevPoint);  // elements 4,5
                    points.push(...approxCubicBezier(prevPoint, cP1, cP2, cp3, maxDistance));
                    prevPoint = cp3;
                    break;
                case 's': // Smooth cubic Bézier
                    console.error('smooth cubic bezier is still untested');
                    const prevControlPoint = points[points.length - 2] || prevPoint; // Fallback to prevPoint if no previous control point
                    const reflection = prevPoint.mul(2).sub(prevControlPoint); // Reflect the previous control point
                    const sC2 = cmd.values.slice(0, 2).add(prevPoint);  // elements 0,1 in array
                    const sEndPoint = cmd.values.slice(2, 4).add(prevPoint);  // elements 2,3
                    points.push(...approxCubicBezier(prevPoint, reflection, sC2, sEndPoint, maxDistance));
                    prevPoint = sEndPoint;
                    break;
                case 'a': // Arc command
                    const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = cmd.values;
                    const endPoint1 = [x, y].add(prevPoint);
                    points.push(...approxArc(prevPoint, endPoint1, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, maxDistance));
                    prevPoint = endPoint1;
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

