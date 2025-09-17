"use strict";
// Get owner and repo from URL
function getRepoInfo() {
    const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (!match)
        return null;
    return { owner: match[1], repo: match[2] };
}
// Format timestamp nicely
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
async function fetchCommits(owner, repo) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`);
    if (!res.ok)
        return [];
    return res.json();
}
// Escape HTML to prevent injection
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
// Convert Markdown-style backticks to <code>
function formatMessage(msg) {
    const escaped = escapeHTML(msg);
    return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
}
function createActivityItem(avatarUrl, username, message, link, date) {
    const item = document.createElement("div");
    item.className = "gh-activity-item";
    const formattedMsg = formatMessage(message);
    item.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:8px;">
      <img src="${avatarUrl}" width="24" height="24" style="border-radius:50%;margin-right:8px;">
      <div>
        <a href="${link}" target="_blank" style="font-weight:500;color:#0366d6;text-decoration:none;">
          ${username}</a>: ${formattedMsg} <br>
        <small style="color:#57606a">${date}</small>
      </div>
    </div>
  `;
    return item;
}
function renderActivity(sidebar, commits) {
    sidebar.innerHTML = "<h2>Recent Commits</h2>";
    commits.slice(0, 10).forEach(commit => {
        const author = commit.commit.author?.name || commit.author?.login || "Unknown";
        const avatar = commit.author?.avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
        const msg = commit.commit.message.split("\n")[0];
        const link = commit.html_url;
        const date = formatDate(commit.commit.author.date);
        sidebar.appendChild(createActivityItem(avatar, author, msg, link, date));
    });
}
async function injectActivitySidebar() {
    // Only show on the "Code" tab (repo home page)
    const repoInfo = getRepoInfo();
    if (!repoInfo)
        return;
    // Get the first path segment after owner/repo
    const extraPath = window.location.pathname.replace(`/${repoInfo.owner}/${repoInfo.repo}`, "");
    if (extraPath && extraPath !== "/")
        return; // Not on code tab, skip
    // Prevent duplicate injection
    if (document.getElementById("gh-activity-sidebar-container"))
        return;
    // Wrapper for sidebar + toggle
    const container = document.createElement("div");
    container.id = "gh-activity-sidebar-container";
    container.style.display = "flex";
    container.style.alignItems = "flex-start";
    container.style.position = "relative";
    const sidebar = document.createElement("div");
    sidebar.id = "gh-activity-sidebar";
    sidebar.className = "gh-activity-sidebar";
    sidebar.innerHTML = "<h2>Loading activity...</h2>";
    // Toggle button
    const toggle = document.createElement("div");
    toggle.id = "gh-activity-sidebar-toggle";
    toggle.textContent = "◄";
    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        toggle.textContent = sidebar.classList.contains("collapsed") ? "►" : "◄";
    });
    container.appendChild(toggle);
    container.appendChild(sidebar);
    const repoWrapper = document.querySelector("div[data-pjax='#repo-content-pjax-container']")
        || document.querySelector("div#repo-content-pjax-container");
    if (repoWrapper && repoWrapper.parentElement) {
        const parent = repoWrapper.parentElement;
        parent.style.display = "flex";
        parent.style.alignItems = "flex-start";
        repoWrapper.style.flexGrow = "1";
        parent.appendChild(container);
    }
    else {
        document.body.appendChild(container);
    }
    try {
        const commits = await fetchCommits(repoInfo.owner, repoInfo.repo);
        renderActivity(sidebar, commits);
    }
    catch (err) {
        sidebar.innerHTML = "<p>Error fetching activity.</p>";
        console.error(err);
    }
}
// Observe PJAX navigation
const observer = new MutationObserver(() => injectActivitySidebar());
observer.observe(document.body, { childList: true, subtree: true });
// Initial injection
injectActivitySidebar();
