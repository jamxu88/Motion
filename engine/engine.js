let typingTimer;
let doneTypingInterval = 1000;
let acText = "";
let predicted = false;
let typing = false;
let oLCount = 0;
let pageId = "";

function moveCaretToEnd(contentEditableElement)
{
    var range,selection;
    if(document.createRange)//Firefox, Chrome, Opera, Safari, IE 9+
    {
        range = document.createRange();//Create a range (a range is a like the selection but invisible)
        range.selectNodeContents(contentEditableElement);//Select the entire contents of the element with the range
        range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
        selection = window.getSelection();//get the selection object (allows you to change selection)
        selection.removeAllRanges();//remove any selections already made
        selection.addRange(range);//make the range you have just created the visible selection
    }
    else if(document.selection)//IE 8 and lower
    { 
        range = document.body.createTextRange();//Create a range (a range is a like the selection but invisible)
        range.moveToElementText(contentEditableElement);//Select the entire contents of the element with the range
        range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
        range.select();//Select the range (make it the visible selection
    }
}

function setEndOfContenteditable(elem) {
    let sel = window.getSelection()
    sel.selectAllChildren(elem)
    sel.collapseToEnd()
}


// Load Saved Data
document.addEventListener("DOMContentLoaded", async function() {
    await fetch(`http://0.0.0.0:3333/pages`, {
            method: "GET"
        }).then(async resp => {
            let data = await resp.json();
            if(data[0]) {
                pageId = data[0].id;
                await fetch(`http://0.0.0.0:3333/data`, {
                    method: "POST",
                    body: pageId
                }).then(async resp => {
                    let data;
                    try {
                        data = await resp.json();
                    }catch(e) {
                        data = null
                    }
                    if(data) {
                        document.getElementById("editor").innerHTML = data.text;
                        document.getElementById("pagetitle").value = data.title;
                    }
                    document.getElementById("outlinecontent").innerHTML = data.outline
                    oLCount = data.olCount;
                })
                data.forEach(page => {
                    document.getElementById("pageSelection").innerHTML += `<option value="${page}">${page.title}</option>`
                })
            }
        })
    
})



// Paste without formatting
/*
editor.addEventListener("paste", function(e) {
    e.preventDefault();

    if (e.clipboardData) {
        content = (e.originalEvent || e).clipboardData.getData('text/plain');

        document.execCommand('insertText', false, content);
    }
    else if (window.clipboardData) {
        content = window.clipboardData.getData('Text');

        document.selection.createRange().pasteHTML(content);
    }   
});*/

document.addEventListener("click", (e) => {
    if(e.target.id == "ac-data") {
        removeAc();
    }
    if(e.target.id.startsWith("ol-")) {
        scrollToElement(document.getElementById(e.target.id.replace("ol-", "olb-")));
    }
    if(e.target.id == "opagetitle") {
        scrollToElement(document.getElementById("pagetitle"));
    }
})

// Typing State
document.addEventListener('keydown', function(e) {
    document.getElementById("changesState").innerHTML = "Saving...";
    clearTimeout(typingTimer);
    typing = true;
    if(acText) {
        if(e.key == "Tab") {
            e.preventDefault();
            addAc();
        } else {
            removeAc();
        }
    }
})

function scrollToElement(element) {
    const y = element.getBoundingClientRect().top + window.scrollY - 32;
    window.scroll({
        top: y,
        behavior: 'smooth'
    });
}

function insertEmptyDiv() {
    document.getElementById("editor").innerHTML = "<div><br></div>";
    setEndOfContenteditable(document.getElementById("editor").children[0])
}

