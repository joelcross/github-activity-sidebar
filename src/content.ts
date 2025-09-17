// Get owner and repo from URL
function getRepoInfo(): { owner: string; repo: string } | null {
  const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// Get commit data for repo
async function getCommits(owner: string, repo: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits`
  );
  if (!res.ok) return [];
  return res.json();
}

// Escape HTML to prevent injection
function escapeHTML(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Convert Markdown-style backticks to <code>
function formatMessage(msg: string) {
  const escaped = escapeHTML(msg);
  return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
}

// Format timestamp nicely
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Return stylized HTML block for each commit
function createActivityItem(
  avatarUrl: string,
  username: string,
  message: string,
  link: string,
  date: string
) {
  const item = document.createElement("div");
  item.className = "item";

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

// Render commits in sidebar
function renderActivity(sidebar: HTMLElement, commits: any[]) {
  sidebar.innerHTML = "<h2>Recent Commits</h2>";

  // Add each commit into the sidebar
  commits.slice(0, 10).forEach((commit) => {
    const author =
      commit.commit.author?.name || commit.author?.login || "Unknown";
    const avatar =
      commit.author?.avatar_url ||
      "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
    const msg = commit.commit.message.split("\n")[0];
    const link = commit.html_url;
    const date = formatDate(commit.commit.author.date);
    sidebar.appendChild(createActivityItem(avatar, author, msg, link, date));
  });
}

// Inject sidebar into the webpage
async function injectActivitySidebar() {
  // Only show on the "Code" tab (repo home page)
  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  // Get the first path segment after owner/repo
  const extraPath = window.location.pathname.replace(
    `/${repoInfo.owner}/${repoInfo.repo}`,
    ""
  );
  if (extraPath && extraPath !== "/") return; // Not on code tab, skip

  // Prevent duplicate injection
  if (document.getElementById("sidebar-container")) return;

  // Wrapper for sidebar + toggle
  const container = document.createElement("div");
  container.id = "sidebar-container";
  container.style.display = "flex";
  container.style.alignItems = "flex-start";
  container.style.position = "relative";

  const sidebar = document.createElement("div");
  sidebar.id = "sidebar";
  sidebar.className = "sidebar";
  sidebar.innerHTML = "<h2>Loading activity...</h2>";

  // Toggle button
  const toggle = document.createElement("div");
  toggle.id = "sidebar-toggle";
  toggle.textContent = "◄";
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    toggle.textContent = sidebar.classList.contains("collapsed") ? "►" : "◄";
  });

  container.appendChild(toggle);
  container.appendChild(sidebar);

  // Find correct location to inject sidebar HTML
  const repoWrapper =
    document.querySelector("div[data-pjax='#repo-content-pjax-container']") ||
    document.querySelector("div#repo-content-pjax-container");

  if (repoWrapper && repoWrapper.parentElement) {
    const parent = repoWrapper.parentElement;
    parent.style.display = "flex";
    parent.style.alignItems = "flex-start";
    (repoWrapper as HTMLElement).style.flexGrow = "1";
    parent.appendChild(container);
  } else {
    document.body.appendChild(container);
  }

  // Handle possible errors
  try {
    const commits = await getCommits(repoInfo.owner, repoInfo.repo);
    renderActivity(sidebar, commits);
  } catch (err) {
    sidebar.innerHTML = "<p>Error fetching activity.</p>";
    console.error(err);
  }
}

// Observe PJAX navigation to ensure that the sidebar is only displayed
// on the correct pages
const observer = new MutationObserver(() => injectActivitySidebar());
observer.observe(document.body, { childList: true, subtree: true });

// Initial injection
injectActivitySidebar();
