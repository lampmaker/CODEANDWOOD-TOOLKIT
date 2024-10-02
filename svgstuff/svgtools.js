/* 
collection of tools for creating and modifying SVGS
*/

let
    parser = new DOMParser(), serializer = new XMLSerializer(),


    SVG2DOC = (svgData) => parser.parseFromString(svgData, 'image/svg+xml'),
    DOC2SVG = (svgDoc) => serializer.serializeToString(svgDoc),
    CREATE = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag),
    COPY = (obj) => JSON.parse(JSON.stringify(obj)),

    // Function to get the float value of an attribute, with a default value if not present
    attrFloat = (el, attr, defaultVal = 0) => parseFloat(el.getAttribute(attr)) || defaultVal,
    attrGet = (el, attr) => el.getAttribute(attr) || '',

    // Copy the attributes from source to target. If allowlist == null, copy all.
    // Otherwise, only copy the ones in the allowlist.
    copySVGAttributes = (sourceElement, targetElement, allowlist = null) => {
        Array.from(sourceElement.attributes).forEach(attr => {
            // Check if the attribute is in the allowlist or if allowlist is null (copy all)
            if ((!allowlist || allowlist.includes(attr.name)) && !targetElement.hasAttribute(attr.name)) {
                targetElement.setAttribute(attr.name, attr.value);
            }
        });
    },

    listAttributes = (element) => {
        Array.from(sourceElement.attributes).forEach(attr => console.log("Attribute: ", attr.name, "value:", attr.value))
    }



export let
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
                    copySVGAttributes(element, child)
                    flattened.push(child); // Non-group elements are added directly
                }
            }
        });
        return flattened;
    },

    //==================================================================================
    // convert an SVG element to a path element
    // copies the attributes if they are in the allowlist.
    elementToPathElement = el => {
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
        // Create a new path element
        const path = CREATE("path");
        path.setAttribute('d', str);
        // Copy other relevant attributes (e.g., fill, stroke, etc.)
        copySVGAttributes(el, path, "d,stroke,stroke-width,fill,style,stroke-linejoin,stroke-linecap,transform".split(","));
        return path;
    };


