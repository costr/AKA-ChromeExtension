// popup.js
document.getElementById('akaForm').addEventListener('submit', function (event) {
    event.preventDefault();

    let wordToReplace = document.getElementById('wordToReplace').value;
    let aka = document.getElementById('aka').value;
    let showOriginalWithAka = document.getElementById('showOriginal').checked;
    let global = !document.getElementById('siteSpecific').checked;
    let ignoreCase = document.getElementById('ignoreCase').checked;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let tabUrl = new URL(tabs[0].url).origin; // get base URL from the tab URL
        let faviconUrl = tabs[0].favIconUrl;
        let tabId = tabs[0].id;

        chrome.storage.local.get('akas', function (data) {
            let akas = data.akas || [];
            // push only if it doesn't already exist
            if (!akas.some(a => a.rootWord === wordToReplace)) {
                tabUrl = global ? undefined : tabUrl;
                akas.push({ tabUrl, rootWord: wordToReplace, aka, showOriginalWithAka, global, faviconUrl, ignoreCase });
            } else {
                // if it does exist then launch a bootstrap toast to let the user know it already exists
                let toast = document.getElementById('duplicateToast');
                let duplicateToast = new bootstrap.Toast(toast);
                duplicateToast.show();

                return;
            }

            saveAkas(akas)
                .then(() => {
                    refreshListOrchestrator(tabId, tabUrl, akas);
                })
                .catch((error) => {
                    console.error('Error saving aka:', error);
                });

            // send a message to the content script to replace the words
            chrome.tabs.sendMessage(tabId, { action: "replaceWords", data: akas });
        });
    });

    // clear out the form
    document.getElementById('wordToReplace').value = '';
    document.getElementById('aka').value = '';
    document.getElementById('showOriginal').checked = false;
    document.getElementById('siteSpecific').checked = true;
    document.getElementById('ignoreCase').checked = true;
});

document.addEventListener('DOMContentLoaded', function () {
    freshLoadTab();
});

function freshLoadTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let tab = tabs[0];
        let tabId = tab.id;
        let tabUrl = new URL(tab.url).origin; // get base URL from the tab URL

        if (tab.status === "complete") {
            // The tab is done loading
            orchestrator(tabId, tabUrl);
        } else {
            // The tab is still loading so wait for it to finish
            chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
                if (tab.active && changeInfo.status === "complete") {
                    console.log('tab loaded');
                    // on popup load, load the akas from storage into #akasUList
                    orchestrator(tabId, tabUrl);
                }
            });
        }
    });
}

function orchestrator(tabId, tabUrl) {
    chrome.storage.local.get('akas', function (data) {
        let akas = data.akas || [];
        if (akas.length === 0) {
            document.getElementById('akaListLoader').style.display = 'none';
            return;
        }

        refreshListOrchestrator(tabId, tabUrl, akas);
    });
}

function refreshListOrchestrator(tabId, tabUrl, akas) {
    chrome.tabs.sendMessage(tabId, { action: "getAkaCounts" }, function (response) {
        addAkasToList(akas, response?.counts, tabUrl);
    });
}

// { tabUrl, rootWord: wordToReplace, aka, showOriginalWithAka, global, faviconUrl }
function addAkasToList(akas, counts, tabUrl) {
    let akasUList = document.getElementById('akasUList');
    akasUList.innerHTML = ''; // clear out the list

    if (!tabUrl) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            tabUrl = new URL(tabs[0].url).origin; // get base URL from the tab URL
            processAkas(akas, tabUrl, counts);
        });
        return;
    }

    processAkas(akas, tabUrl, counts);
}

function processAkas(akas, tabUrl, counts) {
    console.log('processAkas', akas, tabUrl, counts);
    akas
        .filter(aka => aka.global || aka.tabUrl === tabUrl)
        .forEach(aka => {
            let akaCount = counts?.[aka.rootWord] ?? 0;
            if (akaCount === 0) {
                return;
            }

            let li = document.createElement('li');
            li.classList.add('list-group-item');
            li.classList.add('list-group-item-action');

            li.innerHTML = generateAkaListHtml(aka, akaCount);

            akasUList.appendChild(li);
        });

    // Hide akaListLoader and show akasUList
    document.getElementById('akaListLoader').style.display = 'none';
}

