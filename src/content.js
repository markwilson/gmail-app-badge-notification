(() => {
    // The unread count is fetched by the background service worker (not
    // subject to Gmail's page CSP) and pushed here, since navigator.setAppBadge
    // must be called from the app window's own context.
    let unreadCount;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type !== 'setBadge') return;
        if (message.count === unreadCount) return;
        unreadCount = message.count;
        navigator.setAppBadge(unreadCount);
    });
})();
