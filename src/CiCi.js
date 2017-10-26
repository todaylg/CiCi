import * as d3 from 'd3-force';
import { CacBezierCurveMidPos, CacQuadraticCurveMidPos } from './Math';

let canvas, stage;

// Aliases
let Stage = createjs.Stage,
    StageGL = createjs.StageGL,
    Shape = createjs.Shape,
    Text = createjs.Text,
    Graphics = createjs.Graphics,
    Container = createjs.Container;

let edgeContainer = new Container(),
    arrowContainer = new Container(),
    nodeContainer = new Container(),
    textContainer = new Container(),
    dragContainer = new Container();

// For scale limmit
const SCALE_MAX = 100, SCALE_MIN = 0.2;

// Fix canvas position offset
const offsetX = 230, offsetY = 65;

// Defalut node radius
// Node shape default is circle
// FIXME: Other shape‘s support
let nodeWidth = 30;

// Cache the shape that what your mouse click generate
let point = {};

// Cache list
// Have unique identifiers => id
let nodeList = {},// Cache node
    edgeList = {},// Cache edge
    arrowList = {},// Cache arrow
    textList = {},// Cache text
    lineList = {},// Cache edge info

    bezierList = {},// Cache bezierCurve to Deal with 2 bezierCurve
    circleList = {};// Cache init node shape info


// Now is just for Bezier,TODO is for all(include straight use midPos to Calculate)
// let midPos;

// Fix Events trigger conflict between nativeEvent and CreatejsEvent
let nodeFlag = false;
let pinEffectFlag = false;
let simulation;// D3-force simulation

//Event 
let graphMousedownEvent, graphPressupEvent, graphPressmoveEvent;
/**
 * CreateCharts is the core method for initialization
 * @param {Object} opts
 * opts defined some init options
 * For example:(after "..." means no necessary)
 * {container: document.getElementById('canvas'),
 *  elements: {
 *      nodes:[{ id: 'a'
 *                      ...width:10,color:'black'},
 *             { id: 'b'
 *                      ...width:30,color:'#d3d3d3'}],
 *      edges:{ source:'a',target:'b'
 *                      ...curveStyle:'bezier',targetShape:'triangle',sourceShape:'circle'}}
 */
function CreateCharts({ container, elements }) {

    if (!container) return;// Todo => Throw error
    canvas = container;

    // Enable touch interactions if supported on the current device:
    createjs.Touch.enable(stage);
    // Enabled mouse over / out events
    stage = new Stage(canvas);

    // Auto update stage
    createjs.Ticker.timingMode = createjs.Ticker.RAF;
    createjs.Ticker.addEventListener("tick", stage);
    // Keep tracking the mouse even when it leaves the canvas
    stage.mouseMoveOutside = true;
    stage.enableMouseOver(10);

    let { nodes, edges } = elements;

    //Init canvas property
    canvas.height = window.innerHeight - offsetY;
    canvas.width = window.innerWidth - offsetX;
    canvas.style.background = '#d3d3d3';

    //Init node
    initializeNodes(nodes, edges);

    // Init event
    initEvent(canvas);

    // Hierarchy order
    stage.addChild(edgeContainer);
    stage.addChild(arrowContainer);
    stage.addChild(nodeContainer);// Node above edge and arrow
    stage.addChild(textContainer);// Text above node
    stage.addChild(dragContainer);// Hightest level
}

/**
 * InitializeNodes method use for layout and paint nodes
 * @param {Array} nodes
 * @param {Array} edges
 */