function generateAkaListHtml(aka, akaCount, fromFullList = false) {
    return `
    <div>
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${aka.rootWord}</h6>

            ${akaCount ?
            `<small class="badge bg-success rounded-pill"
                data-bs-toggle="tooltip"
                title="The count of the AKA found on the current tab. This may be in hidden elements too.">
                ${akaCount}
            </small>`
            : ''}

        </div>
        <p class="mb-1">
            <small class="text-muted">Display: </small>
            ${aka.aka} ${!!aka.showOriginalWithAks ? `(${aka.rootWord})` : ''}
        </p>
        
        <img src="images/trash-can-outline.svg" class="deleteButton" data-aka="${aka.aka}" data-fromfulllist="${fromFullList}" />
    </div>
    `;
}

// listen for clicks on the delete buttons and delete that item from storage
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('deleteButton')) {
        // get the aka from the data-aka attribute
        var deleteModalEl = document.querySelector('#deleteModal');
        var modal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);

        // get modal delete button and set the data-aka attribute
        var deleteConfirmButton = document.getElementById('deleteConfirm');
        deleteConfirmButton.dataset.fromfulllist = event.target.dataset.fromfulllist;
        let aka = event.target.dataset.aka;
        deleteConfirmButton.dataset.aka = aka;

        modal.show();
    }

    if (event.target.id === 'deleteConfirm') {
        let aka = event.target.dataset.aka;
        removeAka(aka)
            .then(() => {
                let fromFullList = event.target.dataset.fromfulllist === "true";

                var deleteModalEl = document.querySelector('#deleteModal');
                var modal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
                modal.hide();

                if (fromFullList) {
                    // get the tabUrl from the heading of the open accordion
                    let deletedFromTabUrl = document.querySelector('.accordion-header button[aria-expanded="true"]').innerText;
                    generateAllAkasListHtml(deletedFromTabUrl);
                    event.target.dataset.fromFullList = undefined;
                    return;
                }

                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    let tab = tabs[0];
                    let tabId = tab.id;
                    let tabUrl = new URL(tab.url).origin; // get base URL from the tab URL

                    orchestrator(tabId, tabUrl);

                    // show a bootstrap toast at the bottom that says "You need to refresh the page to see the changes"
                    let toast = document.getElementById('refreshToast');
                    let refreshToast = new bootstrap.Toast(toast);
                    refreshToast.show();
                    
                });
                event.target.dataset.fromFullList = undefined;
            })
            .catch((error) => {
                console.error('Error removing aka:', error);
            });
    }

    if (event.target.id === 'allAkas') {
        generateAllAkasListHtml();
    }

    if (event.target.id === 'offcanvasAllAkasClose') {
        freshLoadTab();
    }
});

function generateAllAkasListHtml(deletedFromTabUrl = undefined) {
    let allAkaAccordion = document.getElementById('allAkaAccordion');
    allAkaAccordion.innerHTML = '';

    chrome.storage.local.get('akas', function (data) {
        let akas = data.akas || [];
        if (!akas || akas.length === 0) {
            document.getElementById('allAkaListLoader').style.display = 'none';
            allAkaAccordion.innerHTML = '<p class="text-muted">No AKAs found...</p>';
            return;
        }

        let groupedAkas = {};
        akas.sort((a, b) => { // order akas global == true then by tabUrl alphabetically
            if (a.global && !b.global) {
                return -1;
            }
            if (a.tabUrl < b.tabUrl) {
                return -1;
            }

            if (!a.global && b.global) {
                return 1;
            }
            if (a.tabUrl > b.tabUrl) {
                return 1;
            }
            return 0;
        });

        akas.forEach(aka => {
            let tabUrl = aka.global ? 'global' : aka.tabUrl;
            if (!groupedAkas[tabUrl]) {
                groupedAkas[tabUrl] = [];
            }
            groupedAkas[tabUrl].push(aka);
        });

        for (let tabUrl in groupedAkas) {
            let sanitizedUrl = tabUrl.replace(/(http:\/\/|https:\/\/)/g, '');
            let shouldBeOpen = sanitizedUrl === deletedFromTabUrl;
            let elementId = sanitizedUrl.replace(/(\.)+/g, '');

            // get the favIconUrl from the first aka in the group
            let favIconUrl = tabUrl !== 'global' ? groupedAkas[tabUrl][0].faviconUrl : undefined;

            let accordionItem = getAccordionItem();
            let accordionHeader = getAccordionHeader(elementId);
            let accordionButton = getAccordionButton(sanitizedUrl, elementId, favIconUrl);
            let accordionCollapse = getAccordionCollapse(elementId, shouldBeOpen);
            let accordionBody = getAccordionBody();
            let akaList = getAkaList(groupedAkas, tabUrl);

            // Accordion
            //  Item
            //      h2
            //          button
            //      collapse
            //          body
            accordionItem.appendChild(accordionHeader);
            accordionHeader.appendChild(accordionButton);
            accordionItem.appendChild(accordionCollapse);
            accordionCollapse.appendChild(accordionBody);
            accordionBody.appendChild(akaList);
            allAkaAccordion.appendChild(accordionItem);
        }

        document.getElementById('allAkaListLoader').style.display = 'none';
    });
}

