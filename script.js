console.log('Script Started');

const baseURL = window.location.origin;

let testMarkdown = ''; // it will containe Markdown
let indent = 0; // for tracking indent
let lastIndent = 0; // preseve last indent
let endTag = []; // Stack of end-tags
let startTag = []; // Stack of start-tags
let questionBlock = false; //Count Questions.


class Router{

    constructor(containerID){
        this.containerID = containerID;
        this.hashURLMap = new Map();
        fetch(baseURL+'./scripts/routes.json').then(res => res.json().then(jsonObj => { 
            this.routes = jsonObj;
            this.routes.forEach(route => {
                this.hashURLMap.set(route.url,route);
            });
        }));
        this.expressRouteArray = [];
    }

    hashChanged(e){
        console.group("Router : HasheChanged");
        let url = new URL(e.newURL);
        let hash = url.hash;
        hash = hash.substr(1,hash.length);
        console.log("Hash :",hash);
        this.expressRouteArray.forEach(route =>{
            console.groupCollapsed("Testing :"+route.route);

            let testRegex = new RegExp(route.regex.substr(1,route.regex.length));
            console.log("Test Regex",testRegex);
            let matches = hash.match(testRegex);
            let matchedParam = [];
            if(matches != null){
                for(let i = 0; i < matches.length;i++){
                    if(route.paramMap.get(i) != undefined){
                        matchedParam.push( matches[i]) ;
                    }
                }
                console.log("Route found","Route : "+route.route,"Hash : "+hash, "URL",route.url);
                this.changeView({route:route,hash:hash,matchedParam:matchedParam});
                // route.callback(hash,...matchedParam);
                // opRoute.callback(hash,...matchedParam);
            }else{
                console.log("Route not found",route.route,hash);
            }

            console.groupEnd();
        });
        console.groupEnd();
    }

    changeView(opRoute){
        console.groupCollapsed('changeView');
        let hashURL = window.location.hash;
        hashURL = hashURL.substring(1,hashURL.length);
        router.routes.forEach(route => {
            if(route.routeName == hashURL){
                let response; 
                fetch(route.url)
                .then(markdown => {
                    if(markdown.status == 404){
                        console.log("URL not found");
                        window.history.back();
                    }else{
                        markdown.text()
                        .then(txt => parseMarkdown(txt,opRoute))
                        .catch(err => console.warn("Error in .text()",err))
                    }
                })
                .catch(err =>{
                    console.warn("Fetching failed",err);
                    window.history.back();
                });
            }else{
                console.log("Route not Matched",hashURL, route.routeName);
            }
        });
        console.groupEnd();
    }

    customRoute(expRegex,fn){
        console.group("customRoute");
        let counter = 0;
        let paramsMap = new Map();
        let regex = expRegex;
        let matches = expRegex.match(/(:[\w\d_-]*)/g);
        if(matches != null){
            matches.forEach(match => {
                regex = regex.replace(match,"([\\w\\d_-]*)");
                paramsMap.set(++counter,match);
            });
        }
        this.expressRouteArray.push({
            "route":expRegex,
            "regex": regex,
            "paramMap": paramsMap,
            "callback": fn
        });

        console.groupEnd();
    }
}

