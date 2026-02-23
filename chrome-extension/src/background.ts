// src/background.ts

function updateBadge(tabId: number, url: string | undefined) {
    if (!url || !url.startsWith("http")) return;

    chrome.storage.local.get(["pathfind_url", "pathfind_token"], async (result) => {
        const pathfindUrl = result.pathfind_url;
        const token = result.pathfind_token;

        if (!pathfindUrl || !token) {
            chrome.action.setBadgeText({ tabId, text: "" });
            return;
        }

        try {
            const res = await fetch(`${pathfindUrl}/api/bookmarks/check?url=${encodeURIComponent(url)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.bookmarked) {
                    chrome.action.setBadgeText({ tabId, text: "✓" });
                    chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" }); // Emerald 500
                    chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
                } else {
                    chrome.action.setBadgeText({ tabId, text: "" });
                }
            }
        } catch (error) {
            console.error("Failed to check bookmark status:", error);
            chrome.action.setBadgeText({ tabId, text: "" });
        }
    });
}

// Listen for navigation completed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        updateBadge(tabId, tab.url);
    }
});

// Update badge when switching tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        updateBadge(tabId, tab.url);
    });
});

// Listen for explicit "saved" messages from the popup
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'bookmarkSaved' && message.tabId) {
        chrome.action.setBadgeText({ tabId: message.tabId, text: "✓" });
        chrome.action.setBadgeBackgroundColor({ tabId: message.tabId, color: "#10b981" });
        chrome.action.setBadgeTextColor({ tabId: message.tabId, color: "#ffffff" });
    }
});