// Create a mutation observer on the editor
const editorMarkdown = new MutationObserver((m) => {
    m.forEach(mutation => {
        if(mutation.type == "childList") {
            if(mutation.addedNodes.length > 0) {
                if(mutation.target.id == "editor" && mutation.addedNodes[0].nodeName == "BR" && mutation.target.childElementCount == 1) {
                    insertEmptyDiv();
                }
                if(mutation.addedNodes[0].id == mutation.nextSibling.id) {
                    mutation.addedNodes[0].id = "removeme"
                    mutation.addedNodes[0].remove();
                    let elem = document.createElement("div");
                    elem.innerHTML = "<br>";
                    mutation.target.insertBefore(elem, mutation.nextSibling);
                }
            }
            if(mutation.removedNodes.length > 0) {
                let removedNodes = mutation.removedNodes;
                for(let i = 0; i < removedNodes.length; i++) {
                    if(removedNodes[i].id != null) {
                        if(removedNodes[i].id.startsWith("olb-")) {
                            document.getElementById(removedNodes[i].id.replace("olb-", "ol-")).remove();
                        }
                    }
                    if(removedNodes[i].nodeName == "#text" && mutation.target.id.startsWith("olb-")) {
                        document.getElementById(mutation.target.id.replace("olb-","ol-")).innerText = "";
                    }
                }
                if(document.getElementById("editor").children.length == 0) {
                    insertEmptyDiv();
                }
            }
        }

        if(mutation.type == "characterData" && mutation.target.parentNode) {
            if((mutation.target.parentElement.tagName == "H1" || mutation.target.parentElement.tagName == "H2" || mutation.target.parentElement.tagName == "H3") && mutation.target.parentElement.id != "pagetitle") {
                document.getElementById(mutation.target.parentElement.id.replace("olb-", "ol-")).innerText = mutation.target.textContent;
            }
            if(mutation.target.parentElement.id == "pagetitle") {
                document.getElementById("opagetitle").innerText = mutation.target.textContent;
            }
            
            if(mutation.target.textContent) {
                // Headings
                if(mutation.target.textContent.startsWith("#") && /\s$/.test(mutation.target.textContent) && mutation.target.parentElement.tagName == "DIV") {
                    // Count how many # at the start of the string
                    let count = 0;
                    for(let i = 0; i < mutation.target.textContent.length; i++) {
                        if(mutation.target.textContent[i] == "#") {
                            count++;
                        }
                    }
                    if(count > 3) count = 3;
                    let elem;
                    if(count == 3) {
                        mutation.target.parentElement.outerHTML = `<h${count} class="text-white font-semibold text-xl" id="olb-${oLCount}"><br></h${count}>`;
                        elem = document.createElement("ul");
                        elem.innerHTML = `<ul><li class="text-[#DDDDDD] indent-6 cursor-pointer px-2 hover:bg-[#202020] w-52 whitespace-nowrap text-ellipsis overflow-hidden text-lg" id="ol-${oLCount}"></li></ul>`;
                        
                    }
                    if(count == 2) {
                        mutation.target.parentElement.outerHTML = `<h${count} class="text-white font-semibold text-2xl" id="olb-${oLCount}"><br></h${count}>`;
                        elem = document.createElement("ul");
                        elem.innerHTML = `<ul><li class="text-[#DDDDDD] indent-4 cursor-pointer px-2 hover:bg-[#202020] w-52 whitespace-nowrap text-ellipsis overflow-hidden text-lg" id="ol-${oLCount}"></li></ul>`;
                    }
                    if(count == 1) {
                        mutation.target.parentElement.outerHTML = `<h${count} class="text-white font-bold text-3xl" id="olb-${oLCount}"><br></h${count}>`;
                        elem = document.createElement("li");
                        elem.innerHTML = `<li class="text-[#DDDDDD] cursor-pointer px-2 hover:bg-[#202020] w-52 whitespace-nowrap text-ellipsis overflow-hidden text-lg" id="ol-${oLCount}"></li>`;
                    }
                    let superior;
                    let lowest = count;
                    let numsup = 0;
                    let items = document.getElementById("editor").children;
                    // Reverse items
                    let reversed = [];
                    for(let i = items.length - 1; i >= 0; i--) {
                        if(items[i].tagName.startsWith("H")) reversed.push(items[i]);
                    }
                    let index = reversed.indexOf(document.getElementById(`olb-${oLCount}`));
                    for(let i = index; i < reversed.length; i++) {
                        numsup++;
                        if(parseInt(reversed[i].tagName.toString().slice(1)) < lowest) {
                            superior = reversed[i];
                            break;
                        }
                    }
                    
                    if(superior) {
                        document.getElementById(superior.id.replace("olb-", "ol-")).parentElement.insertBefore(elem,document.getElementById(superior.id.replace("olb-", "ol-")).parentElement.children[numsup-1])
                        console.log("hi")
                    }else {
                        document.getElementById("outlinecontent").appendChild(elem)
                    }
                    oLCount++;
                }
                // Bold
/*                 if(mutation.target.textContent.match(/\*(.+)\/gmi) && mutation.target.parentElement.tagName == "DIV") {
                    let text = mutation.target.textContent;
                    let newText = text.replace(/\*(.+)\/gmi, "<strong>$1</strong>");
                    console.log(newText)
                    mutation.target.parentElement.outerHTML = `<div>${newText}</div>`;
                    setEndOfContenteditable(mutation.target.parentElement)
                } */
                // Ordered Lists
                
                if(/[1]\.\s/.test(mutation.target.textContent) && mutation.target.parentElement.tagName == "DIV") {
                    mutation.target.parentElement.innerHTML = `<ol class="list-decimal list-inside"><li><br></li></ol>`;
                }
                // Unordered Lists
                if(/[-]\s/.test(mutation.target.textContent) && (mutation.target.parentElement.tagName == "DIV")) {
                    mutation.target.parentElement.innerHTML = `<ul class="list-disc list-inside"><li><br></li></ul>`;
                }
            }
        }
    })
})