function getAccordionItem() {
    let accordionItem = document.createElement('div');
    accordionItem.classList.add('accordion-item');
    return accordionItem;
}

function getAccordionHeader(elementId) {
    let accordionHeader = document.createElement('h2');
    accordionHeader.classList.add('accordion-header');
    accordionHeader.id = `heading${elementId}`;
    return accordionHeader;
}

function getAccordionButton(tabUrl, elementId, favIconUrl) {
    let accordionButton = document.createElement('button');

    accordionButton.classList.add('accordion-button');
    accordionButton.classList.add('collapsed');

    accordionButton.setAttribute('type', 'button');
    accordionButton.setAttribute('data-bs-toggle', 'collapse');
    accordionButton.setAttribute('data-bs-target', `#collapse${elementId}`);
    accordionButton.setAttribute('aria-expanded', 'false');
    accordionButton.setAttribute('aria-controls', `collapse${elementId}`);

    accordionButton.innerHTML = `${favIconUrl ? `<img class="me-3 favIcoDisplay" src="${favIconUrl}" /> ` : ''}${tabUrl === 'global' ? 'Global' : tabUrl}`;

    return accordionButton;
}

function getAccordionCollapse(elementId, shouldBeOpen = false) {
    let accordionCollapse = document.createElement('div');

    accordionCollapse.classList.add('accordion-collapse');
    accordionCollapse.classList.add('collapse');

    if (shouldBeOpen) {
        accordionCollapse.classList.add('show');
    }

    accordionCollapse.setAttribute('id', `collapse${elementId}`);
    accordionCollapse.setAttribute('aria-labelledby', `heading${elementId}`);
    accordionCollapse.setAttribute('data-bs-parent', '#allAkaAccordion');
    return accordionCollapse;
}

function getAccordionBody() {
    let accordionBody = document.createElement('div');
    accordionBody.classList.add('accordion-body');
    accordionBody.classList.add('p-1');
    return accordionBody;
}

function getAkaList(groupedAkas, tabUrl) {
    let akaList = document.createElement('ul');
    akaList.classList.add('list-group');
    akaList.classList.add('list-group-flush');

    for (let aka of groupedAkas[tabUrl]) {
        // create a new list item
        let li = document.createElement('li');
        li.classList.add('list-group-item');
        li.classList.add('list-group-item-action');
        li.innerHTML = generateAkaListHtml(aka, undefined, fromFullList = true);

        akaList.appendChild(li);
    }
    return akaList;
}

async function saveAkas(akas) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ akas: akas }, function () {
            resolve();
        });
    });
}

async function removeAka(aka) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('akas', function (data) {
            let akas = data.akas || [];
            akas = akas.filter(a => a.aka !== aka);

            saveAkas(akas)
                .then(() => {
                    addAkasToList(akas);
                    resolve();
                })
                .catch((error) => {
                    reject(error);
                });
        });
    });
}