function parseLine(line){
    let boldMatches = line.match(/\*\*([\w\d.\s]*)\*\*/g);
    if (boldMatches != null){
        boldMatches.forEach(match =>{
            let replacement = match.substring(2,(match.length-2));
            line = line.replace(match,`<strong class="boldtext">${replacement}</strong>`);
        });
    }

    let italicMatches = line.match(/~~([\w\d.\s]*)~~/g);
    if (italicMatches != null){
        italicMatches.forEach(match =>{
            let replacement = match.substring(2,(match.length-2));
            line = line.replace(match,`<i class="italictext">${replacement}</i>`);
        });
    }
    
    let imageMatches = line.match(/!\[(.*)\]\(.*\)/g);
    if (imageMatches != null){
        // console.log(match);
        imageMatches.forEach(match =>{
            let anchorText = match.match(/!\[(.*)\]\((.*)\)/)[1];
            anchorText = anchorText.replace(/\.eps/,".jpg");
            let linkText = match.match(/!\[(.*)\]\((.*)\)/)[2];
            linkText = linkText.replace(/\.eps/,".jpg");
            line = line.replace(match,`<img class="img" src="${linkText}" alt="${anchorText}"></img>`);
        });
    }

    let linkMatches = line.match(/\[(.*)\]\(.*\)/g);
    if (linkMatches != null){
        linkMatches.forEach(match =>{
            const anchorText = match.match(/\[(.*)\]\((.*)\)/)[1];
            const linkText = match.match(/\[(.*)\]\((.*)\)/)[2];
            line = line.replace(match,`<a class="link" href="${linkText}">${anchorText}</a>`);
        });
    }

    if(line.match(/^#{1}\s(.*)/)){
        return {"type" : "H1", "line" : line.match(/^#{1}\s(.*)/)[1]};
    };
    if(line.match(/^#{2}\s(.*)/)){
        return {"type" : "H2", "line" : line.match(/^#{2}\s(.*)/)[1]};
    };
    if(line.match(/^#{3}\s(.*)/)){
        return {"type" : "H3", "line" : line.match(/^#{3}\s(.*)/)[1]};
    };
    if(line.match(/^#{4}\s(.*)/)){
        return {"type" : "H4", "line" : line.match(/^#{4}\s(.*)/)[1]};
    };
    if(line.match(/^#{5}\s(.*)/)){
        return {"type" : "H5", "line" : line.match(/^#{5}\s(.*)/)[1]};
    };
    if(line.match(/^(\s*)>\s*(.*)/)){
        let indent = line.match(/^(\s*)>\s*(.*)/)[1];
        return {"type" : "quote", "line" : line.match(/^(\s*)>\s*(.*)/)[2], "indent": indent.length };
    };
    if(line.match(/^(\s*)\d\.\s*(.*)/)){
        let indent = line.match(/^(\s*)\d\.\s*(.*)/)[1].length;
        return {"type" : "orderedListItem", "line" : line.match(/^(\s*)\d\.\s*(.*)/)[2], "indent": indent };
    };
    if(line.match(/^(\s*)-\s*(.*)/)){
        let indent = line.match(/^(\s*)-\s*(.*)/)[1].length;
        return {"type" : "unorderedListItem", "line" : line.match(/^(\s*)-\s*(.*)/)[2], "indent": indent };
    };
    if(line.match(/^(\s*)?$/)){
        let indent = line.match(/^(\s*)?$/)[1] ;
        return {"type" : "emptyLine", "line" : line.match(/^(\s*)?$/)["input"], "indent": 0 };
    };
    if(line.match(/^(\s*)Q\.(\d)\.(\d)\s*(.*)/)){
        let indent  = line.match(/^(\s*)Q\.(\d)\.(\d)\s*(.*)/)[1];
        let chapter = line.match(/^(\s*)Q\.(\d)\.(\d)\s*(.*)/)[2];
        let questionNumber = line.match(/^(\s*)Q\.(\d)\.(\d)\s*(.*)/)[3];
        return {
            "type" : "question",
            "line" : line.match(/^(\s*)Q\.(\d)\.(\d)\s*(.*)/)[0], 
            "indent": indent.length,
            "chapter": chapter,
            "questionNumber": questionNumber
        };
    };
    return {"type":"line","line":line, "indent":0};
}

function generateHTMLFromParsedLine(index, parsedLine, nextLine){
    switch(parsedLine.type){
        case "H1" : {
            return `<h1 parsed-line-index='${index}'>${parsedLine.line}</h1>`; 
            break;
        }
        case "H2" : {
            return `<h2 parsed-line-index='${index}'>${parsedLine.line}</h2>`; 
            break;
        }
        case "H3" : {
            return `<h3 parsed-line-index='${index}'>${parsedLine.line}</h3>`; 
            break;
        }
        case "H4" : {
            return `<h4 parsed-line-index='${index}'>${parsedLine.line}</h4>`; 
            break;
        }
        case "H5" : {
            return `<h5 parsed-line-index='${index}'>${parsedLine.line}</h5>`; 
            break;
        }
        case "quote" : {
            return `<div class="quote" parsed-line-index='${index}'>${parsedLine.line}</div>`; 
            break;
        }
        case "emptyLine": {
            
            if(questionBlock){
                questionBlock = false;
                if(nextLine.type == "question"){
                    if(endTag.length > 0){
                        indent = 0;
                        return `${endTag.pop()}</div parsed-line-index='${index}>
                            <div class="mdl-card__actions mdl-card--border" parsed-line-index='${index}>
                            <a id="Comments" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">Comments</a>
                            <a id="ViewSolution" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">View Solution</a>
                            </div parsed-line-index='${index}></question-block><span class="emptyline" parsed-line-index='${index}'></span>`;
                    }else{
                        return `</div>
                            <div class="mdl-card__actions mdl-card--border">
                            <a id="Comments" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">Comments</a>
                            <a id="ViewSolution" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">View Solution</a>
                            </div></question-block><span class="emptyline" parsed-line-index='${index}'></span>`;
                    }
                }else{
                    return `</div>
                            <div class="mdl-card__actions mdl-card--border">
                            <a id="Comments" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">Comments</a>
                            <a id="ViewSolution" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">View Solution</a>
                            </div></question-block><span class="emptyline" parsed-line-index='${index}'></span>`;
                }
            }else if(endTag.length > 0){
                indent = 0;
                return `${endTag.pop()}`;
            }else{
                indent = 0;
                return `<span class="emptyline" parsed-line-index='${index}'></span>`;
            }

            
        }
        case "orderedListItem" : {
            if(nextLine == undefined){
                return `<li parsed-line-index='${index}'>${parsedLine.line}</li>`;
            }else if( (nextLine.type == "orderedListItem") || (nextLine.type == "unorderedListItem") ){
                if(nextLine.indent > indent ){
                    lastIndent = nextLine.indent;
                    indent = nextLine.indent;
                    endTag.push("</ol>");
                    nextLine.type == "orderedListItem" ? startTag.push("<ol>") : startTag.push("<ul>");
                    return `${startTag.pop()}<li parsed-line-index='${index}'>${parsedLine.line}</li>`;  
                }else if(nextLine.indent == indent ){
                    return `<li parsed-line-index='${index}'>${parsedLine.line}</li>`;
                }else if(nextLine.indent < indent ){
                    indent = nextLine.indent;
                    endTag.push("</ol>");
                    return `<li parsed-line-index='${index}'>${parsedLine.line}</li>${endTag.pop()}`;
                }
            }else{
                indent = lastIndent;
                return `<li parsed-line-index='${index}'>${parsedLine.line}</li>${endTag.pop()}`;
            }
            break;
        }
        case "unorderedListItem" : {
            if(nextLine == undefined){
                return `<li parsed-line-index='${index}'>${parsedLine.line}</li>`;
            }else if( (nextLine.type == "orderedListItem") || (nextLine.type == "unorderedListItem") ){
                if(nextLine.indent > indent ){
                    lastIndent = nextLine.indent;
                    indent = nextLine.indent;
                    endTag.push("</ul>");
                    nextLine.type == "orderedListItem" ? startTag.push("<ol>") : startTag.push("<ul>");
                    return `${startTag.pop()}<li parsed-line-index='${index}'>${parsedLine.line}</li>`;  
                }else if(nextLine.indent == indent ){
                    return `<li parsed-line-index='${index}'>${parsedLine.line}</li>`;
                }else if(nextLine.indent < indent ){
                    indent = nextLine.indent;
                    endTag.push("</ul>");
                    return `<li parsed-line-index='${index}'>${parsedLine.line}</li>${endTag.pop()}`;
                }
            }else{
                indent = lastIndent;
                return `<li parsed-line-index='${index}'>${parsedLine.line}</li>${endTag.pop()}`;
            } 
            
            break;
        }
        case "question" : {
            indent = 0;
            questionBlock = true;
            return `
            <question-block 
                class="questionblock mdl-card mdl-shadow--2dp" 
                data-chapter="${parsedLine.chapter}" 
                data-questionNumber="${parsedLine.questionNumber}" parsed-line-index='${index}'>
                
                <div class="questiontext ">
                    <div class="line" parsed-line-index='${index}'>${parsedLine.line}</div>`; 
            break;
        }
        case "line" : {
            indent = 0;

            if(questionBlock){
                return `<div class="questiontext line" parsed-line-index='${index}'>${parsedLine.line}</div>`; 
            }
            return `<div class="line" parsed-line-index='${index}'>${parsedLine.line}</div>`; 
            break;
        }        
    }
}

function parseMarkdown(content,opRoute){
    console.group('Parse Markdown');
    let parsedLines = [];
    testMarkdown = content.split(/\n/);
    testMarkdown.forEach(line => {
        let parsedLine = parseLine(line);
        parsedLines.push(parsedLine);
    });
    window._parsedLines = parsedLines;
    console.log("Parsing Done. You can see it with window._parsedLines");
    let htlmText = "";
    for(let i=0 ; i<parsedLines.length;i++){
        let parsedLine = parsedLines[i];
        let type = parsedLine;
        htlmText += generateHTMLFromParsedLine(i, parsedLines[i], parsedLines[i+1]);
    }
    window._generatedHTML = htlmText;
    console.log("HTML Generation Done. You can see it with window._generatedHTML");
    console.log("Inserting HTML using (position : beforeEnd) inside element with ID = 'container-view'")
    // document.getElementById(router.containerID).insertAdjacentHTML('beforeEnd',htlmText);
    document.getElementById(router.containerID).innerHTML = htlmText;
    MathJax.Hub.Typeset()
    opRoute.route.callback(opRoute.hash,...opRoute.matchedParam);
    console.groupEnd();
}


function prepareNavigation(){
    let naviationHTML = "";
    router.routes.forEach(route => {
        naviationHTML += `<a class="mdl-navigation__link" href="#${route.routeName}">${route.name}</a>`;
    });
    document.querySelectorAll("nav.mdl-navigation").forEach(nav =>{
        nav.innerHTML = naviationHTML;
    })
}



function changeView(){
    console.groupCollapsed('changeView');
    let hashURL = window.location.hash;
    hashURL = hashURL.substring(1,hashURL.length);
    router.routes.forEach(route => {
        if(route.routeName == hashURL){
            let response; 
            fetch(route.url)
            .then(markdown => {
                if(markdown.status == 404){
                    console.log("URL not found");
                    window.history.back();
                }else{
                    markdown.text()
                    .then(txt => parseMarkdown(txt))
                    .catch(err => console.warn("Error in .text()",err))
                }
            })
            .catch(err =>{
                console.warn("Fetching failed",err);
                window.history.back();
            });
        }else{
            console.log("Route not Matched",hashURL, route.routeName);
        }
    });
    console.groupEnd();
}




window.onhashchange = (e) => {
    let timestamp = e.timeStamp;
    let newURL = e.newURL;
    let oldURL = e.oldURL;
    router.hashChanged(e);  
}

window.onload = (e) => {
    elBody = document.getElementById('body');
    window.router = new Router('container-view');
    
    router.customRoute("/exercise/:name",chapterView);
    router.customRoute("/exercise/:name/:section",sectionView);
    router.customRoute("/home",home);
    router.customRoute("/contents",contents);
    
    
    setTimeout(()=>{
        window.location.hash = "#/";
    },30);
    setTimeout(()=>{
        window.location.hash = "#/home";
    },100);
}


/*********************View Controlers***********************/
// Not Implemented Yet
function home(hash){
    console.log("Home Route",hash);

}

function contents(hash){
    const toc = document.getElementById("tableofcontents");
    console.log(toc);
    router.routes.forEach(route => {
        if(route.type == "exercise"){
            let routeName = route.routeName.replace("/exercise/","").replace(/-/g," ");
            const txt = `<li><a href="#${route.routeName}">${routeName}</a></li>`;
            toc.insertAdjacentHTML('beforeEnd',txt);
        }
    })

}

function chapterView(hash,name){
    console.log("Chapter ", name);
}

function sectionView(hash,name,section){
    console.log("Chapter ", name, "Section",section);
}
/*********************View Controllers End***********************/


/*********************Custom Element Start***********************/
class QuestionBlock extends HTMLElement{
    constructor(){
        super();
        // console.log("Question Block Inistiated");
    }

    connectedCallback(){
        // console.log("Connected Callback");
    }

    disconnectedCallback(){
        // console.log("DisConnected Callback");
    }
}
customElements.define('question-block', QuestionBlock);
/*********************Custom Element End***********************/
