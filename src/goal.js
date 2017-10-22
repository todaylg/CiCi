import CiCi from './CiCi.js';

/**
* Add Node and Edge Automatic
* @param {Number} nodeNum
* @param {Number} edgeNum
*/
autoGenera(nodeNum, edgeNum){
    let res = [];
    for (let i = 0; i < nodeNum; i++) {
        let temp = {};
        let data = temp.data = {};
        //Ascii => A => 65
        data.id = String.fromCharCode(65 + i);
        data.width = (Math.random() * 30) + 20;
        data.text = data.id;
        //data.textOpts = {lineWidth:30}
        if (i % 2 === 0) data.color = "#000";
        res.push(temp);
    }
    for (let i = 0; i < edgeNum; i++) {
        let randomNode1 = Math.floor(Math.random() * nodeNum);
        let randomNode2 = Math.floor(Math.random() * nodeNum);
        //toFix => Node can arrow itself
        if (randomNode1 === randomNode2) {
            if (randomNode1 === 1) {
                randomNode1++;
            } else {
                randomNode2++;
            }
        };
        let temp = {};
        let data = temp.data = {};
        data.id = String.fromCharCode(65 + nodeNum + i);
        data.source = res[randomNode1].data.id;
        data.target = res[randomNode2].data.id;
        data.text = data.id;
        data.textOpts = { color: '#000', outline: 2 }
        if (i % 2 == 0) data.curveStyle = 'bezier'
        if (i % 2 == 0) {
            data.targetShape = 'triangle';
            data.sourceShape = 'circle';
        } else {
            data.targetShape = 'circle';
            data.sourceShape = 'triangle';
        }
        res.push(temp);
    }
    return res;
}

CiCi({
    container: document.getElementById('testCanvas'),
    elements: autoGenera(6, 6)

})