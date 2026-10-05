
// Fetching the Atom feed from a content script running on mail.google.com
// gets blocked by Gmail's own CSP (the feed redirects through
// accounts.google.com for a re-auth check). Service worker fetches aren't
// subject to the page's CSP, so the feed is fetched here and the resulting
// count is pushed to the Gmail tab via messaging instead.
function getUnreadCount(xmlText) {
    const match = xmlText.match(/<fullcount>(\d+)<\/fullcount>/);
    if (!match) return -1;
    const count = parseInt(match[1], 10);
    return isNaN(count) ? -1 : count;
}

async function getAtomFeed(label) {
    const url = `https://mail.google.com/mail/feed/atom${label ? `/${label}` : ''}?_=${new Date().getTime()}`;
    try {
        const response = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
        return await response.text();
    } catch (err) {
        console.error('Error fetching Atom feed:', err);
        return null;
    }
}

async function updateBadge() {
    const { label } = await chrome.storage.sync.get({ label: '' });
    const feedText = await getAtomFeed(label);
    const count = feedText ? getUnreadCount(feedText) : -1;
    if (count < 0) return;

    const tabs = await chrome.tabs.query({ url: '*://*.mail.google.com/mail/*' });
    for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'setBadge', count }).catch(() => {});
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('updateBadge', { periodInMinutes: 1 });
    updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
    updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateBadge') {
        updateBadge();
    }
});

chrome.contextMenus.create({
    id: "open-options",
    title: "Configure Gmail Badge",
    contexts: ["all"],
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "open-options") {
        chrome.runtime.openOptionsPage();
    }
});

// Wrap storage access in try...catch
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'getLabel') {
        try {
            const { label } = await chrome.storage.sync.get({ label: '' });
            sendResponse({ label });
        } catch (error) {
            console.error('Error accessing storage:', error);
            sendResponse({ label: null });
        }
    }
    return true;
});