function initializeNodes(nodes, edges) {
    //D3-force Layout
    simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-30).distanceMin(30))
        .force('link', d3.forceLink(edges).id((d) => d.id).distance(330))//节点的查找方式为其id值
        .force('center', d3.forceCenter(canvas.width / 2, canvas.height / 2))
        //.force("collide", d3.forceCollide().radius(function(d) { return d.width; }).strength(0.7).iterations(1))
        .force("x", d3.forceX().strength(0.1))
        .force("y", d3.forceY().strength(0.1))

    //初始化节点和节点文字
    for (let i = 0, l = nodes.length, node; i < l; i++) {
        node = nodes[i];
        nodeList[node.id] = node;
        //Draw node
        let graphics = new Shape();
        let circle = graphics.graphics;
        if (node.color) {
            circle.beginFill(node.color);
        } else {
            circle.beginFill("#66CCFF");
        }

        drawText(node, node.x, node.y);

        let width = nodeWidth;
        if (node.width) width = node.width;
        circle.drawCircle(0, 0, width);
        circle.endFill();

        graphics = setNode(graphics, node.id, pinEffectFlag);

        //Move the graph to its designated position
        graphics.x = node.x;
        graphics.y = node.y;
        circleList[node.id] = graphics;
        nodeContainer.addChild(graphics);
    }

    let ticked = function () {
        nodes.forEach(drawNode);
        edges.forEach(drawEdge);
        stage.update();
    }

    let drawNode = function (node) {
        //只需要移动位置
        circleList[node.id].x = node.x;
        circleList[node.id].y = node.y;
        updateText(node.id, { x: node.x, y: node.y });
    }

    let drawEdge = function (edge) {
        drawArrowAndEdge(edge, edge.source, edge.target);
    }

    simulation.on('tick', ticked);
}

/**
 * DrawText method use for update text when node position change
 * @param {Object} nodeInfo 
 * text=>node text to show 
 * id=> use for set text id 
 * x/y => text position
 * textOpts => text style
 */
function drawText({ text, id, textOpts = {} }, x, y) {
    if (text === '' || text === undefined) return;
    if (textList[id]) textContainer.removeChild(textList[id]);
    let nodeText = new Text(text, textOpts.font || '36px Arial', textOpts.color || 'white');
    x += textOpts.disX || 0;
    y += textOpts.disY || 0;

    nodeText.textAlign = 'center';
    nodeText.textBaseline = 'middle';
    nodeText = Object.assign(nodeText, textOpts);
    nodeText.x = x;
    nodeText.y = y;
    // Cache text
    textList[id] = nodeText;
    textContainer.addChild(nodeText);
}

/**
 * UpdateText method use for update text when node position change
 * @param {String} id
 * @param {Object} newPos
 */
let updateText = function (id, newPos) {
    textList[id].x = newPos.x;
    textList[id].y = newPos.y;
}

/**
 * SetNode method use for init node's event when dragging node
 * @param {Shape} graph
 * @param {String} id
 * @return {Shape}
 */
function setNode(graph, id, pinFlag) {
    let onDragEnd;
    if (pinFlag) {
        onDragEnd = function (event) {
            simulation.alphaTarget(0);
            //Sticky or not
            // nodeList[id].fx = null;
            // nodeList[id].fy = null;
            let target = event.target;
            target.dragging = false;
            // Set the interaction data to null
            target.data = null;
            // Put back the original container
            dragContainer.removeChild(this);
            dragContainer.removeChild(textList[id]);
            nodeContainer.addChild(this);
            textContainer.addChild(textList[id]);
            nodeFlag = false;
        }
    } else {
        onDragEnd = function (event) {
            simulation.alphaTarget(0);
            //Sticky or not
            nodeList[id].fx = null;
            nodeList[id].fy = null;
            let target = event.target;
            target.dragging = false;
            // Set the interaction data to null
            target.data = null;
            // Put back the original container
            dragContainer.removeChild(this);
            dragContainer.removeChild(textList[id]);
            nodeContainer.addChild(this);
            textContainer.addChild(textList[id]);
            nodeFlag = false;
        }
    }

    let onDragStart = function (event) {
        simulation.alphaTarget(0.3).restart();
        event.stopPropagation();// FIXME
        nodeFlag = true;
    }



    let onDragMove = function (event) {
        let newPosition = stage.globalToLocal(event.stageX, event.stageY);
        this.x = newPosition.x;
        this.y = newPosition.y;
        updateNode(id, newPosition);
        // data drive document
        //updateEdge(id, newPosition);// change node pos enough
        updateText(id, newPosition);
        textContainer.removeChild(textList[id]);
        nodeContainer.removeChild(this);
        dragContainer.addChild(this);
        dragContainer.addChild(textList[id]);
    }

    //图钉效果
    let onDbClick = function () {
        nodeList[id].fx = null;
        nodeList[id].fy = null;
    }

    let updateNode = function (id, newPos) {
        nodeList[id].x = newPos.x;
        nodeList[id].y = newPos.y;
        nodeList[id].fx = newPos.x;
        nodeList[id].fy = newPos.y;
    }

    graph.cursor = "pointer";
    graph.on('mousedown', onDragStart);
    graph.on('pressup', onDragEnd);
    graph.on('pressmove', onDragMove);
    if (pinFlag) {
        graph.on('dblclick', onDbClick);
    }

    return graph;
}

