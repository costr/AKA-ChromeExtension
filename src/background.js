// background.js
// Listen for messages from the content script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.method === "contentFound") {
        // If content is found, set the badge
        if (request.data > 0) {
            chrome.action.setBadgeText({ text: `${request.data}`, tabId: sender.tab.id });
        }
    }
});