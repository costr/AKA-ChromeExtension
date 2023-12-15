// content.js
class FoundWordTracker {
    constructor() {
        this.wordAndCount = [];
    }

    add(word) {
        let count = 1;
        let index = this.wordAndCount.findIndex(wordAndCount => wordAndCount.word === word);
        if (index !== -1) {
            count = this.wordAndCount[index].count + 1;
            this.wordAndCount.splice(index, 1);
            return;
        }
        this.wordAndCount.push({ word: word, count: count });
    }

    getTotal() {
        return this.wordAndCount.reduce((total, wordAndCount) => total + wordAndCount.count, 0);
    }
}

let foundWordTracker = new FoundWordTracker();

chrome.storage.local.get('akas', function (data) {
    console.log('akas', data.akas);
    let akas = data.akas || [];

    if (akas.length === 0) {
        return;
    }

    akas.forEach(replaceWords);

    // get total of replacedWordsCount of all akas
    let totalReplacedWordsCount = akas.reduce((total, aka) => total + aka.replacedWordsCount, 0);
    console.log('totalReplacedWordsCount', totalReplacedWordsCount);
    chrome.runtime.sendMessage({ method: "contentFound", data: totalReplacedWordsCount });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "replaceWords") {
        console.log('replaceWords', request?.data);
        request?.data?.forEach(replaceWords);
        console.log('foundWordTracker.getTotal()', foundWordTracker.getTotal());
        chrome.runtime.sendMessage({ method: "contentFound", data: foundWordTracker.getTotal() });
        return;
    }

    if (request.action === "getAkaCounts") {
        console.log('getAkaCounts');

        console.trace();
        let elements = document.querySelectorAll('.akaHidden');
        let counts = {};
        elements.forEach(element => {
            let rootWord = element.dataset.rootWord;
            if (!counts[rootWord]) {
                counts[rootWord] = 0;
            }
            counts[rootWord]++;
        });

        sendResponse({ counts: counts });
        return;
    }
});

function replaceWords(aka) {
    console.log('replaceWords', aka.rootWord, aka.aka);
    // create array for tracking the words that have been replaced
    let replacedWordsCount = 0;
    if (aka.global || window.location.href.includes(aka.tabUrl)) {
        let regexFlags = `g${aka?.ignoreCase ? 'i' : ''}`;
        let regex = new RegExp(aka.rootWord, regexFlags);

        function replaceInNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.match(regex)) {
                    // if the parent node has the class akaHidden, then the node has already been replaced
                    if (node.parentNode.classList.contains('akaHidden')) {
                        return;
                    }

                    const clonedNode = node.parentNode.cloneNode(true);
                    clonedNode.textContent = clonedNode.textContent.replace(regex, `${aka.aka}${aka.showOriginalWithAka ? ` (${aka.rootWord})` : ''}`);

                    // insert the cloned node in the parent node of the original node
                    node.parentNode.parentNode.insertBefore(clonedNode, node.parentNode.nextSibling);
                    node.parentNode.classList.add('akaHidden');
                    node.parentNode.dataset.rootWord = aka.rootWord;
                    node.parentNode.style.display = 'none';

                    foundWordTracker.add(aka.rootWord);
                    replacedWordsCount++;
                }
            } else {
                node.childNodes.forEach(replaceInNode);
            }
        }
        replaceInNode(document.body);
        aka.replacedWordsCount = replacedWordsCount;
    }
}