function resetNodes() {
    for (let circle in circleList) {
        circleList[circle].removeAllEventListeners();
        setNode(circleList[circle], circle, pinEffectFlag);
    }
}

/**
 * DrawArrowAndEdge method use for update the arrow and edge from node source and target position
 * @param {Object} data
 * @param {Object} source {x,y}
 * @param {Object} target {x,y}
 */
function drawArrowAndEdge(data, source, target) {

    // Remove old edge (drawArrowShape will remove old arrow)
    if (lineList[data.id]) edgeContainer.removeChild(lineList[data.id]);

    // Draw Arrow
    let newSourcePos, newTargetPos;
    if (data.targetShape) {
        switch (data.curveStyle) {
            case "bezier":
                // CacBezierCurve
                let bMidPos = CacBezierCurveMidPos(source, target);

                let pos2 = { x: bMidPos.x2, y: bMidPos.y2 }
                if (textList[data.id]) updateText(data.id, { x: (bMidPos.x1 + bMidPos.x2) / 2, y: (bMidPos.y1 + bMidPos.y2) / 2 });
                newTargetPos = drawArrowShape(data.id, data.targetShape, pos2, target, source, target, true);
                break;
            case "quadraticCurve":
                // QuadraticCurve
                let cMidPos = CacQuadraticCurveMidPos(source, target, 100);
                newTargetPos = drawArrowShape(data.id, data.targetShape, cMidPos, target, source, target, true);
                break;
            default:
                if (textList[data.id]) updateText(data.id, { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 });
                newTargetPos = drawArrowShape(data.id, data.targetShape, source, target, source, target, true);
                break;
        }
    }
    if (data.sourceShape) {
        switch (data.curveStyle) {
            case "bezier":
                // Cacular Third Bezier Curve's Mid pos
                let bMidPos = CacBezierCurveMidPos(source, target);
                let pos1 = { x: bMidPos.x1, y: bMidPos.y1 }

                if (textList[data.id]) updateText(data.id, { x: (bMidPos.x1 + bMidPos.x2) / 2, y: (bMidPos.y1 + bMidPos.y2) / 2 });
                newSourcePos = drawArrowShape(data.id, data.sourceShape, source, pos1, source, target, false);
                break;
            case "quadraticCurve":
                // Cacular Second Bezier Curve's Mid pos
                let cMidPos = CacQuadraticCurveMidPos(source, target, 100);
                newSourcePos = drawArrowShape(data.id, data.sourceShape, source, cMidPos, source, target, false);
                break;
            default:
                if (textList[data.id]) updateText(data.id, { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 });
                newSourcePos = drawArrowShape(data.id, data.sourceShape, source, target, source, target, false);
                break;
        }
    }

    let tempSourcePos = newSourcePos ? newSourcePos : source;
    let tempTargetPos = newTargetPos ? newTargetPos : target;

    //Draw edge
    let graphics = new Shape();
    let line = graphics.graphics;
    if (data.lineMode === "dash") {//Todo => param
        line.setStrokeStyle(4).setStrokeDash([20, 10], 0).beginStroke("#FFF");
    } else {
        line.setStrokeStyle(4).beginStroke("#FFF");
    }
    line.moveTo(tempSourcePos.x, tempSourcePos.y);
    if (data.curveStyle) {
        switch (data.curveStyle) {
            case "bezier":
                // Cacular Third Bezier Curve's Mid pos
                let cPos = CacBezierCurveMidPos(tempSourcePos, tempTargetPos, 100);
                line.bezierCurveTo(cPos.x1, cPos.y1, cPos.x2, cPos.y2, cPos.x, cPos.y);
                break;
            case "quadraticCurve":
                // Cacular Second Bezier Curve's Mid pos
                let bPos = CacQuadraticCurveMidPos(tempSourcePos, tempTargetPos, 100);
                line.quadraticCurveTo(bPos.x, bPos.y, tempTargetPos.x, tempTargetPos.y);
                break;
        }
    } else {
        line.lineTo(tempTargetPos.x, tempTargetPos.y);
    }

    lineList[data.id] = graphics;

    edgeContainer.addChild(graphics);
}