editorMarkdown.observe(document.getElementById("editor"), {
    childList: true,
    subtree: true,
    characterData: true,
})

document.getElementById("pagetitle").addEventListener("keyup", (e) => {
    document.getElementById("opagetitle").innerText = e.target.value;
    if(e.target.value == "") {
        document.getElementById("opagetitle").innerText = "Untitled Page";
    }
})

document.getElementById("opagetitle").addEventListener("click", (e) => {
    // Extend/Collapse outline
})

// Adding Autocomplete text
function addAc() {
    if(acText) {
        document.getElementById("editor").removeChild(document.getElementById("editor").lastChild);
        acText = acText.replace(/\n/g, "<br>");
        document.getElementById("editor").innerHTML += acText;
        acText = "";
        moveCaretToEnd(document.getElementById("editor"));
        predicted = false;
    }
}

// Removing Autocomplete text
function removeAc() {
    if(acText) {
        document.getElementById("editor").removeChild(document.getElementById("editor").lastChild);
        acText = "";
        predicted = false;
    }
}


// Typing Timer
function doneTyping() {
    autoComplete()
    typing = false;
    clearInterval(typingTimer);
}

// Typing Timer
document.addEventListener("keyup", function(e) {
    clearTimeout(typingTimer);
    if(!acText) {
        typingTimer = setTimeout(doneTyping, doneTypingInterval);
    }
})

function generatePageId() {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < 10; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function autoComplete() {
    // Save the text
    if(!pageId) pageId = generatePageId();
    await fetch("http://0.0.0.0:3333/text", {
        method: "POST",
        body: JSON.stringify({
            pageId: pageId,
            title: document.getElementById("pagetitle").value,
            text: document.getElementById("editor").innerHTML,
            outline: document.getElementById("outlinecontent").innerHTML,
            olCount: oLCount
        })
    })
    // AI Request
    
    if(document.getElementById("editor").textContent.length > 1 && acText == "" && !predicted) {
        await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
                "Authorization": ,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "text-davinci-002",
                "prompt": document.getElementById("editor").textContent.slice(-256),
                "temperature": 0.7,
                "max_tokens": 256,
                "top_p": 1,
                "frequency_penalty": 0,
                "presence_penalty": 0,
            })
        }).then(async resp => {
            if(!typing) {
                let data = await resp.json();
                data = data.choices[0].text
                removeAc();
                acText += data;
                if(document.getElementById("editor").textContent.length > 10) {
                    let ac = document.createElement("span");
                    ac.classList.add("text-gray-600");
                    ac.id = "ac-data";
                    data = data.replace(/\n/g, "<br>");
                    ac.innerHTML = data;
                    document.getElementById("editor").appendChild(ac);
                    predicted = true;
                }
            }   
        })
    }
    document.getElementById("changesState").innerHTML = "Saved.";
}