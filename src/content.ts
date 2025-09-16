// Get owner and repo from URL
function getRepoInfo(): { owner: string; repo: string } | null {
  const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// Format timestamp nicely
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function fetchCommits(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchPulls(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&sort=updated`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchIssues(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&sort=updated`);
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

function createActivityItem(
  avatarUrl: string,
  username: string,
  message: string,
  link: string,
  date: string
) {
  const item = document.createElement("div");
  item.className = "gh-activity-item";

  const formattedMsg = formatMessage(message);

  item.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:8px;">
      <img src="${avatarUrl}" width="24" height="24" style="border-radius:50%;margin-right:8px;">
      <div>
        <a href="${link}" target="_blank" style="font-weight:500;color:#0366d6;text-decoration:none;">
          ${username}
        </a>: ${formattedMsg} <br>
        <small style="color:#57606a">${date}</small>
      </div>
    </div>
  `;

  return item;
}

function renderActivity(sidebar: HTMLElement, commits: any[], pulls: any[], issues: any[]) {
  sidebar.innerHTML = "<h2>Recent Activity</h2>";

  commits.slice(0, 3).forEach(commit => {
    const author = commit.commit.author.name;
    const avatar = commit.author?.avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
    const msg = commit.commit.message.split("\n")[0];
    const link = commit.html_url;
    const date = formatDate(commit.commit.author.date);
    sidebar.appendChild(createActivityItem(avatar, author, msg, link, date));
  });

  pulls.slice(0, 3).forEach(pr => {
    const user = pr.user.login;
    const avatar = pr.user.avatar_url;
    const title = pr.title;
    const link = pr.html_url;
    const date = formatDate(pr.updated_at);
    sidebar.appendChild(createActivityItem(avatar, user, `PR: ${title}`, link, date));
  });

  issues.slice(0, 3).forEach(issue => {
    if (issue.pull_request) return;
    const user = issue.user.login;
    const avatar = issue.user.avatar_url;
    const title = issue.title;
    const link = issue.html_url;
    const date = formatDate(issue.updated_at);
    sidebar.appendChild(createActivityItem(avatar, user, `Issue: ${title}`, link, date));
  });
}

async function injectActivitySidebar() {
  if (document.getElementById("gh-activity-sidebar-container")) return;

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
    (repoWrapper as HTMLElement).style.flexGrow = "1";
    parent.appendChild(container);
  } else {
    document.body.appendChild(container);
  }

  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  try {
    const [commits, pulls, issues] = await Promise.all([
      fetchCommits(repoInfo.owner, repoInfo.repo),
      fetchPulls(repoInfo.owner, repoInfo.repo),
      fetchIssues(repoInfo.owner, repoInfo.repo)
    ]);

    renderActivity(sidebar, commits, pulls, issues);
  } catch (err) {
    sidebar.innerHTML = "<p>Error fetching activity.</p>";
    console.error(err);
  }
}

// Observe PJAX navigation
const observer = new MutationObserver(() => injectActivitySidebar());
observer.observe(document.body, { childList: true, subtree: true });

// Initial injection
injectActivitySidebar();
