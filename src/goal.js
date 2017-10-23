import CiCi from './CiCi.js';

/**
* Add Node and Edge Automatic
* @param {Number} nodeNum
* @param {Number} edgeNum
*/
function autoGenera(nodeNum,edgeNum){
    let resObj = {},nodes = [],edges = [];
    for(let i=0;i<nodeNum;i++){
        let data = {};
        //Ascii => A => 65
        data.id = String.fromCharCode(65+i);
        data.width = (Math.random()*30)+20;
        data.text = data.id;
        //data.textOpts = {lineWidth:30}
        if(i%2===0)data.color="#000";
        nodes.push(data);
    }
    for(let i=0;i<edgeNum;i++){
        let randomNode1 = Math.floor(Math.random()*nodeNum);
        let randomNode2 = Math.floor(Math.random()*nodeNum);
        //toFix => Node can arrow itself
        if(randomNode1 === randomNode2){
            if(randomNode1===1){
                randomNode1++;
            }else{
                randomNode2++;
            }
        };
        let data = {};
        data.id = String.fromCharCode(65+nodeNum+i);
        data.source = nodes[randomNode1].id;
        data.target = nodes[randomNode2].id;
        data.text = data.id;
        data.textOpts = {color:'#000',outline:2}
        if(i%2==0)data.curveStyle = 'bezier'
        if(i%3==0)data.lineMode = 'dash'
        if(i%2==0){
            data.targetShape='triangle';
            data.sourceShape='circle';
        }else{
            data.targetShape='circle';
            data.sourceShape='triangle';
        }
        edges.push(data);
    }
    resObj.nodes = nodes;
    resObj.edges = edges;
    return resObj;
}

CiCi({
    container: document.getElementById('testCanvas'),
    elements: autoGenera(6, 6)

})