/**
 * DrawArrowShape method use for draw the arrow from node source and target position 
 * @param {String} id arrow's id
 * @param {String} shape arrow's shape
 * @param {Object} sourcePos {x,y} node source pos
 * @param {Object} targetPos {x,y} node target pos
 * @param {Object} source {x,y} arrow source pos
 * @param {Object} target {x,y} arrow target pos
 * @param {Bool} targetFlag  draw source or target arrow
 */
function drawArrowShape(id, shape, sourcePos, targetPos, source, target, targetFlag) {
    switch (shape) {
        case 'circle':
            let c_nodeRadius = nodeWidth;
            if (!targetFlag && sourcePos.width) c_nodeRadius = sourcePos.width;
            if (targetFlag && targetPos.width) c_nodeRadius = targetPos.width;

            //Boundary determination => hide it if stick together
            if ((Math.abs(source.y - target.y) < c_nodeRadius * 1.5) &&
                (Math.abs(source.x - target.x) < c_nodeRadius * 1.5)) {
                c_nodeRadius = 0;
                if (textList[id]) textList[id].visible = false;
            }

            let srcPos = targetFlag ? targetPos : sourcePos;
            let tgtPos = targetFlag ? sourcePos : targetPos;

            let c_angle = Math.atan(Math.abs(srcPos.y - tgtPos.y) / Math.abs(srcPos.x - tgtPos.x))
            let circleWidth = c_nodeRadius / 2;
            // posX and posY is the circle's final position
            let posX = (c_nodeRadius + circleWidth) * Math.cos(c_angle),
                posY = (c_nodeRadius + circleWidth) * Math.sin(c_angle);

            // Discusses the relative position of target and source
            if (srcPos.x > tgtPos.x) {// Source node is right
                posX = srcPos.x - posX;
            } else {
                posX = srcPos.x + posX;
            }
            if (srcPos.y > tgtPos.y) {// Source node is Up
                posY = srcPos.y - posY;
            } else {
                posY = srcPos.y + posY;
            }

            //Draw circle
            let cGraphics = new Shape();
            let circle = cGraphics.graphics;
            circle.beginFill("#66CCFF");

            circle.drawCircle(0, 0, circleWidth);
            circle.endFill();

            cGraphics.x = posX;
            cGraphics.y = posY;

            //updateArrow 
            updateArrow(id, cGraphics, targetFlag);

            return {
                x: posX,
                y: posY
            }

        case 'triangle':
            //这个三角形默认按顶角为50°，两个底角为65°来算，两边长先按一半nodeWidth来算吧
            let t_nodeRadius = nodeWidth;
            if (!targetFlag && sourcePos.width) t_nodeRadius = sourcePos.width;
            if (targetFlag && targetPos.width) t_nodeRadius = targetPos.width;

            //Boundary determination
            if ((Math.abs(source.y - target.y) < t_nodeRadius * 1.5) &&
                (Math.abs(source.x - target.x) < t_nodeRadius * 1.5)) {
                t_nodeRadius = 0;
                if (textList[id]) textList[id].visible = false;
            }

            let t_srcPos = targetFlag ? sourcePos : targetPos;
            let t_tgtPos = targetFlag ? targetPos : sourcePos;

            let topAngle = Math.PI / 180 * 50,//角度转弧度，注意Math的那些方法的单位是弧度
                sideEdge = t_nodeRadius,//瞅着合适，先凑合
                halfBottomEdge = Math.sin(topAngle / 2) * sideEdge,
                centerEdge = Math.cos(topAngle / 2) * sideEdge;

            //angle是一样的，先按node中心算，arrow中心算之后再说，先todo(直线版看出不这个问题，曲线就崩了)
            let angle = Math.atan(Math.abs(t_srcPos.y - t_tgtPos.y) / Math.abs(t_srcPos.x - t_tgtPos.x));
            let beginPosX = t_nodeRadius * Math.cos(angle),
                beginPosY = t_nodeRadius * Math.sin(angle),
                pos1X, pos1Y, pos2X, pos2Y,
                centerX = (t_nodeRadius + centerEdge) * Math.cos(angle),
                centerY = (t_nodeRadius + centerEdge) * Math.sin(angle);

            pos1X = pos2X = Math.sin(angle) * halfBottomEdge;
            pos1Y = pos2Y = Math.cos(angle) * halfBottomEdge;//简单的几何知识(手动抽搐😖)

            //还需要分类讨论target和source的左右位置的各种情况
            //1234代表target相对source所在象限
            if (t_srcPos.x > t_tgtPos.x) {//source节点在右
                if (t_srcPos.y > t_tgtPos.y) {//下 ----> 1
                    beginPosX = t_tgtPos.x + beginPosX;
                    beginPosY = t_tgtPos.y + beginPosY;

                    centerX = t_tgtPos.x + centerX;
                    centerY = t_tgtPos.y + centerY;

                    pos1X = centerX + pos1X;
                    pos1Y = centerY - pos1Y;//+ -

                    pos2X = centerX - pos2X;
                    pos2Y = centerY + pos2Y;//- +
                } else {//上 ----> 4
                    beginPosX = t_tgtPos.x + beginPosX;
                    beginPosY = t_tgtPos.y - beginPosY;

                    centerX = t_tgtPos.x + centerX;
                    centerY = t_tgtPos.y - centerY;

                    pos1X = centerX + pos1X;
                    pos1Y = centerY + pos1Y;//+ +

                    pos2X = centerX - pos2X;
                    pos2Y = centerY - pos2Y;//- -
                }

            } else {//source节点在左
                if (t_srcPos.y > t_tgtPos.y) {//下 ----> 2
                    beginPosX = t_tgtPos.x - beginPosX;
                    beginPosY = t_tgtPos.y + beginPosY;

                    centerX = t_tgtPos.x - centerX;
                    centerY = t_tgtPos.y + centerY;

                    pos1X = centerX - pos1X;
                    pos1Y = centerY - pos1Y;//- -

                    pos2X = centerX + pos2X;
                    pos2Y = centerY + pos2Y;//+ +
                } else {//上 ----> 3
                    beginPosX = t_tgtPos.x - beginPosX;
                    beginPosY = t_tgtPos.y - beginPosY;

                    centerX = t_tgtPos.x - centerX;
                    centerY = t_tgtPos.y - centerY;

                    pos1X = centerX - pos1X;
                    pos1Y = centerY + pos1Y;//- +

                    pos2X = centerX + pos2X;
                    pos2Y = centerY - pos2Y;//+ -
                }
            }

            //Draw triangle
            let tGraphics = new Shape();
            let triangle = tGraphics.graphics;

            triangle.beginFill("#66CCFF");
            //triangle.lineStyle(0, 0x66CCFF, 1);
            triangle.moveTo(beginPosX, beginPosY);
            triangle.lineTo(pos1X, pos1Y);
            triangle.lineTo(pos2X, pos2Y);
            triangle.endFill();

            updateArrow(id, tGraphics, targetFlag);

            return {
                x: centerX,
                y: centerY
            }
    }
}

