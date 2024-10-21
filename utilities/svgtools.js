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

/* 
collection of tools for creating and modifying SVGS
*/


import *as PATHTOOLS from "./pathtools.js";
import * as ARRAYTOOLS from "./arraytools.js"
let { sin, cos, pow, asin, acos, atan, atan2, tan, PI, max, min, sqrt, abs } = Math
export let
    //================================================================================================    
    // convert SVG strings to DOM element and back
    parser = new DOMParser(), serializer = new XMLSerializer(),
    SVG2Doc = (svgData) => parser.parseFromString(svgData, 'image/svg+xml').documentElement,
    Doc2SVG = (svgDoc) => serializer.serializeToString(svgDoc),
    //================================================================================================
    // create a new SVG element
    CreateSVGElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag),
    //================================================================================================
    /**
     * Converts an SVG element to a JavaScript object representation.
     * The resulting object contains the type of the element, its attributes, and its children.
     * Each child is recursively converted to an object as well.
     * 
     * @param {Element} element - The SVG element to convert.
     * @param {Object} Dictionary - A dictionary to store the converted elements by their unique IDs.
     * @returns {Object} - The JavaScript object representation of the SVG element.
     */
    svgToObject = (element, Dictionary) => {
        let id = "svg" + Math.random().toString(36).substr(2, 9);
        let R = {
            type: element.tagName,
            attributes: {
                idid: id, ...[...element.attributes].reduce((attrs, attr) => ({
                    ...attrs,
                    [attr.name]: attr.value
                }), {})
            },
            children: [...element.childNodes]
                .filter(node => node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()))
                .map(node =>
                    node.nodeType === Node.ELEMENT_NODE
                        ? svgToObject(node, Dictionary)
                        : { type: 'text', content: node.nodeValue.trim() }
                )
        };
        Dictionary[id] = R;
        return R;
    },
    objectToSvg = (obj) => {
        const element = CreateSVGElement(obj.type);
        Object.entries(obj.attributes).forEach(([name, value]) => element.setAttribute(name, value));
        obj.children.forEach(child => {
            const childNode = child.type === 'text' ? document.createTextNode(child.content) : objectToSvg(child);
            element.appendChild(childNode);
        });
        return element;
    },
    //================================================================================================
    // Set the canvas dimensions.  Q.page_width and Q.page_height are the dimensions of the paper in mm 
    scaleCanvas = (Q, c, margin = [300, 100]) => {
        let maxS = [window.innerWidth - margin.x, window.innerHeight - margin.y]       // max dimeinsions for the canvas
        let scale = min(...maxS.div([Q.page_width, Q.page_height]))         // scale to fit the canvas
        let wh = { width: Q.page_width * scale + "px", height: Q.page_height * scale + "px" }    // canvas size in the document
        if (!c) return;  // Stop further execution if the canvases are not found
        Object.assign(c.style, wh)            // canvas size in the document
        wh = { width: Q.page_width * Q.canvasResolution, height: Q.page_height * Q.canvasResolution }     // canvas size in pixels
        if (c.width !== wh.width || c.height !== wh.height) Object.assign(c, wh)
    },
    //======================================================================================================================
    // draws the SVG on the canvas, taking into account the scaling and offset parameters.
    // first, convert to paper coordinates, then to the canvas coordinates
    imageSize = {         // in paper coordinates
        wh: [0, 0],       // width,height                    
        left: [0, 0],   // center
        scale: 1,
        resolution: 1
    },
    // convert world coordinates to canvas coordinates taken into account the scaling and offset
    worldToCanvas = (p) => {
        let p1 = p.mul(imageSize.scale)
        p1 = p1.add(imageSize.left)
        p1 = p1.mul(imageSize.resolution)
        return p1
    },
    //======================================================================================================================
    // draw the SVG on the canvas
    // first, convert to paper coordinates, then to the canvas coordinates
    // the Q object contains the parameters for the drawing, such as the page dimensions, the scale, and the offset
    // the canvas is the canvas element to draw on
    // the SVG is the SVG element to draw
    drawSVGtoCanvas = (svgdoc, ctx, Q) => {
        return new Promise((resolve, reject) => {
            let img = new Image();
            let imageLoaded = false;
            const timeout = 5000; // 5 seconds timeout
            const timer = setTimeout(() => {
                if (!imageLoaded) {
                    reject("Image load timed out");
                }
            }, timeout);
            img.onload = function () {
                clearTimeout(timer); // clear timeout on success
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                let width = img.width, height = img.height;
                let scale = min(Q.page_width / width, Q.page_height / height); // scale to fit the paper    
                let svgwidth = svgdoc.getAttribute("width"), svgheight = svgdoc.getAttribute("height");
                if (svgwidth.includes("mm")) { width = parseFloat(svgwidth); height = parseFloat(svgheight); scale = 1; }
                // if dimensions are in mm, use the image dimensions
                scale *= Q.scale; // apply the user scale factor                          
                imageSize.scale = scale;
                imageSize.resolution = Q.canvasResolution
                imageSize.wh = [width, height].map(dim => dim * scale);
                imageSize.left = [Q.page_width * (Q.offsetX * Q.scale + .5) - width * scale / 2, Q.page_height * (Q.offsetY * Q.scale + .5) - height * scale / 2];
                // draw the image, scale to canvas size but keep aspect ratio.
                ctx.drawImage(img, ...imageSize.left.map(val => val * Q.canvasResolution), ...imageSize.wh.map(val => val * Q.canvasResolution));
                imageLoaded = true;
                resolve(); // resolve the promise
            };
            img.src = "data:image/svg+xml," + encodeURIComponent(Doc2SVG(svgdoc));
        });
    },

    //======================================================================================================================
    // this function converts all drawing elements in the object to paths.
    convertToPaths = obj => {
        let str = "";
        switch (obj.type) {
            case 'svg':
            case 'g':
                // Recursively convert children for 'svg' and 'g' elements
                obj.children = obj.children.map(child => convertToPaths(child));
                return obj;
            case 'path':
                return obj;  // Paths already have a 'd' attribute
            case 'rect':
                // Ensure numeric conversion for dimensions
                const x = parseFloat(obj.attributes.x) || 0;
                const y = parseFloat(obj.attributes.y) || 0;
                const width = parseFloat(obj.attributes.width) || 0;
                const height = parseFloat(obj.attributes.height) || 0;
                str = `M${x},${y} L${x + width},${y}  L${x + width},${y + height} L${x},${y + height} Z`;
                break;
            case 'circle':
                const cx = parseFloat(obj.attributes.cx) || 0;
                const cy = parseFloat(obj.attributes.cy) || 0;
                const r = parseFloat(obj.attributes.r) || 0;
                str = `M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} Z`;
                break;
            case 'ellipse':
                const ex = parseFloat(obj.attributes.cx) || 0;
                const ey = parseFloat(obj.attributes.cy) || 0;
                const rx = parseFloat(obj.attributes.rx) || 0;
                const ry = parseFloat(obj.attributes.ry) || 0;
                str = `M${ex - rx},${ey} A${rx},${ry} 0 1,1 ${ex + rx},${ey} A${rx},${ry} 0 1,1 ${ex - rx},${ey} Z`;
                break;
            case 'line':
                const x1 = parseFloat(obj.attributes.x1) || 0;
                const y1 = parseFloat(obj.attributes.y1) || 0;
                const x2 = parseFloat(obj.attributes.x2) || 0;
                const y2 = parseFloat(obj.attributes.y2) || 0;
                str = `M${x1},${y1} L${x2},${y2}`;
                break;
            case 'polygon':
            case 'polyline':
                const points = obj.attributes.points.trim().split(/\s+|,/);
                let pathData = `M${points[0]},${points[1]}`;
                for (let i = 2; i < points.length; i += 2) pathData += ` L${points[i]},${points[i + 1]}`;
                // Use 'obj.type' to check for 'polygon'
                str = obj.type === 'polygon' ? pathData + ' Z' : pathData;
                break;
            default:
                return obj;  // Return original object for unsupported elements
        }
        // Set the type to 'path' and the 'd' attribute
        obj.type = 'path';
        obj.attributes.d = str;
        return obj;
    },
    //======================================================================================================================
    // add point arrays to all path elements
    // need to convert the object back to svg so all transformations etc are handled correctly
    //======================================================================================================================            
    addPointArrays = (obj, Dictionary, maxDistance = 5) => {
        let svg = objectToSvg(obj);
        document.body.appendChild(svg);     // need to conect to dom for proper CTM calculations
        let paths = svg.querySelectorAll("path");
        let inverseMatrix = svg.getCTM().inverse();     // to correct for all browser transformations
        paths.forEach(path => {
            let lines = path2pointarray(path, inverseMatrix,maxDistance);
            let ID = path.getAttribute("idid");
            Dictionary[ID].lines = lines

        });
        document.body.removeChild(svg);
    },
    //======================================================================================================================
    // convert a path element to an array of points
    //  splits the path into segments at the M or m
    // then adds points to the array at a distance of maxDistance
    // when the length of a segment is exceeded,t eh last point (at execatly the length of the segment) is added to the array
    // and the first point of the next segment is added to the array, with a small offset to avoid duplucates
    // at the end of the path, the last point at exactly the path length is added to the array
    //======================================================================================================================
    path2pointarray = (p, inverseMatrix,maxDistance) => {        
        let point, points = [], lines = [];
        let add = (p) => {
            p = p.matrixTransform(matrix);
            p = p.matrixTransform(inverseMatrix);
            points.push([p.x, p.y])
        }
        let matrix = p.getCTM()
        const originalPath = p.getAttribute("d");
        const segments = originalPath.split(/(?=[Mm])/);      // split the path into segments at the M or m
        const pathLength = p.getTotalLength();
        const numPoints = Math.floor(pathLength / maxDistance)
        maxDistance = pathLength / numPoints;
        // create a copy of the element
        let p2 = p.cloneNode(true);
        let cumulativeSegment = segments[0];
        p2.setAttribute("d", cumulativeSegment);
        let currentSegmentLength = p2.getTotalLength();
        add(p2.getPointAtLength(0));
        for (let j = 0; j <= pathLength; j += maxDistance) {
            if (j > currentSegmentLength && segments.length > 0) {
                point = p.getPointAtLength(currentSegmentLength)
                add(point)
                lines.push(points);        // store the previous segment's points
                points = [];               // reset for the next segment
                cumulativeSegment += segments.shift(); // add the next segment
                p2.setAttribute("d", cumulativeSegment);
                point = p.getPointAtLength(currentSegmentLength + .001)     // get the first point of the new segment
                add(point)
                currentSegmentLength = p2.getTotalLength();             // update the length for the new segment                            
            }
            point = p.getPointAtLength(j);
            add(point)
        }
        point = p.getPointAtLength(pathLength);
        add(point)
        if (points.length > 0) lines.push(points);
        p.setAttribute("d", originalPath); // restore the original path
        return lines
    },
    //======================================================================================================================
    //  simplify the lines. for all objectyds in the Dictionary that contain them
    simplifyLines = (Dictionary, tolerance) => {
        Object.values(Dictionary).forEach(obj => {
            if (obj.lines) {
                obj.lines = obj.lines.map(line => PATHTOOLS.simplifyPath(line, tolerance)
                )

            }
        })
    },
    //======================================================================================================================
    // convert the lines to a path array where each path is an object {attributes, points:[], firstPoint,LastPoint}                
    convertToPathArray = (Dictionary) => {
        let PathArray = []
        Object.values(Dictionary).forEach(obj => {
            if (obj.lines) {
                obj.lines.forEach(line => {
                    let path = { points: line, firstPoint: line[0], lastPoint: line[line.length - 1], attributes: obj.attributes }
                    PathArray.push(path)
                })
            }
        })
        return PathArray
    }


export let SVGTOOLS = { SVG2Doc, svgToObject, worldToCanvas, objectToSvg, drawSVGtoCanvas, Doc2SVG, CreateSVGElement, scaleCanvas, imageSize, convertToPaths, addPointArrays, path2pointarray, simplifyLines, convertToPathArray }