/** 
 * @param {String} id arrow's id
 * @param {String} shape arrow's shape
 * @param {Bool} targetFlag  source or target arrow
 */
function updateArrow(id, shape, targetFlag) {
    if (!arrowList[id]) arrowList[id] = {};
    if (!targetFlag) {//Source arrow
        if (arrowList[id].sourceArrow) arrowContainer.removeChild(arrowList[id].sourceArrow);
        //save newArrow
        arrowList[id].sourceArrow = shape;
    } else {//Target arrow
        if (arrowList[id].targetArrow) arrowContainer.removeChild(arrowList[id].targetArrow);
        //save newArrow
        arrowList[id].targetArrow = shape;
    }
    arrowContainer.addChild(shape);
}

/** 
 * InitEvent method use for init canvas's zoom and drag event
 * @param canvas canvas to init 
 */
function initEvent(canvas) {

    // Scale/Zoom
    canvas.addEventListener('wheel', function (e) {
        if (e.deltaY < 0) {
            zooming(true, e.pageX, e.pageY);
        } else {
            zooming(false, e.pageX, e.pageY);
        }
    });

    function zooming(zoomFlag, x, y) {
        //Current scale    
        let scale = stage.scale;
        let point = toLocalPos(x, y);
        // //Zooming    
        if (zoomFlag) {
            if (scale < SCALE_MAX) {
                scale += 0.1;
                //moving      
                stage.x = stage.x - (point.x * 0.1),
                    stage.y = stage.y - (point.y * 0.1);
            }
        } else {
            if (scale > SCALE_MIN) {
                scale -= 0.1;
                //moving
                stage.x = stage.x - (point.x * -0.1),
                    stage.y = stage.y - (point.y * -0.1);
            }
        }
        stage.scale = scale;
    }


    // Drag/Move
    let movePosBegin = {};
    let startMousePos = {};
    let hitArea = new Shape();
    let canvasDragging = false;

    // Could use bind
    canvas.addEventListener('mousedown', stagePointerDown);
    canvas.addEventListener('mouseup', stagePointerUp);
    canvas.addEventListener('mouseout', stagePointerUp);
    canvas.addEventListener('mousemove', stagePointerMove);
    canvas.addEventListener('contextmenu', onContextMenu);

    let menu = document.querySelector('.menu');
    let pinEffectButton = document.querySelector('#pin');
    pinEffectButton.addEventListener('click', pinEffect);

    function pinEffect() {
        pinEffectFlag = !pinEffectFlag;
        resetNodes();
        hideMenu();
    }

    function onContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        let localPos = toLocalPos(e.pageX, e.pageY)
        showMenu(localPos.x, localPos.y);
        canvas.addEventListener('mousedown', onMouseDown);
        if (pinEffectFlag) {
            document.querySelector('#pin span').innerText = '关闭图钉效果';
        } else {
            document.querySelector('#pin span').innerText = '启用图钉效果';
        }
    }

    function onMouseDown(e) {
        hideMenu();
        document.removeEventListener('mousedown', onMouseDown);
    }

    function showMenu(x, y) {
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show-menu');
    }

    function hideMenu() {
        menu.classList.remove('show-menu');
    }

    function stagePointerDown(event) {
        if (!nodeFlag) {
            canvasDragging = true;

            movePosBegin.x = stage.x;
            movePosBegin.y = stage.y;

            startMousePos.x = event.pageX;
            startMousePos.y = event.pageY;
            //Draw circle
            let r = 30 / stage.scale;
            drawCircle(startMousePos.x, startMousePos.y, r);
        }

    }

    function stagePointerUp(event) {
        canvasDragging = false;
        //Remove  circle
        if (point.circle) dragContainer.removeChild(point.circle);
    }

    function stagePointerMove(event) {
        if (canvasDragging && !nodeFlag && event.which === 1) {
            //Move  circle
            let x = event.pageX;
            let y = event.pageY;

            //Remove  circle first
            if (point.circle) dragContainer.removeChild(point.circle);
            //Redraw circle
            //Current scale    
            let scale = stage.scale;
            let r = 30 / scale;
            drawCircle(x, y, r);

            let offsetX = x - startMousePos.x,//差值
                offsetY = y - startMousePos.y;

            stage.x = movePosBegin.x + offsetX;
            stage.y = movePosBegin.y + offsetY;//修正差值
        }

    }
}

function toLocalPos(x, y) {
    let localPos = stage.globalToLocal(x - offsetX, y - offsetY);
    return localPos;
}

function drawCircle(x, y, r = 30) {
    //Draw circle
    let cGraphics = new Shape();
    let circle = cGraphics.graphics;
    circle.beginFill(Graphics.getRGB(0, 0, 0, 0.2));//alpha

    circle.drawCircle(0, 0, r);
    circle.endFill();

    let localPos = toLocalPos(x, y);
    cGraphics.x = localPos.x;
    cGraphics.y = localPos.y;

    point.circle = cGraphics;
    dragContainer.addChild(cGraphics);
}

export default CreateCharts;